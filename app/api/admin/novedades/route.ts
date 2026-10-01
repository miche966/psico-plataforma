import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response

  if (auth.role === 'viewer' && auth.allowedProcesoIds.length === 0) {
    return NextResponse.json({ novedades: 0 })
  }

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let consulta = createSupabaseAdmin()
    .from('sesiones')
    .select('*', { count: 'exact', head: true })
    .gt('finalizada_en', hace24h)
  if (auth.role === 'viewer') consulta = consulta.in('proceso_id', auth.allowedProcesoIds)
  const { count } = await consulta

  return NextResponse.json({ novedades: count ?? 0 })
}
