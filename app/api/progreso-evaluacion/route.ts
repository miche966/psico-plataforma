import { NextResponse } from 'next/server'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { requireAdminSession } from '@/lib/server/adminAuth'

const ESTADOS = new Set(['pendiente', 'en_curso', 'pausada', 'completada', 'error', 'vencida'])

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const candidato_id = String(body.candidato_id || '')
    const proceso_id = String(body.proceso_id || '')
    const token = String(body.token || '')
    const evaluacion_key = String(body.evaluacion_key || '')
    const estado = String(body.estado || 'en_curso')
    if (!candidato_id || !proceso_id || !token || !evaluacion_key || !ESTADOS.has(estado)) {
      return NextResponse.json({ error: 'Datos de progreso incompletos' }, { status: 400 })
    }
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
        ...(body.pregunta_actual !== undefined ? { pregunta_actual: body.pregunta_actual } : {}),
        ...(body.total_preguntas !== undefined ? { total_preguntas: body.total_preguntas } : {}),
        ...(body.respuestas_completadas !== undefined ? { respuestas_completadas: Number(body.respuestas_completadas) } : {}),
        ...(body.iniciada_en ? { iniciada_en: body.iniciada_en } : {}),
        ...(body.completada_en ? { completada_en: body.completada_en } : {}),
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
    const query = new URLSearchParams({ select: '*', order: 'ultima_actividad_en.desc.nullslast' })
    if (url.searchParams.get('candidato_id')) query.set('candidato_id', `eq.${url.searchParams.get('candidato_id')}`)
    if (url.searchParams.get('proceso_id')) query.set('proceso_id', `eq.${url.searchParams.get('proceso_id')}`)
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