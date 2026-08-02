import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const db = createSupabaseAdmin()
    const procesoId = new URL(req.url).searchParams.get('proceso_id')
    if (procesoId) {
      const [{ data: sesiones, error: sesionesError }, { data: candidatos, error: candidatosError }, { data: respuestasVideo, error: videosError }, { data: preguntasVideo, error: preguntasError }] = await Promise.all([
        db.from('sesiones').select('candidato_id, test_id, estado').eq('proceso_id', procesoId).not('candidato_id', 'is', null),
        db.from('candidatos').select('id, nombre, apellido, email'),
        db.from('respuestas_video').select('candidato_id, entrevista_id, pregunta_id').eq('estado', 'completado'),
        db.from('preguntas_video').select('id, entrevista_id')
      ])
      if (sesionesError || candidatosError || videosError || preguntasError) throw sesionesError || candidatosError || videosError || preguntasError
      return NextResponse.json({ sesiones: sesiones || [], candidatos: candidatos || [], respuestasVideo: respuestasVideo || [], preguntasVideo: preguntasVideo || [] })
    }
    const [{ data, error }, { data: candidatos, error: candidatosError }, { data: entrevistas, error: entrevistasError }] = await Promise.all([
      db.from('procesos').select('*').order('creado_en', { ascending: false }),
      db.from('candidatos').select('id, nombre, apellido, email').order('creado_en', { ascending: false }),
      db.from('entrevistas_video').select('*').order('creada_en', { ascending: false })
    ])
    if (error || candidatosError || entrevistasError) throw error || candidatosError || entrevistasError
    return NextResponse.json({ data: data || [], candidatos: candidatos || [], entrevistas: entrevistas || [] })
  } catch (error) {
    console.error('Error cargando procesos administrativos:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los procesos' }, { status: 500 })
  }
}