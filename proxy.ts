import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decidirAccesoApi } from '@/lib/server/rutasApi'
import { mfaObligatorio } from '@/lib/server/mfa'

/**
 * Denegar por defecto en /api: solo las rutas declaradas en lib/server/rutasApi.ts se pueden llamar sin
 * sesion de administrador; todo lo demas exige un token de sesion con forma valida. Es una segunda barrera:
 * cada ruta sigue verificando la sesion contra Supabase Auth (requireAdminSession), asi que una ruta nueva
 * a la que se le olvide esa llamada igual rechaza a quien no esta logueado.
 */
export function proxy(request: NextRequest) {
  const decision = decidirAccesoApi({
    pathname: request.nextUrl.pathname,
    metodo: request.method,
    authorization: request.headers.get('authorization'),
    mfaObligatorio: mfaObligatorio(),
  })
  if (decision === 'permitir') return NextResponse.next()
  if (decision === 'mfa_requerido') return NextResponse.json({ error: 'Se requiere verificación en dos pasos', codigo: 'mfa_requerido' }, { status: 401 })
  return NextResponse.json({ error: 'Sesion administrativa requerida' }, { status: 401 })
}

export const config = {
  matcher: '/api/:path*',
}
