import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id de entrevista' }, { status: 400 })

  try {
    const db = createSupabaseAdmin()
    const [{ data: entrevista, error: entrevistaError }, { data: preguntas, error: preguntasError }, { data: respuestas, error: respuestasError }] = await Promise.all([
      db.from('entrevistas_video').select('*').eq('id', id).single(),
      db.from('preguntas_video').select('*').eq('entrevista_id', id).order('orden'),
      db.from('respuestas_video').select('*').eq('entrevista_id', id).eq('estado', 'completado').order('grabada_en', { ascending: false })
    ])
    if (entrevistaError) throw entrevistaError
    if (preguntasError) throw preguntasError
    if (respuestasError) throw respuestasError

    const ids = [...new Set((respuestas || []).map((r: any) => r.candidato_id).filter(Boolean))]
    let candidatos: any[] = []
    if (ids.length) {
      const result = await db.from('candidatos').select('id, nombre, apellido, email').in('id', ids)
      if (result.error) throw result.error
      candidatos = result.data || []
    }
    const respuestasConCandidato = (respuestas || []).map((r: any) => ({
      ...r,
      candidato: candidatos.find(c => c.id === r.candidato_id)
    }))
    return NextResponse.json({ entrevista, preguntas: preguntas || [], respuestas: respuestasConCandidato })
  } catch (error) {
    console.error('[admin/entrevista-video]', error)
    return NextResponse.json({ error: 'No se pudo cargar la entrevista' }, { status: 500 })
  }
}

function aplicarPrefijo(texto: string, perfil: string) {
  const limpio = String(texto || '').trim().replace(/^\[CON_EXP\]\s*|^\[SIN_EXP\]\s*|^\[GENERAL\]\s*/i, '')
  return perfil === 'sin_experiencia' ? `[SIN_EXP] ${limpio}` : `[CON_EXP] ${limpio}`
}

export async function POST(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const db = createSupabaseAdmin()

    if (action === 'listar') {
      const { data, error } = await db.from('entrevistas_video').select('*').order('creada_en', { ascending: false })
      if (error) {
        const fallback = await db.from('entrevistas_video').select('*')
        if (fallback.error) throw fallback.error
        return NextResponse.json({ entrevistas: fallback.data || [] })
      }
      return NextResponse.json({ entrevistas: data || [] })
    }

    if (action === 'crear_entrevista') {
      const nombre = String(body.nombre || '').trim()
      if (!nombre) return NextResponse.json({ error: 'Falta el nombre de la entrevista' }, { status: 400 })
      const { data, error } = await db.from('entrevistas_video').insert({ nombre }).select().single()
      if (error) throw error
      return NextResponse.json({ entrevista: data })
    }

    if (action === 'renombrar_entrevista') {
      const entrevistaId = String(body.entrevistaId || '')
      const nombre = String(body.nombre || '').trim()
      if (!entrevistaId || !nombre) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
      const { error } = await db.from('entrevistas_video').update({ nombre }).eq('id', entrevistaId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'eliminar_entrevista') {
      const entrevistaId = String(body.entrevistaId || '')
      if (!entrevistaId) return NextResponse.json({ error: 'Falta id de entrevista' }, { status: 400 })
      await db.from('preguntas_video').delete().eq('entrevista_id', entrevistaId)
      const { error } = await db.from('entrevistas_video').delete().eq('id', entrevistaId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'crear_pregunta') {
      const entrevistaId = String(body.entrevistaId || '')
      const pregunta = String(body.pregunta || '').trim()
      const tiempoPreparacion = parseInt(body.tiempoPreparacion)
      const tiempoRespuesta = parseInt(body.tiempoRespuesta)
      const perfil = String(body.perfil || '')
      if (!entrevistaId || !pregunta) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
      const { count } = await db.from('preguntas_video').select('id', { count: 'exact', head: true }).eq('entrevista_id', entrevistaId)
      const { error } = await db.from('preguntas_video').insert({
        entrevista_id: entrevistaId,
        orden: (count || 0) + 1,
        pregunta: aplicarPrefijo(pregunta, perfil),
        tiempo_preparacion: tiempoPreparacion,
        tiempo_respuesta: tiempoRespuesta
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'actualizar_pregunta') {
      const preguntaId = String(body.preguntaId || '')
      const pregunta = String(body.pregunta || '').trim()
      const tiempoPreparacion = parseInt(body.tiempoPreparacion)
      const tiempoRespuesta = parseInt(body.tiempoRespuesta)
      const perfil = String(body.perfil || '')
      if (!preguntaId || !pregunta) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
      const { error } = await db.from('preguntas_video').update({
        pregunta: aplicarPrefijo(pregunta, perfil),
        tiempo_preparacion: tiempoPreparacion,
        tiempo_respuesta: tiempoRespuesta
      }).eq('id', preguntaId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'eliminar_pregunta') {
      const preguntaId = String(body.preguntaId || '')
      if (!preguntaId) return NextResponse.json({ error: 'Falta id de pregunta' }, { status: 400 })
      const { error } = await db.from('preguntas_video').delete().eq('id', preguntaId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'mover_pregunta') {
      const id1 = String(body.id1 || '')
      const orden1 = body.orden1
      const id2 = String(body.id2 || '')
      const orden2 = body.orden2
      if (!id1 || !id2 || typeof orden1 !== 'number' || typeof orden2 !== 'number') {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
      }
      const { error: err1 } = await db.from('preguntas_video').update({ orden: orden2 }).eq('id', id1)
      const { error: err2 } = await db.from('preguntas_video').update({ orden: orden1 }).eq('id', id2)
      if (err1 || err2) throw err1 || err2
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error) {
    console.error('[admin/entrevista-video POST]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 })
  }
}
