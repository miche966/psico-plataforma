import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { readAll } from '@/lib/server/readAll'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response

    const db = createSupabaseAdmin()
    const [candidatos, procesos, sesiones, respuestasVideo, preguntasVideo] = await Promise.all([
      readAll(db, 'candidatos', '*', 'creado_en'),
      readAll(db, 'procesos', '*', 'creado_en'),
      readAll(db, 'sesiones', '*, procesos (id, nombre, cargo, competencias_requeridas, bateria_tests)', 'finalizada_en'),
      readAll(db, 'respuestas_video', '*', 'grabada_en'),
      readAll(db, 'preguntas_video', 'id, entrevista_id, pregunta')
    ])

    let progresoOperativo: any[] = []
    try {
      progresoOperativo = await readAll(db, 'progreso_evaluaciones', '*', 'ultima_actividad_en')
    } catch {
      progresoOperativo = []
    }

    return NextResponse.json({
      candidatos,
      procesos,
      sesiones,
      respuestasVideo,
      preguntasVideo,
      progresoOperativo
    })
  } catch (error: any) {
    console.error('Error cargando datos administrativos del panel:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos administrativos' }, { status: 500 })
  }
}