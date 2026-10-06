import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

process.env.EVALUACION_LINK_SECRET = 'test-secret-only'
const { generarTokenEvaluacion, validarTokenEvaluacion, leerTokenEvaluacion, configIcarValida } = await import('../lib/server/evaluacionToken.ts')

const candidato = '00000000-0000-4000-8000-000000000001'
const proceso = '00000000-0000-4000-8000-000000000002'
const token = generarTokenEvaluacion(candidato, proceso, 60)

assert.equal(validarTokenEvaluacion(token, candidato, proceso), true)
assert.equal(validarTokenEvaluacion(token, candidato, '00000000-0000-4000-8000-000000000003'), false)
assert.equal(validarTokenEvaluacion(token, '00000000-0000-4000-8000-000000000004', proceso), false)
assert.equal(validarTokenEvaluacion(token + 'x', candidato, proceso), false)

// ---- Configuracion ICAR firmada dentro del token ----
assert.deepEqual(leerTokenEvaluacion(token, candidato, proceso), {}, 'un token sin configuracion ICAR sigue siendo valido y no trae nada')
const conIcar = generarTokenEvaluacion(candidato, proceso, 60, { icar: { max: 2, sinRotacion: true } })
assert.deepEqual(leerTokenEvaluacion(conIcar, candidato, proceso), { icar: { max: 2, sinRotacion: true } })
assert.equal(validarTokenEvaluacion(conIcar, candidato, proceso), true)
assert.deepEqual(leerTokenEvaluacion(generarTokenEvaluacion(candidato, proceso, 60, { icar: { max: 3, sinRotacion: false } }), candidato, proceso), { icar: { max: 3, sinRotacion: false } })
assert.equal(leerTokenEvaluacion(conIcar, candidato, '00000000-0000-4000-8000-000000000003'), null, 'sigue atado a candidato y proceso')
assert.equal(leerTokenEvaluacion(generarTokenEvaluacion(candidato, proceso, -10, { icar: { max: 2, sinRotacion: false } }), candidato, proceso), null, 'vencido')

// Cambiar la configuracion a mano invalida la firma: el candidato no puede bajar ni subir su nivel
{
  const [payload, firma] = conIcar.split('.')
  const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  const manipulado = Buffer.from(JSON.stringify({ ...datos, icar: { max: 1, norot: true } })).toString('base64url')
  assert.equal(leerTokenEvaluacion(`${manipulado}.${firma}`, candidato, proceso), null, 'payload modificado con la firma original')
  // Aun firmando con otro secreto no pasa
  const ajena = createHmac('sha256', 'otro-secreto').update(manipulado).digest('base64url')
  assert.equal(leerTokenEvaluacion(`${manipulado}.${ajena}`, candidato, proceso), null, 'firmado con otro secreto')
  // Un token ya vigente pero sin la configuracion no se la puede agregar
  const [payloadSin, firmaSin] = token.split('.')
  const agregado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payloadSin, 'base64url').toString('utf8')), icar: { max: 1, norot: false } })).toString('base64url')
  assert.equal(leerTokenEvaluacion(`${agregado}.${firmaSin}`, candidato, proceso), null, 'configuracion agregada a un token existente')
}

// Solo niveles 1, 2 y 3; cualquier otra cosa no entra al token
for (const malo of [0, 4, -1, 2.5, 'x', null, undefined, NaN, '']) assert.equal(configIcarValida(malo, false), undefined, `nivel ${String(malo)}`)
assert.deepEqual(configIcarValida('2', false), { max: 2, sinRotacion: false })
assert.deepEqual(configIcarValida(3, 'true'), { max: 3, sinRotacion: false }, 'la rotacion solo se apaga con un true de verdad')
assert.deepEqual(leerTokenEvaluacion(generarTokenEvaluacion(candidato, proceso, 60, { icar: { max: 9 as any, sinRotacion: true } }), candidato, proceso), {}, 'un nivel invalido no se firma')

console.log('✅ Token válido y rechazos de candidato/proceso/firma verificados; la configuración ICAR firmada no se puede cambiar ni agregar')
