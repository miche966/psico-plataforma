import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const testId = url.searchParams.get('test_id')
    const sesionId = url.searchParams.get('sesion_id')
    if (!testId || !sesionId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

    const db = createSupabaseAdmin()
    const [{ data: items, error: itemsError }, { data: respuestas, error: respuestasError }] = await Promise.all([
      db.from('items').select('*').eq('test_id', testId).order('orden'),
      db.from('respuestas').select('*').eq('sesion_id', sesionId),
    ])
    if (itemsError || respuestasError) throw itemsError || respuestasError

    return NextResponse.json({ items: items || [], respuestas: respuestas || [] })
  } catch (error) {
    console.error('[admin/auditoria-sesion GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar la auditoría de la sesión' }, { status: 500 })
  }
}
