import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

async function readAll<T>(query: any): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  const size = 1000
  while (true) {
    const { data, error } = await query.range(from, from + size - 1)
    if (error) throw error
    rows.push(...((data || []) as T[]))
    if (!data || data.length < size) return rows
    from += size
  }
}

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response

  try {
    const db = createSupabaseAdmin()
    const [procesos, vinculos, respuestasVideo, candidatos, sesiones] = await Promise.all([
      readAll(db.from('procesos').select('*').order('creado_en', { ascending: false })),
      readAll(db.from('candidatos_procesos').select('candidato_id, proceso_id')),
      readAll(db.from('respuestas_video').select('candidato_id, id')),
      readAll(db.from('candidatos').select('id, nombre, apellido, email')),
      readAll(db.from('sesiones').select('*'))
    ])
    return NextResponse.json({ procesos, vinculos, respuestasVideo, candidatos, sesiones })
  } catch (error) {
    console.error('[admin/estadisticas-data]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las estadísticas' }, { status: 500 })
  }
}
