import assert from 'node:assert/strict'

const { mensajeParaCliente } = await import('../lib/server/mensajesError.ts')

const FALLBACK = 'No se pudo completar la operación'

// Lo que antes se le devolvia al cliente tal cual: nunca debe aparecer en el mensaje
const filtraciones = [
  new Error('duplicate key value violates unique constraint "candidatos_documento_key"'),
  new Error('relation "public.informes_psicometricos" does not exist'),
  new Error('connect ECONNREFUSED 10.0.3.7:5432'),
  new Error('[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent'),
  new Error('ENOENT: no such file or directory, open \'C:\\Users\\mochoa\\.antigravity\\psico-plataforma-master\\.env.local\''),
  { message: 'JWT expired', hint: 'revisar SUPABASE_SERVICE_ROLE_KEY' },
  'cadena suelta con detalles internos',
  null,
  undefined,
  42,
]
for (const f of filtraciones) {
  assert.equal(mensajeParaCliente(f, FALLBACK), FALLBACK, `debe devolver solo el mensaje por defecto para: ${String((f as any)?.message ?? f)}`)
}

// Las dos excepciones utiles y seguras
assert.match(mensajeParaCliente({ code: '23505', message: 'duplicate key value violates unique constraint "x"' }, FALLBACK), /Ya existe un registro/)
assert.doesNotMatch(mensajeParaCliente({ code: '23505', message: 'duplicate key value violates unique constraint "x"' }, FALLBACK), /constraint|duplicate key/)
for (const status of [429, 503]) {
  const m = mensajeParaCliente(Object.assign(new Error('[GoogleGenerativeAI Error]: 429 Too Many Requests quota exceeded for project 123456'), { status }), FALLBACK)
  assert.match(m, /saturado/)
  assert.doesNotMatch(m, /GoogleGenerativeAI|quota|project/)
}
assert.equal(mensajeParaCliente(Object.assign(new Error('x'), { status: 500 }), FALLBACK), FALLBACK, 'otros status no se mapean')
assert.equal(mensajeParaCliente({ code: '23503' }, FALLBACK), FALLBACK, 'otros codigos de Postgres tampoco')

// Correo: el mensaje crudo de SMTP trae host e IP; el codigo se traduce y sigue sirviendo para diagnosticar
const { mensajeErrorCorreo } = await import('../lib/server/mensajesError.ts')
const smtp = (code: string, message: string) => Object.assign(new Error(message), { code })
const crudo = 'connect ETIMEDOUT 10.0.3.7:587 (rmclhyp1mail1.republicamicrofinanzas.com.uy)'
for (const code of ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNECTION', 'ESOCKET', 'ENOTFOUND']) {
  const m = mensajeErrorCorreo(smtp(code, crudo), FALLBACK)
  assert.match(m, /servidor de correo/, `${code} debe explicar que fallo la conexion`)
  assert.doesNotMatch(m, /10\.0\.3\.7|republicamicrofinanzas|587|connect/, `${code} no debe exponer host ni IP`)
}
assert.match(mensajeErrorCorreo(smtp('EAUTH', 'Invalid login: 535 5.7.8 Authentication failed for seleccion@republicamicrofinanzas.com.uy'), FALLBACK), /credenciales/)
assert.doesNotMatch(mensajeErrorCorreo(smtp('EAUTH', 'Invalid login: 535 seleccion@republicamicrofinanzas.com.uy'), FALLBACK), /republicamicrofinanzas|535/)
assert.match(mensajeErrorCorreo(smtp('EENVELOPE', 'No recipients defined'), FALLBACK), /destinatario/)
// Certificado del servidor de correo no confiable: mensaje propio, sin host ni detalles del certificado
{
  const m = mensajeErrorCorreo(smtp('ESOCKET', 'unable to verify the first certificate (rmclhyp1mail1.republicamicrofinanzas.com.uy 201.217.148.51)'), FALLBACK)
  assert.match(m, /certificado/)
  assert.doesNotMatch(m, /republicamicrofinanzas|201\.217|rmclhyp1/)
}
assert.equal(mensajeErrorCorreo(new Error('algo interno raro'), FALLBACK), FALLBACK, 'un error de correo desconocido cae al mensaje por defecto')
assert.equal(mensajeParaCliente(smtp('ETIMEDOUT', crudo), FALLBACK), FALLBACK, 'fuera de correo, ETIMEDOUT NO se presenta como error de correo')

console.log('✅ mensajes-error: ningun error interno llega al cliente (tablas, rutas, claves, URLs de Gemini); solo duplicado e IA saturada tienen mensaje propio')
