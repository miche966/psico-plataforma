import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Las funciones serverless de Vercel no comparten memoria entre ejecuciones, así que un contador
// en memoria no protege nada en producción -- el estado tiene que vivir en un almacén externo
// compartido. Se usa Upstash Redis (plan gratuito) en vez de una tabla de Supabase para no sumarle
// más carga de escritura a un proyecto que ya viene ajustado de cuota.
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null

// Endpoints accesibles con un link de evaluación (token), sin sesión de admin -- el roleplay y el
// análisis de video. 20 coincide con maxTurnos del roleplay: generoso para un candidato real,
// corta un loop scripteado.
export const rlEvaluacion = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), prefix: 'rl:evaluacion' }) : null

// Endpoints solo accesibles con sesión de admin (generar-informe, analizar-frases, ia-summary).
// No es una barrera de seguridad estricta -- el riesgo ahí es un loop accidental del frontend,
// no abuso externo.
export const rlAdmin = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'rl:admin' }) : null

// /api/unirse: público por diseño, sin token, así que se limita por IP.
export const rlPublico = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 s'), prefix: 'rl:publico' }) : null

/**
 * Chequea el límite para una clave dada. Si Upstash no está configurado o falla, deja pasar
 * (fail-open) con un warning -- esta es una capa de seguridad secundaria, no se quiere tumbar
 * la plataforma completa por una caída de un servicio de terceros.
 */
export async function verificarLimite(ratelimit: Ratelimit | null, clave: string): Promise<{ permitido: boolean; restante: number }> {
  if (!ratelimit) {
    console.warn('[RATE LIMIT] UPSTASH_REDIS_REST_URL/TOKEN no configurados, se omite el chequeo.')
    return { permitido: true, restante: -1 }
  }
  try {
    const { success, remaining } = await ratelimit.limit(clave)
    return { permitido: success, restante: remaining }
  } catch (err) {
    console.error('[RATE LIMIT] Error consultando Upstash, se deja pasar la solicitud:', err)
    return { permitido: true, restante: -1 }
  }
}

export function respuestaLimiteExcedido() {
  return { error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.' }
}
