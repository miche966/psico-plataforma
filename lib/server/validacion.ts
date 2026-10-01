import { NextResponse } from 'next/server'
import { z } from 'zod'

// Los schemas puros viven en esquemas.ts (sin depender de next/server, para poder testearlos).
export * from '@/lib/server/esquemas'

export type ResultadoValidacion<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/**
 * Valida datos de entrada contra un schema. Si falla, devuelve una respuesta 400 lista para
 * retornar con el primer mensaje del schema (o `mensajeGenerico` si el schema no define uno).
 * Los campos que el schema no declara se descartan: nada llega a la BD sin haber sido nombrado.
 */
export function validar<T extends z.ZodType>(schema: T, datos: unknown, mensajeGenerico = 'Los datos enviados no son válidos.'): ResultadoValidacion<z.output<T>> {
  const resultado = schema.safeParse(datos)
  if (resultado.success) return { ok: true, data: resultado.data }
  const mensaje = resultado.error.issues[0]?.message
  const esMensajeNuestro = mensaje && !/^(Invalid|Too (small|big)|Required|Expected)/i.test(mensaje)
  return { ok: false, response: NextResponse.json({ error: esMensajeNuestro ? mensaje : mensajeGenerico }, { status: 400 }) }
}
