import assert from 'node:assert/strict'

process.env.EVALUACION_LINK_SECRET = 'test-secret-only'
const { generarTokenEvaluacion, validarTokenEvaluacion } = await import('../lib/server/evaluacionToken.ts')

const candidato = '00000000-0000-4000-8000-000000000001'
const proceso = '00000000-0000-4000-8000-000000000002'
const token = generarTokenEvaluacion(candidato, proceso, 60)

assert.equal(validarTokenEvaluacion(token, candidato, proceso), true)
assert.equal(validarTokenEvaluacion(token, candidato, '00000000-0000-4000-8000-000000000003'), false)
assert.equal(validarTokenEvaluacion(token, '00000000-0000-4000-8000-000000000004', proceso), false)
assert.equal(validarTokenEvaluacion(token + 'x', candidato, proceso), false)

console.log('✅ Token válido y rechazos de candidato/proceso/firma verificados')
