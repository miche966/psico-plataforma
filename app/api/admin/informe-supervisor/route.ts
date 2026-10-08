import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { GEMINI_MODEL } from '@/lib/server/geminiModel'
import { rlAdmin, verificarLimite, respuestaLimiteExcedido } from '@/lib/server/rateLimit'
import { mensajeParaCliente } from '@/lib/server/mensajesError'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { idValido, procesosDelCandidato } from '@/lib/server/supervisoresGestion'
import { despublicar, guardarBorrador, leerInformeSupervisor, publicarBorrador } from '@/lib/server/informeSupervisorDb'
import { construirPrompt, entradaParaIa, extraerJson, hayMaterial, normalizarInformeSupervisor, revisarTerminos, seccionesFaltantes } from '@/lib/informeSupervisor'

// Informe para supervisores (ver docs/PLAN_SUPERVISORES.md): generar con IA un borrador a partir del informe que el administrador ya
// guardo, editarlo y publicarlo. Solo el administrador completo. El supervisor solo ve lo PUBLICADO (etapa 4).

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

async function validarEntrada(db: any, candidatoId: unknown, procesoId: unknown) {
  if (!idValido(candidatoId)) return { error: NextResponse.json({ error: 'Candidato inválido' }, { status: 400 }) }
  if (!idValido(procesoId)) return { error: NextResponse.json({ error: 'Proceso inválido' }, { status: 400 }) }
  const procesos = await procesosDelCandidato(db, candidatoId)
  if (!procesos.includes(procesoId)) return { error: NextResponse.json({ error: 'Esa persona no participa de ese proceso' }, { status: 400 }) }
  return { candidatoId, procesoId }
}

/** Estado del informe y la revision de terminos de lo que hay (borrador y publicado). */
export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const url = new URL(req.url)
    const db = createSupabaseAdmin()
    const v = await validarEntrada(db, url.searchParams.get('candidato_id'), url.searchParams.get('proceso_id'))
    if ('error' in v) return v.error

    const estado = await leerInformeSupervisor(db, v.candidatoId, v.procesoId)
    const { data: informeTecnico } = await db.from('informes_psicometricos').select('candidato_id').eq('candidato_id', v.candidatoId).maybeSingle()
    return NextResponse.json({
      ...estado,
      hayInformeTecnico: !!informeTecnico,
      revision: estado.borrador ? revisarTerminos(estado.borrador) : null,
    })
  } catch (error) {
    console.error('[admin/informe-supervisor GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar el informe para supervisores' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const body = await req.json().catch(() => ({}))
    const accion = String(body.accion || '')
    if (!['generar', 'guardar_borrador', 'publicar', 'despublicar'].includes(accion)) {
      return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
    }
    const db = createSupabaseAdmin()
    const v = await validarEntrada(db, body.candidato_id, body.proceso_id)
    if ('error' in v) return v.error

    if (accion === 'generar') return await generar(db, auth, req, v.candidatoId, v.procesoId)

    if (accion === 'guardar_borrador') {
      const borrador = await guardarBorrador(db, v.candidatoId, v.procesoId, body.borrador)
      return NextResponse.json({ borrador, revision: revisarTerminos(borrador) })
    }

    if (accion === 'publicar') {
      // El servidor revisa el borrador GUARDADO (no lo que mande el navegador): lo publicado es exactamente lo revisado
      const estado = await leerInformeSupervisor(db, v.candidatoId, v.procesoId)
      if (!estado.borrador) return NextResponse.json({ error: 'Todavía no hay un borrador para publicar. Generalo o guardalo primero.' }, { status: 409 })
      const faltan = seccionesFaltantes(estado.borrador)
      if (faltan.length > 0) return NextResponse.json({ error: `Faltan secciones para publicar: ${faltan.join(', ')}.` }, { status: 422 })
      const revision = revisarTerminos(estado.borrador)
      if (revision.bloqueantes.length > 0) {
        return NextResponse.json({ error: 'El informe tiene términos que un supervisor no debe ver. Corregilos y guardá el borrador antes de publicar.', revision }, { status: 422 })
      }
      await publicarBorrador(db, v.candidatoId, v.procesoId, auth.user?.email || null)
      await registrarAcceso(db, auth, { accion: 'publicar_informe_supervisor', candidatoId: v.candidatoId, procesoId: v.procesoId }, req)
      return NextResponse.json({ success: true, revision })
    }

    await despublicar(db, v.candidatoId, v.procesoId)
    await registrarAcceso(db, auth, { accion: 'despublicar_informe_supervisor', candidatoId: v.candidatoId, procesoId: v.procesoId }, req)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/informe-supervisor POST]', error)
    return NextResponse.json({ error: mensajeParaCliente(error, 'No se pudo completar la operación') }, { status: 500 })
  }
}

async function generar(db: any, auth: any, req: Request, candidatoId: string, procesoId: string) {
  const { permitido } = await verificarLimite(rlAdmin, auth.user.email)
  if (!permitido) return NextResponse.json(respuestaLimiteExcedido(), { status: 429 })

  // Se parte del informe tecnico ya guardado y aprobado, nunca de los datos crudos
  const { data: tecnico, error: tecnicoError } = await db.from('informes_psicometricos').select('contenido').eq('candidato_id', candidatoId).maybeSingle()
  if (tecnicoError) throw tecnicoError
  const entrada = entradaParaIa(tecnico?.contenido)
  if (!tecnico || !hayMaterial(entrada)) {
    return NextResponse.json({ error: 'Primero guardá el informe psicolaboral de esta persona: el informe para supervisores se arma a partir de él.' }, { status: 409 })
  }

  const { data: proceso } = await db.from('procesos').select('cargo').eq('id', procesoId).maybeSingle()
  const prompt = construirPrompt(entrada, proceso?.cargo || '')

  let respuesta: string | null = null
  for (let intento = 1; intento <= 3 && respuesta === null; intento++) {
    try {
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { maxOutputTokens: 4000, temperature: 0.3 } })
      const resultado = await model.generateContent(prompt)
      respuesta = resultado.response.text()
    } catch (err: any) {
      console.error(`[INFORME SUPERVISOR] Error en el intento ${intento}/3:`, err?.message || err)
      if (intento >= 3) throw err
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, intento) * 1000))
    }
  }

  const json = extraerJson(respuesta)
  if (!json) return NextResponse.json({ error: 'La IA no devolvió un texto utilizable. Intentá de nuevo.' }, { status: 502 })

  // Siempre queda como BORRADOR: nada llega al supervisor hasta que el administrador lo revise y lo publique
  const borrador = await guardarBorrador(db, candidatoId, procesoId, normalizarInformeSupervisor(json))
  await registrarAcceso(db, auth, { accion: 'generar_informe', candidatoId, procesoId }, req)
  return NextResponse.json({ borrador, revision: revisarTerminos(borrador) })
}
