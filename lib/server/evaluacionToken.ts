import { createHmac, timingSafeEqual } from 'node:crypto'

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

export function generarTokenEvaluacion(candidatoId: string, procesoId: string, ttlSeconds = 60 * 60 * 24 * 30) {
  const secreto = process.env.EVALUACION_LINK_SECRET
  if (!secreto) throw new Error('EVALUACION_LINK_SECRET no configurado')
  const payload = base64url(JSON.stringify({ candidatoId, procesoId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }))
  const firma = base64url(createHmac('sha256', secreto).update(payload).digest())
  return `${payload}.${firma}`
}

export function validarTokenEvaluacion(token: string, candidatoId: string, procesoId: string) {
  try {
    const secreto = process.env.EVALUACION_LINK_SECRET
    if (!secreto) return false
    const [payload, firma] = token.split('.')
    if (!payload || !firma) return false
    const esperada = createHmac('sha256', secreto).update(payload).digest()
    const recibida = Buffer.from(firma, 'base64url')
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return false
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return datos.candidatoId === candidatoId && datos.procesoId === procesoId && Number(datos.exp) > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}
