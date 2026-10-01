import assert from 'node:assert/strict'

const { procesoCamposSchema, procesoIdSchema, vinculoSchema, filaCandidatoSchema, cargaMasivaSchema } = await import('../lib/server/esquemasProcesos.ts')

const ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'
const ENTREVISTA = '0a9591f0-bdd0-4b51-98c2-095f3e83d870'

// --- bateria_tests: todos los valores que hoy existen en la BD (verificado el 2026-10-02) deben pasar,
// porque editar un proceso viejo reenvia su bateria completa y un rechazo lo dejaria sin poder guardarse.
const BATERIA_REAL = ['bigfive', 'verbal', 'atencion-detalle', 'creatividad', 'sjt-atencion', 'icar', 'estres-laboral', 'numerico', 'sjt-problemas', 'integridad', 'tolerancia-frustracion', `entrevista:${ENTREVISTA}`, 'dass21', 'roleplay', 'roleplay_atencion', 'frases-incompletas', 'hexaco', 'sjt-legal', 'comercial', 'sjt-comercial']
const proceso = {
  nombre: 'Operadores de Cobranzas', cargo: 'Operadores de Cobranzas y Atención al Cliente telefónica',
  descripcion: 'x'.repeat(566), descripcion_cargo: 'y'.repeat(2378),
  competencias_requeridas: [{ nombre: 'Orientación al cliente', nivel: 'Alto' }, { nombre: 'Integridad', nivel: 'Medio' }],
  bateria_tests: BATERIA_REAL,
}
assert.equal(procesoCamposSchema.safeParse(proceso).success, true, 'un proceso real completo debe pasar')
assert.equal(procesoCamposSchema.safeParse({ ...proceso, descripcion: null, descripcion_cargo: null, competencias_requeridas: null, bateria_tests: null }).success, true, 'los opcionales aceptan null')
assert.equal(procesoCamposSchema.safeParse({ nombre: 'P', cargo: 'C' }).success, true, 'solo nombre y cargo alcanzan')

for (const [motivo, malo] of Object.entries({
  'test desconocido': { ...proceso, bateria_tests: ['bigfive', 'test-inventado'] },
  'entrevista sin uuid': { ...proceso, bateria_tests: ['entrevista:abc'] },
  'bateria enorme': { ...proceso, bateria_tests: Array(41).fill('bigfive') },
  'nombre vacio': { ...proceso, nombre: '   ' },
  'descripcion gigante': { ...proceso, descripcion: 'x'.repeat(10001) },
  'competencia sin nombre': { ...proceso, competencias_requeridas: [{ nombre: '', nivel: 'Alto' }] },
  'demasiadas competencias': { ...proceso, competencias_requeridas: Array(51).fill({ nombre: 'a', nivel: 'b' }) },
})) {
  assert.equal(procesoCamposSchema.safeParse(malo).success, false, `debe rechazar: ${motivo}`)
}

// actualizar_proceso = campos parciales + procesoId (preserva "no mandar un campo = no tocarlo")
const actualizar = procesoCamposSchema.partial().extend(procesoIdSchema.shape)
const soloBateria = actualizar.safeParse({ procesoId: ID, bateria_tests: ['bigfive'] })
assert.equal(soloBateria.success, true)
assert.equal('nombre' in soloBateria.data, false, 'un campo ausente no debe aparecer (no se pisa en la BD)')
assert.equal(actualizar.safeParse({ bateria_tests: ['bigfive'] }).success, false, 'sin procesoId no se puede actualizar')
assert.equal(actualizar.safeParse({ procesoId: 'no-uuid' }).success, false)

// --- vinculo (asignar / desvincular)
assert.equal(vinculoSchema.parse({ candidatoId: ID, procesoId: ID }).slugPrimerTest, 'control', 'sin slug usa control, como antes')
assert.equal(vinculoSchema.parse({ candidatoId: ID, procesoId: ID, slugPrimerTest: '' }).slugPrimerTest, 'control')
assert.equal(vinculoSchema.safeParse({ candidatoId: 'x', procesoId: ID }).success, false)

// --- carga masiva: fila por fila
const fila = (f: unknown) => filaCandidatoSchema.safeParse(f)
assert.deepEqual(fila({ nombre: ' Ana ', apellido: 'Pérez', email: '  ANA.Perez@Gmail.com ' }).data, { nombre: 'Ana', apellido: 'Pérez', email: 'ana.perez@gmail.com' }, 'recorta y pasa el email a minusculas')
assert.equal(fila({ nombre: 'Ana', apellido: '', email: 'ana@dominio.com.uy' }).success, true, 'apellido vacio y dominio .com.uy')
assert.equal(fila({ nombre: 'Ana', email: 'ana@dominio.com' }).data?.apellido, '', 'apellido ausente queda vacio')
for (const mala of [{ nombre: 'Ana', email: 'ana@' }, { nombre: 'Ana', email: 'sin-arroba' }, { nombre: '', email: 'a@b.com' }, { nombre: 'Ana' }, null, 'texto', 42]) {
  assert.equal(fila(mala).success, false, `la fila debe omitirse: ${JSON.stringify(mala)}`)
}

const lote = (o: object) => cargaMasivaSchema.safeParse(o)
assert.equal(lote({ candidatos: [{}], procesoId: '', slugPrimerTest: 'control' }).success, true, "procesoId '' = carga sin proceso (lo que manda el cliente)")
assert.equal(lote({ candidatos: [{}], procesoId: ID }).data?.slugPrimerTest, 'control')
assert.equal(lote({ candidatos: [{}] }).data?.procesoId, '', 'procesoId ausente queda vacio')
assert.equal(lote({ candidatos: [{}], procesoId: 'abc' }).success, false)
assert.equal(lote({ candidatos: [] }).success, false, 'sin filas')
assert.equal(lote({ candidatos: Array(1000).fill({}) }).success, true, '1000 filas es el maximo')
assert.equal(lote({ candidatos: Array(1001).fill({}) }).success, false, '1001 filas se rechaza')
assert.equal(lote({ candidatos: 'no es array' }).success, false)

console.log('✅ procesos-validacion: los 20 valores reales de bateria_tests y un proceso completo pasan, los invalidos se rechazan, actualizar es parcial, y la carga masiva valida fila por fila')
