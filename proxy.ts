import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { esRutaApiPublica, tokenAdminPlausible } from '@/lib/server/rutasApi'

/**
 * Denegar por defecto en /api: solo las rutas declaradas en lib/server/rutasApi.ts se pueden llamar sin
 * sesion de administrador; todo lo demas exige un token de sesion con forma valida. Es una segunda barrera:
 * cada ruta sigue verificando la sesion contra Supabase Auth (requireAdminSession), asi que una ruta nueva
 * a la que se le olvide esa llamada igual rechaza a quien no esta logueado.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (esRutaApiPublica(pathname, request.method)) return NextResponse.next()
  // El preflight CORS no lleva credenciales; las rutas no responden CORS, asi que no se abre nada por dejarlo pasar
  if (request.method === 'OPTIONS') return NextResponse.next()
  if (tokenAdminPlausible(request.headers.get('authorization'))) return NextResponse.next()
  return NextResponse.json({ error: 'Sesion administrativa requerida' }, { status: 401 })
}

export const config = {
  matcher: '/api/:path*',
}
