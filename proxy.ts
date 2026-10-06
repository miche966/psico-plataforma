import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decidirAccesoApi } from '@/lib/server/rutasApi'
import { mfaObligatorio } from '@/lib/server/mfa'
import { construirCsp, generarNonce, modoCsp, RUTA_INFORMES_CSP } from '@/lib/server/csp'

/**
 * Denegar por defecto en /api: solo las rutas declaradas en lib/server/rutasApi.ts se pueden llamar sin
 * sesion de administrador; todo lo demas exige un token de sesion con forma valida. Es una segunda barrera:
 * cada ruta sigue verificando la sesion contra Supabase Auth (requireAdminSession), asi que una ruta nueva
 * a la que se le olvide esa llamada igual rechaza a quien no esta logueado.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/api' || pathname.startsWith('/api/')) return protegerApi(request)
  return politicaDeContenido(request)
}

function protegerApi(request: NextRequest) {
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

/**
 * Paginas: segun CSP_MODO (ver lib/server/csp.ts). En 'vigente' no hace nada. Con nonce, genera uno por visita, se lo pasa
 * a Next (cabecera de PETICION Content-Security-Policy: de ahi lo lee para poner el atributo nonce en sus scripts) y publica
 * la politica estricta en la RESPUESTA: bloqueando en 'estricta', solo como informe en 'informe'.
 */
function politicaDeContenido(request: NextRequest) {
  const modo = modoCsp()
  if (modo === 'vigente') return NextResponse.next()
  const nonce = generarNonce()
  const estricta = construirCsp({ dev: process.env.NODE_ENV !== 'production', nonce, reportUri: RUTA_INFORMES_CSP })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', estricta)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(modo === 'estricta' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', estricta)
  return response
}

export const config = {
  matcher: [
    '/api/:path*',
    // Paginas: sin archivos estaticos ni precargas de next/link (no necesitan nonce)
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
