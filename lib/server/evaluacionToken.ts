import { createHmac, timingSafeEqual } from 'node:crypto'

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

/** Configuracion del examen ICAR que decide el administrador al armar el enlace: va FIRMADA dentro del token. */
export type ConfigIcarToken = { max: 1 | 2 | 3; sinRotacion: boolean }

/** Datos firmados que el servidor lee de un token ya validado. `icar` falta en los tokens que no la fijan. */
export type DatosToken = { icar?: ConfigIcarToken }

const NIVELES_ICAR = [1, 2, 3] as const

/** Una configuracion ICAR valida o nada: el nivel maximo solo puede ser 1, 2 o 3. */
export function configIcarValida(max: unknown, sinRotacion: unknown): ConfigIcarToken | undefined {
  const nivel = Number(max)
  if (!(NIVELES_ICAR as readonly number[]).includes(nivel)) return undefined
  return { max: nivel as 1 | 2 | 3, sinRotacion: sinRotacion === true }
}

export function generarTokenEvaluacion(candidatoId: string, procesoId: string, ttlSeconds = 60 * 60 * 24 * 30, opciones: { icar?: ConfigIcarToken } = {}) {
  const secreto = process.env.EVALUACION_LINK_SECRET
  if (!secreto) throw new Error('EVALUACION_LINK_SECRET no configurado')
  const datos: Record<string, unknown> = { candidatoId, procesoId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const icar = opciones.icar && configIcarValida(opciones.icar.max, opciones.icar.sinRotacion)
  if (icar) datos.icar = { max: icar.max, norot: icar.sinRotacion }
  const payload = base64url(JSON.stringify(datos))
  const firma = base64url(createHmac('sha256', secreto).update(payload).digest())
  return `${payload}.${firma}`
}

/** Valida firma, candidato, proceso y vencimiento; devuelve lo firmado en el token, o null si no es valido. */
export function leerTokenEvaluacion(token: string, candidatoId: string, procesoId: string): DatosToken | null {
  try {
    const secreto = process.env.EVALUACION_LINK_SECRET
    if (!secreto) return null
    const [payload, firma] = token.split('.')
    if (!payload || !firma) return null
    const esperada = createHmac('sha256', secreto).update(payload).digest()
    const recibida = Buffer.from(firma, 'base64url')
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!(datos.candidatoId === candidatoId && datos.procesoId === procesoId && Number(datos.exp) > Math.floor(Date.now() / 1000))) return null
    const icar = datos.icar && typeof datos.icar === 'object' ? configIcarValida(datos.icar.max, datos.icar.norot) : undefined
    return icar ? { icar } : {}
  } catch {
    return null
  }
}

export function validarTokenEvaluacion(token: string, candidatoId: string, procesoId: string) {
  return leerTokenEvaluacion(token, candidatoId, procesoId) !== null
}
