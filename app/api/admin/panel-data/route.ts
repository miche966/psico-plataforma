import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

async function readAll(db: any, table: string, select: string, orderBy?: string) {
  const rows: any[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from(table).select(select).range(offset, offset + pageSize - 1)
    if (orderBy) query = query.order(orderBy, { ascending: false })
    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}

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
      readAll(db, 'preguntas_video', 'id, entrevista_id')
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