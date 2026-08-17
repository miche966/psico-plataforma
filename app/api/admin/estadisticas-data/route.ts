import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { candidatoIdsEnProcesos } from '@/lib/server/procesoScope'

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
    let [procesos, vinculos, respuestasVideo, candidatos, sesiones] = await Promise.all([
      readAll<any>(db.from('procesos').select('*').order('creado_en', { ascending: false })),
      readAll<any>(db.from('candidatos_procesos').select('candidato_id, proceso_id')),
      readAll<any>(db.from('respuestas_video').select('candidato_id, id')),
      readAll<any>(db.from('candidatos').select('id, nombre, apellido, email')),
      readAll<any>(db.from('sesiones').select('*'))
    ])

    if (auth.role === 'viewer') {
      const procesosPermitidos = new Set(auth.allowedProcesoIds)
      procesos = procesos.filter(p => procesosPermitidos.has(p.id))
      vinculos = vinculos.filter(v => procesosPermitidos.has(v.proceso_id))
      sesiones = sesiones.filter(s => s.proceso_id && procesosPermitidos.has(s.proceso_id))
      const idsCandidatos = await candidatoIdsEnProcesos(db, auth.allowedProcesoIds)
      candidatos = candidatos.filter(c => idsCandidatos.has(c.id))
      respuestasVideo = respuestasVideo.filter(r => idsCandidatos.has(r.candidato_id))
    }

    return NextResponse.json({ procesos, vinculos, respuestasVideo, candidatos, sesiones })
  } catch (error) {
    console.error('[admin/estadisticas-data]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las estadísticas' }, { status: 500 })
  }
}
