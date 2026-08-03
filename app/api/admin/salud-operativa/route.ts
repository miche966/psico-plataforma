import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { readAll } from '@/lib/server/readAll'

export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response

  try {
    const db = createSupabaseAdmin()
    const [sesionesPendientesRaw, recordatorios, progresoProblemas] = await Promise.all([
      db.from('sesiones')
        .select('candidato_id, proceso_id, test_id, candidatos (nombre, apellido, email), procesos (nombre, cargo, activo)')
        .eq('estado', 'pendiente'),
      readAll(db, 'recordatorios_evaluacion', 'candidato_id, proceso_id, estado, enviado_en', 'enviado_en'),
      db.from('progreso_evaluaciones')
        .select('candidato_id, proceso_id, evaluacion_key, estado, ultima_actividad_en, ultimo_error, candidatos (nombre, apellido, email)')
        .in('estado', ['pausada', 'error', 'vencida'])
        .order('ultima_actividad_en', { ascending: false }),
    ])

    if (sesionesPendientesRaw.error) throw sesionesPendientesRaw.error
    if (progresoProblemas.error) throw progresoProblemas.error

    const ultimoRecordatorioPorPar = new Map<string, any>()
    recordatorios.forEach((r: any) => {
      const key = `${r.candidato_id}|${r.proceso_id}`
      const actual = ultimoRecordatorioPorPar.get(key)
      if (!actual || new Date(r.enviado_en).getTime() > new Date(actual.enviado_en).getTime()) {
        ultimoRecordatorioPorPar.set(key, r)
      }
    })

    const sesionesPendientes = (sesionesPendientesRaw.data || []).map((s: any) => ({
      candidato_id: s.candidato_id,
      proceso_id: s.proceso_id,
      test_id: s.test_id,
      candidato_nombre: s.candidatos ? `${s.candidatos.nombre || ''} ${s.candidatos.apellido || ''}`.trim() : '',
      candidato_email: s.candidatos?.email || '',
      proceso_nombre: s.procesos?.cargo || s.procesos?.nombre || '',
      proceso_activo: s.procesos?.activo ?? null,
      ultimo_recordatorio: ultimoRecordatorioPorPar.get(`${s.candidato_id}|${s.proceso_id}`) || null,
    }))

    return NextResponse.json({
      sesionesPendientes,
      progresoProblemas: progresoProblemas.data || [],
    })
  } catch (error) {
    console.error('[admin/salud-operativa GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar la salud operativa' }, { status: 500 })
  }
}
