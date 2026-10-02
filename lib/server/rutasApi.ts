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

import { decodificarPayloadJwt } from './jwtPlano.ts'
import { cumpleMfa } from './mfa.ts'

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

/**
 * Rutas de administracion que se pueden llamar con una sesion que todavia esta en 'aal1' (solo contrasena)
 * aunque el 2FA sea obligatorio: la pantalla las usa para saber que rol tiene la cuenta y a donde mandarla
 * (verificar el codigo o enrolar el dispositivo). No devuelven datos de candidatos.
 */
export const RUTAS_API_ADMIN_AAL1 = ['/api/admin/whoami']

export function permiteAal1(pathname: string): boolean {
  return RUTAS_API_ADMIN_AAL1.includes(normalizarRutaApi(pathname))
}

export type DecisionApi = 'permitir' | 'sesion_requerida' | 'mfa_requerido'

/**
 * Decision del proxy para una solicitud a /api (pura, para poder testearla):
 * publica -> pasa; preflight -> pasa; sin sesion con forma valida -> 401; con el 2FA obligatorio y la sesion en
 * 'aal1' -> 401 mfa_requerido (salvo las rutas de RUTAS_API_ADMIN_AAL1).
 */
export function decidirAccesoApi(entrada: { pathname: string; metodo: string; authorization: string | null; mfaObligatorio: boolean; ahoraSegundos?: number }): DecisionApi {
  if (esRutaApiPublica(entrada.pathname, entrada.metodo)) return 'permitir'
  if (entrada.metodo.toUpperCase() === 'OPTIONS') return 'permitir'
  if (!tokenAdminPlausible(entrada.authorization, entrada.ahoraSegundos)) return 'sesion_requerida'
  if (!permiteAal1(entrada.pathname) && !cumpleMfa(entrada.authorization, entrada.mfaObligatorio)) return 'mfa_requerido'
  return 'permitir'
}
