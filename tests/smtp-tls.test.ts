import assert from 'node:assert/strict'

const { opcionesTls, tlsParaNodemailer, certificadosPem, esErrorDeCertificado } = await import('../lib/server/smtpTls.ts')

const CERT = '-----BEGIN CERTIFICATE-----\nMIIDtest1\n-----END CERTIFICATE-----'
const CERT2 = '-----BEGIN CERTIFICATE-----\nMIIDtest2\n-----END CERTIFICATE-----'

// ---- Por defecto es ESTRICTO (antes se aceptaba cualquier certificado) ----
assert.deepEqual(tlsParaNodemailer(opcionesTls({})), { rejectUnauthorized: true })
assert.equal(opcionesTls({}).modo, 'sistema')

// ---- Con la CA propia: estricto y confiando solo en esa CA ----
{
  const o = opcionesTls({ EMAIL_TLS_CA: CERT })
  assert.equal(o.rejectUnauthorized, true)
  assert.deepEqual(o.ca, [CERT + '\n'])
  assert.equal(o.modo, 'ca-propia')
  assert.deepEqual(tlsParaNodemailer(o), { rejectUnauthorized: true, ca: [CERT + '\n'] })
}
// Los saltos de linea pueden venir escapados (variables de entorno de una sola linea)
assert.deepEqual(certificadosPem('-----BEGIN CERTIFICATE-----\\nMIIDtest1\\n-----END CERTIFICATE-----').length, 1)
assert.match(certificadosPem('-----BEGIN CERTIFICATE-----\\nMIIDtest1\\n-----END CERTIFICATE-----')[0], /MIIDtest1\n-----END/)
// Varios certificados (cadena)
assert.equal(certificadosPem(`${CERT}\n${CERT2}`).length, 2)
// Basura o vacio: no cuenta como CA
for (const malo of [undefined, '', '   ', 'no es un certificado', '-----BEGIN CERTIFICATE-----sin fin']) assert.deepEqual(certificadosPem(malo), [])

// La CA tiene prioridad sobre el modo inseguro: nunca se desactiva la validacion si hay CA
assert.equal(opcionesTls({ EMAIL_TLS_CA: CERT, EMAIL_TLS_INSEGURO: 'true' }).rejectUnauthorized, true)
// Una CA ilegible no habilita nada: queda estricto
assert.equal(opcionesTls({ EMAIL_TLS_CA: 'basura' }).rejectUnauthorized, true)

// ---- El modo inseguro es una decision explicita y exacta ----
assert.equal(opcionesTls({ EMAIL_TLS_INSEGURO: 'true' }).rejectUnauthorized, false)
assert.equal(opcionesTls({ EMAIL_TLS_INSEGURO: 'true' }).modo, 'inseguro')
for (const v of [undefined, '', 'false', 'TRUE', '1', 'si', ' true']) assert.equal(opcionesTls({ EMAIL_TLS_INSEGURO: v }).rejectUnauthorized, true, `no desactiva con ${JSON.stringify(v)}`)

// ---- Deteccion de errores de certificado (para mostrar un mensaje util y no el de "no se pudo conectar") ----
assert.equal(esErrorDeCertificado({ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }), true)
assert.equal(esErrorDeCertificado({ code: 'ESOCKET', cause: { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' } }), true)
assert.equal(esErrorDeCertificado({ code: 'ESOCKET', message: 'unable to verify the first certificate' }), true)
assert.equal(esErrorDeCertificado({ code: 'ESOCKET', message: "Hostname/IP does not match certificate's altnames" }), true)
assert.equal(esErrorDeCertificado({ code: 'ETIMEDOUT' }), false)
assert.equal(esErrorDeCertificado({ code: 'EAUTH' }), false)
assert.equal(esErrorDeCertificado(new Error('algo raro')), false)
assert.equal(esErrorDeCertificado(null), false)
assert.equal(esErrorDeCertificado(undefined), false)

console.log('✅ smtp-tls: por defecto la validacion del certificado es estricta, con la CA propia solo se confia en esa CA, el modo inseguro es explicito y nunca pisa a una CA, y los errores de certificado se reconocen')
