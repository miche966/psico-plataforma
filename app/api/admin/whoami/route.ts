import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { requireSupervisorSession } from '@/lib/server/supervisorAuth'
import { mfaObligatorio } from '@/lib/server/mfa'

export async function GET(request: Request) {
  // Admite una sesion 'aal1' (solo contrasena): la pantalla la usa para saber si tiene que verificar el 2FA
  const auth = await requireAdminSession(request, { permitirAal1: true })

  // mfaRequerido: la pantalla decide si mandar a verificar el codigo (o a enrolar el 2FA) antes de seguir
  const mfaRequerido = mfaObligatorio()

  if (auth.response) {
    // Un supervisor no es administrador (recibe 403 aca): se le avisa su rol para que la pantalla lo mande a su panel
    if (auth.response.status === 403) {
      const supervisor = await requireSupervisorSession(request, { permitirAal1: true })
      if (!supervisor.response) return NextResponse.json({ role: supervisor.role, allowedProcesoIds: null, mfaRequerido })
    }
    return auth.response
  }

  if (auth.role === 'viewer') {
    return NextResponse.json({ role: auth.role, allowedProcesoIds: auth.allowedProcesoIds, mfaRequerido })
  }
  return NextResponse.json({ role: auth.role, allowedProcesoIds: null, mfaRequerido })
}
