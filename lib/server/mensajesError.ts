import { esErrorDeCertificado } from './smtpTls.ts'

/**
 * Mensaje de error que SI se le puede mostrar al cliente a partir de un error interno.
 *
 * Nunca devuelve el texto del error original: ese texto puede traer nombres de tablas y columnas,
 * restricciones de Postgres, fragmentos de consultas, rutas del servidor o respuestas crudas de
 * Gemini. El error completo se loguea en el servidor (console.error) y al cliente le llega un mensaje
 * generico, salvo dos casos que si le sirven al usuario y no revelan nada interno.
 */
export function mensajeParaCliente(error: unknown, mensajePorDefecto: string): string {
  const e = (error && typeof error === 'object' ? error : {}) as { code?: unknown; status?: unknown }
  // Postgres: violacion de restriccion UNIQUE (ej. un correo o documento repetido)
  if (e.code === '23505') return 'Ya existe un registro con esos datos (por ejemplo, un correo o un documento repetido).'
  // Gemini: cuota agotada (429) o servicio sobrecargado (503)
  if (e.status === 429 || e.status === 503) return 'El servicio de IA está saturado en este momento. Intentá de nuevo en unos minutos.'
  return mensajePorDefecto
}

/**
 * Igual que mensajeParaCliente, pero para errores de envio de correo (nodemailer). El mensaje crudo de
 * SMTP trae el host y la IP del servidor ("connect ETIMEDOUT 10.0.3.7:587"), asi que se traduce el codigo
 * a un mensaje que sigue sirviendo para diagnosticar (timeout vs credenciales vs destinatario) sin
 * exponer la infraestructura. Es la herramienta con la que se diagnostico el bloqueo del firewall.
 */
export function mensajeErrorCorreo(error: unknown, mensajePorDefecto: string): string {
  // El certificado TLS del servidor de correo no es de confianza (antes se aceptaba cualquiera): se distingue de un corte de red
  if (esErrorDeCertificado(error)) return 'El certificado del servidor de correo no es de confianza. Revisá la configuración SMTP (certificado de la CA).'
  const code = (error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined)
  if (typeof code === 'string') {
    if (['ETIMEDOUT', 'ECONNREFUSED', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'ENOTFOUND', 'EDNS'].includes(code)) {
      return 'No se pudo conectar con el servidor de correo (tiempo agotado o conexión rechazada). Revisá la configuración SMTP.'
    }
    if (code === 'EAUTH') return 'El servidor de correo rechazó las credenciales configuradas.'
    if (code === 'EENVELOPE') return 'La dirección de correo del destinatario no es válida o fue rechazada.'
  }
  return mensajeParaCliente(error, mensajePorDefecto)
}
