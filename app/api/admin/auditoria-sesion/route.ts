import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'

export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const testId = url.searchParams.get('test_id')
    const sesionId = url.searchParams.get('sesion_id')
    if (!testId || !sesionId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

    const db = createSupabaseAdmin()

    // La sesion se busca siempre: para el viewer valida el proceso, y para el registro de accesos
    // hace falta saber de que candidato son las respuestas que se estan abriendo.
    const { data: sesion } = await db.from('sesiones').select('candidato_id, proceso_id').eq('id', sesionId).maybeSingle()
    if (auth.role === 'viewer') {
      if (!sesion?.proceso_id || !auth.allowedProcesoIds.includes(sesion.proceso_id)) {
        return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
      }
    }

    const [{ data: items, error: itemsError }, { data: respuestas, error: respuestasError }] = await Promise.all([
      db.from('items').select('*').eq('test_id', testId).order('orden'),
      db.from('respuestas').select('*').eq('sesion_id', sesionId),
    ])
    if (itemsError || respuestasError) throw itemsError || respuestasError

    if (sesion) await registrarAcceso(db, auth, { accion: 'ver_respuestas_sesion', candidatoId: sesion.candidato_id, procesoId: sesion.proceso_id }, req)
    return NextResponse.json({ items: items || [], respuestas: respuestas || [] })
  } catch (error) {
    console.error('[admin/auditoria-sesion GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar la auditoría de la sesión' }, { status: 500 })
  }
}
