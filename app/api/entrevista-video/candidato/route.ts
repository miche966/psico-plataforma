import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'

function tokenValido(candidatoId: string, procesoId: string, token: string) {
  if (!candidatoId || !procesoId || !token) return true
  return validarTokenEvaluacion(token, candidatoId, procesoId)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const entrevistaId = url.searchParams.get('entrevista') || ''
    const candidatoId = url.searchParams.get('candidato') || ''
    const procesoId = url.searchParams.get('proceso') || ''
    const token = url.searchParams.get('token') || ''

    if (!entrevistaId) return NextResponse.json({ error: 'Falta id de entrevista' }, { status: 400 })
    if (!tokenValido(candidatoId, procesoId, token)) {
      return NextResponse.json({ error: 'Enlace de evaluación inválido o vencido' }, { status: 401 })
    }

    const db = createSupabaseAdmin()
    const [{ data: entrevista, error: entrevistaError }, { data: preguntas, error: preguntasError }] = await Promise.all([
      db.from('entrevistas_video').select('*').eq('id', entrevistaId).single(),
      db.from('preguntas_video').select('*').eq('entrevista_id', entrevistaId).order('orden')
    ])
    if (entrevistaError) throw entrevistaError
    if (preguntasError) throw preguntasError

    let candidato = null
    if (candidatoId) {
      const { data } = await db.from('candidatos').select('nombre, apellido').eq('id', candidatoId).single()
      candidato = data
    }

    return NextResponse.json({ entrevista, preguntas: preguntas || [], candidato })
  } catch (error) {
    console.error('[entrevista-video/candidato GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar la entrevista' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const candidatoId = String(body.candidatoId || '')
    const procesoId = String(body.procesoId || '')
    const token = String(body.token || '')

    if (!tokenValido(candidatoId, procesoId, token)) {
      return NextResponse.json({ error: 'Enlace de evaluación inválido o vencido' }, { status: 401 })
    }

    if (action === 'guardar_respuesta') {
      const entrevistaId = String(body.entrevistaId || '')
      const preguntaId = String(body.preguntaId || '')
      const duracion = body.duracion
      if (!entrevistaId || !preguntaId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

      const db = createSupabaseAdmin()

      if (body.exito) {
        const urlVideo = String(body.urlVideo || '')
        const { data, error } = await db.from('respuestas_video').insert({
          pregunta_id: preguntaId,
          candidato_id: candidatoId || null,
          entrevista_id: entrevistaId,
          url_video: urlVideo,
          duracion,
          estado: 'completado'
        }).select('id').single()
        if (error) throw error
        return NextResponse.json({ respuesta: data })
      }

      const logs = String(body.logs || '')
      const extraData = body.extraData && typeof body.extraData === 'object' ? body.extraData : {}
      const { error } = await db.from('respuestas_video').insert({
        pregunta_id: preguntaId,
        candidato_id: candidatoId || null,
        entrevista_id: entrevistaId,
        url_video: null,
        duracion,
        estado: 'error_upload',
        transcripcion: logs,
        analisis: extraData
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error) {
    console.error('[entrevista-video/candidato POST]', error)
    return NextResponse.json({ error: 'No se pudo guardar la respuesta' }, { status: 500 })
  }
}
