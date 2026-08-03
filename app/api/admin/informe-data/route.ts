import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const id = new URL(req.url).searchParams.get('candidato_id')
    if (!id) return NextResponse.json({ error: 'Candidato obligatorio' }, { status: 400 })

    const db = createSupabaseAdmin()
    const { data: candidato, error: candidatoError } = await db.from('candidatos').select('*').eq('id', id).single()
    if (candidatoError || !candidato) return NextResponse.json({ error: 'Candidato no encontrado' }, { status: 404 })

    const { data: sesiones, error: sesionesError } = await db.from('sesiones').select('*').eq('candidato_id', id).order('finalizada_en', { ascending: false })
    if (sesionesError) throw sesionesError
    const lista = sesiones || []
    const procesoId = candidato.proceso_id || lista.find(s => s.proceso_id)?.proceso_id || null

    let proceso = null
    if (procesoId) {
      const { data, error } = await db.from('procesos').select('*').eq('id', procesoId).single()
      if (error) throw error
      proceso = data
    }

    const { data: videos, error: videosError } = await db.from('respuestas_video').select('*').eq('candidato_id', id).eq('estado', 'completado')
    if (videosError) throw videosError

    const listaVideos = videos || []
    const pregIds = Array.from(new Set(listaVideos.map(v => v.pregunta_id).filter(Boolean)))
    if (pregIds.length > 0) {
      const { data: pregsData, error: pregsError } = await db.from('preguntas_video').select('id, pregunta').in('id', pregIds)
      if (pregsError) throw pregsError
      const pregMap = new Map((pregsData || []).map(p => [p.id, p.pregunta]))
      listaVideos.forEach(v => { v.preguntas_video = { pregunta: pregMap.get(v.pregunta_id) } })
    }

    return NextResponse.json({ candidato, sesiones: lista, proceso, videos: listaVideos })
  } catch (error) {
    console.error('Error cargando datos administrativos del informe:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos del informe' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const body = await req.json()
    if (!body.candidato_id || !body.contenido || JSON.stringify(body.contenido).length > 500000) {
      return NextResponse.json({ error: 'Datos de informe inválidos' }, { status: 400 })
    }
    const db = createSupabaseAdmin()
    const { error } = await db.from('informes_psicometricos').upsert({
      candidato_id: body.candidato_id,
      contenido: body.contenido,
      actualizado_en: new Date().toISOString()
    }, { onConflict: 'candidato_id' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error guardando informe administrativo:', error)
    return NextResponse.json({ error: 'No se pudo guardar el informe' }, { status: 500 })
  }
}