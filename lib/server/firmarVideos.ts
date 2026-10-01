import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { SupabaseClient } from '@supabase/supabase-js'
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '@/lib/r2'
import { BUCKET_SUPABASE_VIDEOS, extraerClaveVideo, type ClaveVideo } from '@/lib/server/urlsVideo'

// Vigencia de la URL firmada de lectura. Una sesion de revision de un candidato dura minutos; dos horas
// cubren dejar la pestaña abierta (adelantar y retroceder pide rangos con la misma URL) y, si vence, el
// cliente vuelve a pedirlas. Es una llave temporal: quien la copie ve ese video hasta que venza.
export const VIGENCIA_URL_VIDEO_SEGUNDOS = 2 * 60 * 60

/** Clave del objeto a partir de la URL guardada en respuestas_video.url_video, o null si no es de nuestros almacenes. */
export function claveDeUrlVideo(url: unknown): ClaveVideo | null {
  return extraerClaveVideo(url, {
    r2PublicUrl: R2_PUBLIC_URL,
    supabaseOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  })
}

/**
 * URL de lectura de corta vida para un video guardado. Si la URL guardada no es de nuestros almacenes
 * (filas de prueba, URLs ajenas) o la firma falla, devuelve null: el reproductor muestra "no disponible"
 * en vez de recibir una URL cruda que ya no sirve (o que apunta a un tercero).
 */
export async function firmarUrlVideo(url: unknown, db: SupabaseClient): Promise<string | null> {
  const ref = claveDeUrlVideo(url)
  if (!ref) return null
  try {
    if (ref.origen === 'r2') {
      // Firma local con las credenciales ya configuradas: no hace ninguna llamada de red
      return await getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: ref.clave }), { expiresIn: VIGENCIA_URL_VIDEO_SEGUNDOS })
    }
    const { data, error } = await db.storage.from(BUCKET_SUPABASE_VIDEOS).createSignedUrl(ref.clave, VIGENCIA_URL_VIDEO_SEGUNDOS)
    if (error) throw error
    return data?.signedUrl || null
  } catch (error) {
    console.error('[firmarVideos] No se pudo firmar la URL del video:', error)
    return null
  }
}

/** Reemplaza url_video de cada fila por su URL firmada (o null). El resto de la fila queda igual. */
export async function firmarVideos<T extends { url_video?: string | null }>(filas: T[], db: SupabaseClient): Promise<T[]> {
  return Promise.all(filas.map(async fila => (fila.url_video ? { ...fila, url_video: await firmarUrlVideo(fila.url_video, db) } : fila)))
}

/**
 * Baja un video desde nuestro propio almacen (con las credenciales del servidor, no por la URL publica)
 * para mandarlo a analizar. Lanza si no se puede leer o supera el tope: nunca devuelve un cuerpo de error
 * como si fuera video. `ref` sale de claveDeUrlVideo(url guardada en la base), nunca de lo que mande el cliente.
 */
export async function descargarVideo(ref: ClaveVideo, db: SupabaseClient, maxBytes: number): Promise<Buffer> {
  if (ref.origen === 'r2') {
    const obj = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: ref.clave }))
    if (!obj.Body) throw new Error('El objeto de R2 no tiene contenido')
    if (typeof obj.ContentLength === 'number' && obj.ContentLength > maxBytes) throw new Error('El video supera el tamano maximo permitido')
    const bytes = await obj.Body.transformToByteArray()
    if (bytes.byteLength > maxBytes) throw new Error('El video supera el tamano maximo permitido')
    return Buffer.from(bytes)
  }
  const { data, error } = await db.storage.from(BUCKET_SUPABASE_VIDEOS).download(ref.clave)
  if (error || !data) throw error || new Error('El objeto de Supabase Storage no tiene contenido')
  if (data.size > maxBytes) throw new Error('El video supera el tamano maximo permitido')
  return Buffer.from(await data.arrayBuffer())
}
