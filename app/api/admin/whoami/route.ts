import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { mfaObligatorio } from '@/lib/server/mfa'

export async function GET(request: Request) {
  // Admite una sesion 'aal1' (solo contrasena): la pantalla la usa para saber si tiene que verificar el 2FA
  const auth = await requireAdminSession(request, { permitirAal1: true })
  if (auth.response) return auth.response

  // mfaRequerido: la pantalla decide si mandar a verificar el codigo (o a enrolar el 2FA) antes de seguir
  const mfaRequerido = mfaObligatorio()
  if (auth.role === 'viewer') {
    return NextResponse.json({ role: auth.role, allowedProcesoIds: auth.allowedProcesoIds, mfaRequerido })
  }
  return NextResponse.json({ role: auth.role, allowedProcesoIds: null, mfaRequerido })
}
