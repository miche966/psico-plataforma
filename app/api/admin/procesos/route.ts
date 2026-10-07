import { NextResponse } from 'next/server'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { readAll } from '@/lib/server/readAll'
import { candidatoIdsEnProcesos } from '@/lib/server/procesoScope'
import { SLUG_TO_ID } from '@/lib/server/catalogoTests'
import { z, validar, lenient } from '@/lib/server/validacion'
import { mensajeParaCliente } from '@/lib/server/mensajesError'
import { procesoCamposSchema, procesoIdSchema, vinculoSchema, filaCandidatoSchema, cargaMasivaSchema } from '@/lib/server/esquemasProcesos'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const db = createSupabaseAdmin()
    const procesoId = new URL(req.url).searchParams.get('proceso_id')

    if (procesoId) {
      if (auth.role === 'viewer' && !auth.allowedProcesoIds.includes(procesoId)) {
        return NextResponse.json({ error: 'No tenes acceso a este proceso' }, { status: 403 })
      }
      const [{ data: sesiones, error: sesionesError }, { data: candidatos, error: candidatosError }, { data: respuestasVideo, error: videosError }, { data: preguntasVideo, error: preguntasError }] = await Promise.all([
        db.from('sesiones').select('candidato_id, test_id, estado').eq('proceso_id', procesoId).not('candidato_id', 'is', null),
        db.from('candidatos').select('id, nombre, apellido, email'),
        db.from('respuestas_video').select('candidato_id, entrevista_id, pregunta_id').eq('estado', 'completado'),
        db.from('preguntas_video').select('id, entrevista_id, pregunta')
      ])
      if (sesionesError || candidatosError || videosError || preguntasError) throw sesionesError || candidatosError || videosError || preguntasError
      // Filtramos la lista global de candidatos al set real vinculado a este proceso (aplica siempre,
      // no solo para viewer -- esta rama ya recorta por proceso_id en sesiones, corresponde recortar igual el resto).
      const idsDelProceso = new Set((sesiones || []).map(s => s.candidato_id))
      const candidatosDelProceso = (candidatos || []).filter(c => idsDelProceso.has(c.id))
      const respuestasDelProceso = (respuestasVideo || []).filter(r => idsDelProceso.has(r.candidato_id))
      return NextResponse.json({ sesiones: sesiones || [], candidatos: candidatosDelProceso, respuestasVideo: respuestasDelProceso, preguntasVideo: preguntasVideo || [] })
    }

    const [{ data, error }, { data: candidatos, error: candidatosError }, { data: entrevistas, error: entrevistasError }, sesiones, respuestasVideo, preguntasVideo] = await Promise.all([
      db.from('procesos').select('*').order('creado_en', { ascending: false }),
      db.from('candidatos').select('id, nombre, apellido, email').order('creado_en', { ascending: false }),
      db.from('entrevistas_video').select('*').order('creada_en', { ascending: false }),
      readAll(db, 'sesiones', '*'),
      // El avance de cada participante (video incluido) se calcula con estos campos, igual que en el panel
      readAll(db, 'respuestas_video', 'candidato_id, entrevista_id, pregunta_id, estado'),
      readAll(db, 'preguntas_video', 'id, entrevista_id, pregunta')
    ])
    if (error || candidatosError || entrevistasError) throw error || candidatosError || entrevistasError

    if (auth.role === 'viewer') {
      const procesosPermitidos = new Set(auth.allowedProcesoIds)
      const procesosFiltrados = (data || []).filter(p => procesosPermitidos.has(p.id))
      const sesionesFiltradas = (sesiones || []).filter(s => s.proceso_id && procesosPermitidos.has(s.proceso_id))
      const idsCandidatos = await candidatoIdsEnProcesos(db, auth.allowedProcesoIds)
      const candidatosFiltrados = (candidatos || []).filter(c => idsCandidatos.has(c.id))
      const respuestasFiltradas = (respuestasVideo || []).filter((r: any) => idsCandidatos.has(r.candidato_id))
      return NextResponse.json({ data: procesosFiltrados, candidatos: candidatosFiltrados, entrevistas: entrevistas || [], sesiones: sesionesFiltradas, respuestasVideo: respuestasFiltradas, preguntasVideo })
    }

    return NextResponse.json({ data: data || [], candidatos: candidatos || [], entrevistas: entrevistas || [], sesiones, respuestasVideo, preguntasVideo })
  } catch (error) {
    console.error('Error cargando procesos administrativos:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los procesos' }, { status: 500 })
  }
}

function testIdDesdeSlug(slug: string) {
  if (slug.startsWith('entrevista:')) return slug.split(':')[1]
  return SLUG_TO_ID[slug] || slug
}

export async function POST(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const db = createSupabaseAdmin()

    if (action === 'crear_proceso') {
      const campos = validar(procesoCamposSchema, body, 'Los datos del proceso no son válidos.')
      if (!campos.ok) return campos.response
      const { nombre, cargo, descripcion, descripcion_cargo, competencias_requeridas, bateria_tests } = campos.data
      const { data, error } = await db.from('procesos').insert({
        nombre,
        cargo,
        descripcion,
        descripcion_cargo,
        competencias_requeridas,
        activo: true,
        bateria_tests
      }).select().single()
      if (error) throw error
      return NextResponse.json({ proceso: data })
    }

    if (action === 'actualizar_proceso') {
      const campos = validar(procesoCamposSchema.partial().extend(procesoIdSchema.shape), body, 'Los datos del proceso no son válidos.')
      if (!campos.ok) return campos.response
      const { procesoId, nombre, cargo, descripcion, descripcion_cargo, competencias_requeridas, bateria_tests } = campos.data
      const { error } = await db.from('procesos').update({
        nombre,
        cargo,
        descripcion,
        descripcion_cargo,
        competencias_requeridas,
        bateria_tests
      }).eq('id', procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'eliminar_proceso') {
      const campos = validar(procesoIdSchema, body, 'Falta procesoId')
      if (!campos.ok) return campos.response
      const { procesoId } = campos.data
      await db.from('sesiones').update({ proceso_id: null }).eq('proceso_id', procesoId)
      const { error } = await db.from('procesos').delete().eq('id', procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_estado') {
      const campos = validar(procesoIdSchema.extend({ activo: lenient(Boolean) }), body, 'Falta procesoId')
      if (!campos.ok) return campos.response
      const { error } = await db.from('procesos').update({ activo: campos.data.activo }).eq('id', campos.data.procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'asignar_candidato') {
      const campos = validar(vinculoSchema, body, 'Faltan parámetros')
      if (!campos.ok) return campos.response
      const { candidatoId, procesoId, slugPrimerTest } = campos.data
      const testIdFinal = testIdDesdeSlug(slugPrimerTest)

      const { data: existe } = await db.from('sesiones').select('id').eq('candidato_id', candidatoId).eq('proceso_id', procesoId).limit(1)
      if (!existe || existe.length === 0) {
        const { error } = await db.from('sesiones').insert({
          candidato_id: candidatoId,
          proceso_id: procesoId,
          test_id: testIdFinal,
          estado: 'pendiente'
        })
        if (error) throw error
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'desvincular_candidato') {
      const campos = validar(vinculoSchema, body, 'Faltan parámetros')
      if (!campos.ok) return campos.response
      const { candidatoId, procesoId } = campos.data
      const { error } = await db.from('sesiones').update({ proceso_id: null }).eq('candidato_id', candidatoId).eq('proceso_id', procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'reparar_vinculos') {
      const campos = validar(procesoIdSchema.extend({ slugPrimerTest: z.string().max(100).optional().transform(v => v || 'control') }), body, 'Falta procesoId')
      if (!campos.ok) return campos.response
      const { procesoId, slugPrimerTest } = campos.data
      const testIdFinal = testIdDesdeSlug(slugPrimerTest)

      const { data: candidatos, error: candidatosError } = await db.from('candidatos').select('id')
      if (candidatosError) throw candidatosError

      const sesionesNuevas = (candidatos || []).map((c: any) => ({
        candidato_id: c.id,
        proceso_id: procesoId,
        test_id: testIdFinal,
        estado: 'pendiente'
      }))
      const { error } = await db.from('sesiones').upsert(sesionesNuevas, { onConflict: 'candidato_id,proceso_id' })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'carga_masiva') {
      const lote = validar(cargaMasivaSchema, body, 'Los datos de la carga masiva no son válidos.')
      if (!lote.ok) return lote.response
      const { procesoId, slugPrimerTest } = lote.data

      // Una fila invalida (email mal escrito, sin nombre) o repetida dentro del archivo se omite y se
      // informa; antes un solo repetido hacia fallar el insert de todo el lote.
      const validas = new Map<string, { nombre: string; apellido: string; email: string }>()
      let omitidos = 0
      for (const fila of lote.data.candidatos) {
        const r = filaCandidatoSchema.safeParse(fila)
        if (!r.success || validas.has(r.data.email)) { omitidos++; continue }
        validas.set(r.data.email, r.data)
      }
      if (validas.size === 0) return NextResponse.json({ error: 'Ninguna fila tiene un nombre y un correo electrónico válidos.' }, { status: 400 })
      const candidatosParaCargar = Array.from(validas.values())

      // En tandas: una lista larga de emails en la URL del .in() puede pasarse del limite y fallar.
      const emails = candidatosParaCargar.map(c => c.email)
      const existentes: any[] = []
      for (let i = 0; i < emails.length; i += 100) {
        const { data, error: existentesError } = await db.from('candidatos').select('*').in('email', emails.slice(i, i + 100))
        if (existentesError) throw existentesError
        existentes.push(...(data || []))
      }

      const emailsExistentes = new Set(existentes.map((e: any) => e.email))
      const nuevosParaInsertar = candidatosParaCargar.filter(c => !emailsExistentes.has(c.email))

      let todosLosCandidatos = existentes
      if (nuevosParaInsertar.length > 0) {
        const { data: insertados, error: insertError } = await db.from('candidatos').insert(nuevosParaInsertar).select()
        if (insertError) throw insertError
        if (insertados) todosLosCandidatos = [...todosLosCandidatos, ...insertados]
      }

      if (procesoId && todosLosCandidatos.length > 0) {
        const testIdFinal = testIdDesdeSlug(slugPrimerTest)

        const { data: sesionesActuales } = await db.from('sesiones').select('candidato_id').eq('proceso_id', procesoId)
        const idsConSesion = new Set((sesionesActuales || []).map((s: any) => s.candidato_id))

        const sesionesNuevas = todosLosCandidatos
          .filter((c: any) => !idsConSesion.has(c.id))
          .map((c: any) => ({ candidato_id: c.id, proceso_id: procesoId, test_id: testIdFinal, estado: 'pendiente' }))

        if (sesionesNuevas.length > 0) {
          const { error: sesionesError } = await db.from('sesiones').insert(sesionesNuevas)
          if (sesionesError) throw sesionesError
        }
      }

      return NextResponse.json({ success: true, total: todosLosCandidatos.length, omitidos })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error: any) {
    console.error('[admin/procesos POST]', error)
    return NextResponse.json({ error: mensajeParaCliente(error, 'No se pudo completar la operación') }, { status: 500 })
  }
}