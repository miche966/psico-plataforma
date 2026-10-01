import { z } from 'zod'

export { z }

// Clave de un video de entrevista: <entrevistaId>/<candidatoId>/<preguntaId>_<timestamp>.webm
// (la arma app/entrevista-video/responder/page.tsx). Ademas del prefijo que ya se chequea, fija la
// forma del nombre: sin subcarpetas extra ni extensiones distintas de .webm dentro del bucket publico.
export const rutaVideoSchema = z.string().max(512).regex(/^[\w-]+\/[\w-]+\/[\w-]+\.webm$/, 'Ruta de video no autorizada')

// Para endpoints cuyo cliente avanza sin mirar el status HTTP (ej. guardar una respuesta de video):
// rechazar un campo perderia la respuesta del candidato en silencio. Estos helpers CORRIGEN en vez
// de rechazar -- el valor siempre queda acotado, pero nunca falla el parseo.
// OJO: en zod 4 z.unknown().transform() RECHAZA las claves ausentes ("expected nonoptional"); el .optional()
// previo es lo que las acepta. Por eso todo campo lenient pasa por este helper en vez de repetir el patron
// (tests/validacion.test.ts cubre este caso).
export const lenient = <T>(corregir: (v: unknown) => T) => z.unknown().optional().transform(corregir)

export const textoLeniente = (max: number) => lenient(v => String(v ?? '').slice(0, max))

export const numeroLeniente = (min: number, max: number) => lenient(v => {
  if (v === null) return null
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined
})
