import assert from 'node:assert/strict'

const { INACTIVIDAD_2FA_MS, REVISION_2FA_MS, inactividadVencida } = await import('../lib/inactividad2fa.ts')

const t0 = 1_000_000

assert.equal(INACTIVIDAD_2FA_MS, 5 * 60 * 1000, 'el limite es de 5 minutos')
assert.ok(REVISION_2FA_MS < INACTIVIDAD_2FA_MS, 'se revisa mucho mas seguido que el limite')

// No vence antes del limite ni justo en el limite; si despues
assert.equal(inactividadVencida(t0, t0), false)
assert.equal(inactividadVencida(t0, t0 + INACTIVIDAD_2FA_MS - 1), false)
assert.equal(inactividadVencida(t0, t0 + INACTIVIDAD_2FA_MS), false)
assert.equal(inactividadVencida(t0, t0 + INACTIVIDAD_2FA_MS + 1), true)

// Tocar la pantalla reinicia la cuenta: con una actividad reciente no vence aunque haya pasado mucho desde la primera
const actividadReciente = t0 + 4 * 60 * 1000
assert.equal(inactividadVencida(actividadReciente, t0 + 8 * 60 * 1000), false)
assert.equal(inactividadVencida(actividadReciente, actividadReciente + INACTIVIDAD_2FA_MS + 1), true)

// Una computadora que estuvo suspendida horas vence apenas se revisa
assert.equal(inactividadVencida(t0, t0 + 3 * 60 * 60 * 1000), true)

// Un reloj que retrocede no cierra la sesion por error
assert.equal(inactividadVencida(t0, t0 - 60_000), false)

// Limite propio
assert.equal(inactividadVencida(t0, t0 + 1001, 1000), true)
assert.equal(inactividadVencida(t0, t0 + 999, 1000), false)

console.log('✅ inactividad-2fa: vence a los 5 minutos sin actividad (y no antes), tocar la pantalla reinicia la cuenta, una suspension larga vence al revisar y un reloj que retrocede no cierra la sesion')
