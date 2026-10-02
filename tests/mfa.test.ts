import assert from 'node:assert/strict'

const { nivelDeAseguramiento, mfaObligatorio, cumpleMfa } = await import('../lib/server/mfa.ts')
const { decodificarPayloadJwt } = await import('../lib/server/jwtPlano.ts')

const jwt = (payload: object) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`
}
const bearer = (payload: object) => `Bearer ${jwt(payload)}`

// ---- Nivel de aseguramiento (claim aal que pone Supabase Auth) ----
assert.equal(nivelDeAseguramiento(bearer({ role: 'authenticated', aal: 'aal1' })), 'aal1', 'tras la contrasena')
assert.equal(nivelDeAseguramiento(bearer({ role: 'authenticated', aal: 'aal2', amr: [{ method: 'totp' }] })), 'aal2', 'tras verificar el codigo')
assert.equal(nivelDeAseguramiento(bearer({ role: 'authenticated' })), null, 'sin claim')
assert.equal(nivelDeAseguramiento(bearer({ aal: 'aal3' })), null, 'valor desconocido')
assert.equal(nivelDeAseguramiento(bearer({ aal: 2 })), null, 'tipo incorrecto')
assert.equal(nivelDeAseguramiento(null), null)
assert.equal(nivelDeAseguramiento(''), null)
assert.equal(nivelDeAseguramiento('Bearer '), null)
assert.equal(nivelDeAseguramiento('Bearer basura'), null)
assert.equal(nivelDeAseguramiento(`Basic ${jwt({ aal: 'aal2' })}`), null, 'esquema distinto')

// ---- La variable de entorno: solo "true" activa la exigencia ----
assert.equal(mfaObligatorio('true'), true)
for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes', ' true']) assert.equal(mfaObligatorio(v), false, `no activa con ${JSON.stringify(v)}`)

// ---- Regla: sin obligatoriedad pasa todo; con obligatoriedad solo aal2 ----
const aal1 = bearer({ role: 'authenticated', aal: 'aal1' })
const aal2 = bearer({ role: 'authenticated', aal: 'aal2' })
assert.equal(cumpleMfa(aal1, false), true, 'apagado: nadie queda afuera')
assert.equal(cumpleMfa(null, false), true)
assert.equal(cumpleMfa(aal2, true), true)
assert.equal(cumpleMfa(aal1, true), false, 'solo contrasena no alcanza')
assert.equal(cumpleMfa(bearer({ role: 'authenticated' }), true), false, 'sin claim no se asume aal2')
assert.equal(cumpleMfa(null, true), false)
assert.equal(cumpleMfa('Bearer basura', true), false)

// ---- Decodificador compartido ----
assert.deepEqual(decodificarPayloadJwt(jwt({ a: 1 })), { a: 1 })
assert.equal(decodificarPayloadJwt('a.b'), null)
assert.equal(decodificarPayloadJwt('a.b.c'), null)
assert.equal(decodificarPayloadJwt(''), null)
assert.equal(decodificarPayloadJwt(`${Buffer.from('{}').toString('base64url')}.${Buffer.from('"texto"').toString('base64url')}.x`), null, 'el payload debe ser un objeto')

console.log('✅ mfa: el claim aal se lee solo de tokens bien formados, la exigencia se activa unicamente con MFA_OBLIGATORIO=true, y con ella solo pasa aal2')
