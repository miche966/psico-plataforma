import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decidirAccesoApi } from '@/lib/server/rutasApi'
import { mfaObligatorio } from '@/lib/server/mfa'
import { construirCsp, generarNonce, RUTA_INFORMES_CSP } from '@/lib/server/csp'

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
 * Paginas: genera el nonce de la visita y publica la CSP ESTRICTA solo como informe (Content-Security-Policy-Report-Only):
 * no bloquea nada (la politica vigente de next.config.ts sigue siendo la que aplica) pero Next toma el nonce de esta
 * cabecera para poner el atributo nonce en sus scripts, y los navegadores informan a /api/csp-report todo lo que la
 * politica estricta bloquearia. Ver lib/server/csp.ts.
 */
function politicaDeContenido(request: NextRequest) {
  const nonce = generarNonce()
  const csp = construirCsp({ dev: process.env.NODE_ENV !== 'production', nonce, reportUri: RUTA_INFORMES_CSP })
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Solo para que Next extraiga el nonce y lo ponga en sus scripts: un encabezado de PETICION no es una politica para el
  // navegador. Se usa el nombre estandar porque en Vercel el nombre "-Report-Only" no llegaba al renderizador (los scripts
  // salian sin nonce). Lo que ve el navegador es el encabezado de RESPUESTA, que sigue siendo solo informe.
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy-Report-Only', csp)
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
