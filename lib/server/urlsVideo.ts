/**
 * Claves de los videos de entrevista a partir de la URL que se guarda en respuestas_video.url_video.
 *
 * Los videos viven en dos almacenes (Cloudflare R2 como via principal y Supabase Storage de respaldo) y la base
 * guarda la URL "publica" de siempre, aunque los buckets sean privados: esa URL ya no sirve para ver
 * el video, pero sigue identificando el objeto. Aca se extrae la clave a partir de ella para poder
 * firmar una URL de lectura de corta vida. Modulo puro (sin next/server ni lib/r2) para poder
 * testearlo con los datos reales.
 */

export type OrigenVideo = 'r2' | 'supabase'
export interface ClaveVideo { origen: OrigenVideo; clave: string }
export interface OrigenesVideo { r2PublicUrl: string; supabaseOrigin: string }

export const BUCKET_SUPABASE_VIDEOS = 'videos-entrevista'

// Forma que genera la propia plataforma: <entrevistaId>/<candidatoId>/<preguntaId>_<timestamp>.webm
const CLAVE_ESTRICTA = /^[\w-]+\/[\w-]+\/[\w-]+\.webm$/
// Para leer se acepta cualquier clave "limpia" (hay objetos antiguos fuera de esa forma, ej. de pruebas)
const SEGMENTO_SEGURO = /^[\w][\w.-]*$/

function claveSegura(clave: string): boolean {
  if (!clave || clave.length > 512) return false
  const segmentos = clave.split('/')
  // Rechaza '' (barra inicial, final o doble) y '..': ningun segmento puede salirse de la clave
  return segmentos.every(s => s !== '..' && SEGMENTO_SEGURO.test(s))
}

function claveDesdePrefijo(url: string, prefijo: string): string | null {
  if (!url.startsWith(prefijo)) return null
  let resto = url.slice(prefijo.length).split(/[?#]/)[0]
  if (resto.includes('%')) {
    try { resto = decodeURIComponent(resto) } catch { return null }
  }
  return claveSegura(resto) ? resto : null
}

export function extraerClaveVideo(url: unknown, origenes: OrigenesVideo): ClaveVideo | null {
  if (typeof url !== 'string' || !url || url.length > 4096) return null

  // El prefijo termina en '/', asi que 'pub-x.r2.dev.otro.com' o 'pub-x.r2.dev@otro.com' no coinciden.
  // Con el origen vacio no se reconoce nada (startsWith('') seria verdadero para cualquier URL).
  const r2 = origenes.r2PublicUrl.trim().replace(/\/+$/, '')
  if (r2) {
    const clave = claveDesdePrefijo(url, `${r2}/`)
    if (clave) return { origen: 'r2', clave }
  }
  const supabase = origenes.supabaseOrigin.trim().replace(/\/+$/, '')
  if (supabase) {
    const clave = claveDesdePrefijo(url, `${supabase}/storage/v1/object/public/${BUCKET_SUPABASE_VIDEOS}/`)
    if (clave) return { origen: 'supabase', clave }
  }
  return null
}

/**
 * Al GUARDAR una respuesta: la clave debe tener la forma que genera la plataforma y pertenecer a la
 * entrevista y al candidato de la propia solicitud. Sin esto un candidato con token podia apuntar su
 * fila al video de otra persona y leer su transcripcion.
 */
export function claveVideoPerteneceA(clave: string, entrevistaId: string, candidatoId: string): boolean {
  return CLAVE_ESTRICTA.test(clave) && clave.startsWith(`${entrevistaId}/${candidatoId}/`)
}
