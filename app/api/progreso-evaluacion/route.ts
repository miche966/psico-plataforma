import { NextResponse } from 'next/server'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { z, validar } from '@/lib/server/validacion'

const fechaIso = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'La fecha no es válida.')
const contador = z.number().int().min(0).max(100000)

// total_preguntas / pregunta_actual pueden venir en null (lib/progresoOperativo.ts los manda asi).
const progresoSchema = z.object({
  candidato_id: z.guid(),
  proceso_id: z.guid(),
  token: z.string().min(1).max(2048),
  evaluacion_key: z.string().min(1).max(200),
  estado: z.enum(['pendiente', 'en_curso', 'pausada', 'completada', 'error', 'vencida']).default('en_curso'),
  pregunta_actual: contador.nullish(),
  total_preguntas: contador.nullish(),
  respuestas_completadas: z.coerce.number().int().min(0).max(100000).optional(),
  iniciada_en: fechaIso.nullish(),
  completada_en: fechaIso.nullish(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const campos = validar(progresoSchema, body, 'Datos de progreso incompletos')
    if (!campos.ok) return campos.response
    const { candidato_id, proceso_id, token, evaluacion_key, estado, pregunta_actual, total_preguntas, respuestas_completadas, iniciada_en, completada_en } = campos.data
    if (!validarTokenEvaluacion(token, candidato_id, proceso_id)) {
      return NextResponse.json({ error: 'Enlace de evaluación inválido o vencido' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Seguimiento operativo no configurado en el servidor' }, { status: 503 })
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/progreso_evaluaciones`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        candidato_id,
        proceso_id,
        evaluacion_key,
        estado,
        ...(pregunta_actual !== undefined ? { pregunta_actual } : {}),
        ...(total_preguntas !== undefined ? { total_preguntas } : {}),
        ...(respuestas_completadas !== undefined ? { respuestas_completadas } : {}),
        ...(iniciada_en ? { iniciada_en } : {}),
        ...(completada_en ? { completada_en } : {}),
        ultima_actividad_en: new Date().toISOString(),
      }),
    })
    if (!response.ok) return NextResponse.json({ error: 'No se pudo guardar el progreso' }, { status: 502 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en progreso-evaluacion:', error)
    return NextResponse.json({ error: 'Error interno al guardar el progreso' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Seguimiento operativo no configurado en el servidor' }, { status: 503 })

    const url = new URL(req.url)
    const procesoIdSolicitado = url.searchParams.get('proceso_id')

    if (auth.role === 'viewer') {
      if (procesoIdSolicitado && !auth.allowedProcesoIds.includes(procesoIdSolicitado)) {
        return NextResponse.json({ data: [] })
      }
      if (!auth.allowedProcesoIds.length) return NextResponse.json({ data: [] })
    }

    const query = new URLSearchParams({ select: '*', order: 'ultima_actividad_en.desc.nullslast' })
    if (url.searchParams.get('candidato_id')) query.set('candidato_id', `eq.${url.searchParams.get('candidato_id')}`)
    if (procesoIdSolicitado) {
      query.set('proceso_id', `eq.${procesoIdSolicitado}`)
    } else if (auth.role === 'viewer') {
      // No se confia en que el llamador filtre por su cuenta -- se acota siempre en el servidor.
      query.set('proceso_id', `in.(${auth.allowedProcesoIds.join(',')})`)
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/progreso_evaluaciones?${query.toString()}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: 'no-store',
    })
    if (!response.ok) return NextResponse.json({ error: 'No se pudo consultar el progreso' }, { status: 502 })
    return NextResponse.json({ data: await response.json() })
  } catch (error) {
    console.error('Error consultando progreso-evaluacion:', error)
    return NextResponse.json({ error: 'Error interno consultando el progreso' }, { status: 500 })
  }
}