/**
 * Rutas /api que se pueden llamar SIN sesion de administrador, y por que.
 *
 * Es la lista de excepciones de la politica "denegar por defecto" que aplica proxy.ts: cualquier otra
 * ruta /api exige un token de sesion de administrador con forma valida, asi que una ruta nueva (o un
 * metodo nuevo) queda cerrada hasta que alguien la declare aca a proposito. tests/rutas-api.test.ts
 * recorre app/api y falla si una ruta no esta clasificada o si una publica no tiene su mecanismo propio.
 *
 * Modulo puro (sin next/server) para poder usarlo desde el proxy y desde los tests.
 */

export interface RutaPublica {
  /** Metodos HTTP abiertos sin sesion de administrador; el resto de los metodos de esa ruta exige sesion */
  metodos: string[]
  /** Que protege la ruta en lugar de la sesion de administrador */
  mecanismo: string
  /** Texto que tiene que aparecer en el codigo de la ruta (lo verifica el test): evita declararla publica sin proteccion real */
  marcador: string
}

export const RUTAS_API_PUBLICAS: Record<string, RutaPublica> = {
  '/api/login': { metodos: ['POST'], mecanismo: 'usuario y clave de Supabase Auth, con bloqueo por intentos', marcador: 'rlLogin' },
  '/api/forgot-password': { metodos: ['POST'], mecanismo: 'limite de intentos por IP y por email; responde igual exista o no la cuenta', marcador: 'rlRecuperacion' },
  '/api/unirse': { metodos: ['GET', 'POST'], mecanismo: 'POST: Cloudflare Turnstile verificado en el servidor + limite de intentos; GET: lista publica a proposito de las busquedas activas (id, nombre, cargo)', marcador: 'verificarTurnstile' },
  '/api/evaluacion-access': { metodos: ['POST'], mecanismo: 'token HMAC del enlace del candidato', marcador: 'validarTokenEvaluacion' },
  '/api/evaluacion/public-data': { metodos: ['GET', 'POST'], mecanismo: 'token HMAC del enlace del candidato', marcador: 'validarTokenEvaluacion' },
  '/api/entrevista-video/candidato': { metodos: ['GET', 'POST'], mecanismo: 'token HMAC del enlace del candidato', marcador: 'validarTokenEvaluacion' },
  '/api/r2-presigned': { metodos: ['POST'], mecanismo: 'token HMAC del enlace del candidato', marcador: 'validarTokenEvaluacion' },
  '/api/supabase-presigned': { metodos: ['POST'], mecanismo: 'token HMAC del enlace del candidato', marcador: 'validarTokenEvaluacion' },
  '/api/roleplay': { metodos: ['POST'], mecanismo: 'token HMAC del enlace del candidato', marcador: 'validarTokenEvaluacion' },
  '/api/analizar-video': { metodos: ['POST'], mecanismo: 'token HMAC del candidato, o sesion de administrador', marcador: 'validarTokenEvaluacion' },
  '/api/progreso-evaluacion': { metodos: ['POST'], mecanismo: 'token HMAC del enlace del candidato (el GET es solo para administradores)', marcador: 'validarTokenEvaluacion' },
}

export function normalizarRutaApi(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

export function esRutaApiPublica(pathname: string, metodo: string): boolean {
  const ruta = RUTAS_API_PUBLICAS[normalizarRutaApi(pathname)]
  return Boolean(ruta && ruta.metodos.includes(metodo.toUpperCase()))
}

function decodificarPayloadJwt(token: string): Record<string, unknown> | null {
  const partes = token.split('.')
  if (partes.length !== 3 || partes.some(p => !p)) return null
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    const payload = JSON.parse(json)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

/**
 * Filtro barato (sin red ni firma) para el proxy: el encabezado debe traer un JWT de un usuario
 * autenticado y no vencido. Deja afuera a quien no manda nada, manda basura, un token vencido o la
 * clave anonima publica (rol "anon"). NO verifica la firma: eso lo hace cada ruta con requireAdminSession
 * contra Supabase Auth, asi que este filtro nunca reemplaza esa verificacion.
 */
export function tokenAdminPlausible(authorization: string | null, ahoraSegundos = Math.floor(Date.now() / 1000)): boolean {
  if (!authorization || !authorization.startsWith('Bearer ')) return false
  const payload = decodificarPayloadJwt(authorization.slice('Bearer '.length).trim())
  if (!payload) return false
  return payload.role === 'authenticated' && typeof payload.exp === 'number' && payload.exp > ahoraSegundos
}
