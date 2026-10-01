import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await createSupabaseAdmin()
    .from('sesiones')
    .select('*', { count: 'exact', head: true })
    .gt('finalizada_en', hace24h)

  return NextResponse.json({ novedades: count ?? 0 })
}
