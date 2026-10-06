/**
 * Opciones TLS de la conexion SMTP de los recordatorios (STARTTLS contra el servidor de correo propio).
 *
 * El servidor es un Zimbra con su certificado autogenerado (emitido por la "CA de Zimbra" de ese mismo servidor),
 * que Node no reconoce. Antes se resolvia con `rejectUnauthorized: false`, que acepta CUALQUIER certificado (cualquiera
 * que pueda interponerse en la conexion podria leer las credenciales del correo). Lo correcto es confiar en la CA de
 * Zimbra y nada mas:
 *
 *   EMAIL_TLS_CA        certificado de la CA (PEM; los saltos de linea pueden venir como \n). Con esto la validacion
 *                       es estricta: cadena de confianza y nombre del servidor.
 *   EMAIL_TLS_INSEGURO  "true" = comportamiento anterior (no validar), solo mientras no se tenga la CA. Se avisa en el log.
 *
 * Sin ninguna de las dos se valida contra las CA publicas del sistema (estricto): sirve si el servidor presenta un
 * certificado de una CA publica. Modulo puro (sin next/server).
 */
type Env = Record<string, string | undefined>

export interface OpcionesTls {
  rejectUnauthorized: boolean
  ca?: string[]
  /** Solo informativo, para el log */
  modo: 'ca-propia' | 'sistema' | 'inseguro'
}

const PEM = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g

/** Extrae los certificados PEM de un texto (admite \n escapados y bloques repetidos). */
export function certificadosPem(texto: string | undefined): string[] {
  if (!texto) return []
  return (texto.replace(/\\n/g, '\n').match(PEM) || []).map(c => c.trim() + '\n')
}

export function opcionesTls(env: Env = process.env): OpcionesTls {
  const ca = certificadosPem(env.EMAIL_TLS_CA)
  if (ca.length > 0) return { rejectUnauthorized: true, ca, modo: 'ca-propia' }
  if (env.EMAIL_TLS_INSEGURO === 'true') return { rejectUnauthorized: false, modo: 'inseguro' }
  return { rejectUnauthorized: true, modo: 'sistema' }
}

/** Opciones que se pasan a nodemailer (`tls`): sin el campo informativo. */
export function tlsParaNodemailer(opciones: OpcionesTls): { rejectUnauthorized: boolean; ca?: string[] } {
  return opciones.ca ? { rejectUnauthorized: opciones.rejectUnauthorized, ca: opciones.ca } : { rejectUnauthorized: opciones.rejectUnauthorized }
}

const CODIGOS_CERTIFICADO = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_HAS_EXPIRED',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_NOT_YET_VALID',
])

/** True si el error de nodemailer se debe a que el certificado del servidor no es de confianza o no coincide. */
export function esErrorDeCertificado(error: unknown): boolean {
  const e = (error && typeof error === 'object' ? error : {}) as { code?: unknown; cause?: unknown; message?: unknown }
  const codigos = [e.code, (e.cause as { code?: unknown } | undefined)?.code]
  if (codigos.some(c => typeof c === 'string' && CODIGOS_CERTIFICADO.has(c))) return true
  return typeof e.message === 'string' && /unable to verify the first certificate|self[- ]signed certificate|certificate has expired|Hostname\/IP does not match/i.test(e.message)
}
