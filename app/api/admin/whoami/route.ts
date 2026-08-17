import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response

  if (auth.role === 'viewer') {
    return NextResponse.json({ role: auth.role, allowedProcesoIds: auth.allowedProcesoIds })
  }
  return NextResponse.json({ role: auth.role, allowedProcesoIds: null })
}
