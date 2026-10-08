import assert from 'node:assert/strict'

const { guardarResumen, leerResumenes, claveResumen, resumenesVisibles } = await import('../lib/server/resumenesIa.ts')

const CANDIDATO = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const PROCESO = '740a08d1-a5f9-45e2-9887-a7b2ece99796'

const dbQueGraba = () => {
  const llamadas: any[] = []
  return { llamadas, from: (tabla: string) => ({ upsert: async (fila: any, opciones: any) => { llamadas.push({ tabla, fila, opciones }); return { error: null } } }) }
}

// Una fila por candidato y proceso: la clave permite reemplazar el resumen anterior
assert.equal(claveResumen(CANDIDATO, PROCESO), `${CANDIDATO}:${PROCESO}`)
assert.equal(claveResumen(CANDIDATO, null), `${CANDIDATO}:independiente`)

// Camino feliz
const db = dbQueGraba()
assert.equal(await guardarResumen(db, { candidatoId: CANDIDATO, procesoId: PROCESO, resumen: 'Perfil sólido.', email: ' Admin@Ejemplo.COM ' }), true)
assert.equal(db.llamadas.length, 1)
assert.equal(db.llamadas[0].tabla, 'resumenes_ia')
assert.deepEqual(db.llamadas[0].opciones, { onConflict: 'clave' }, 'reemplaza el anterior en vez de duplicar')
assert.equal(db.llamadas[0].fila.clave, `${CANDIDATO}:${PROCESO}`)
assert.equal(db.llamadas[0].fila.generado_por, 'admin@ejemplo.com', 'email normalizado')

// Candidato sin proceso, o con un proceso que no es uuid: se guarda como independiente
const db2 = dbQueGraba()
await guardarResumen(db2, { candidatoId: CANDIDATO, procesoId: "x'; drop table y;--", resumen: 'ok', email: 'a@b.com' })
assert.equal(db2.llamadas[0].fila.proceso_id, null)
assert.equal(db2.llamadas[0].fila.clave, `${CANDIDATO}:independiente`)

// Lo que viene del cuerpo de la solicitud no se acepta si no tiene forma: no se toca la BD
const db3 = dbQueGraba()
assert.equal(await guardarResumen(db3, { candidatoId: 'no-es-uuid', procesoId: PROCESO, resumen: 'ok' }), false)
assert.equal(await guardarResumen(db3, { candidatoId: undefined, resumen: 'ok' }), false)
assert.equal(await guardarResumen(db3, { candidatoId: CANDIDATO, resumen: '   ' }), false, 'un resumen vacio no se guarda')
assert.equal(db3.llamadas.length, 0)

// FAIL-OPEN: sin la tabla (migracion sin correr) o con la BD caida, nunca lanza y avisa que no se guardo
const silenciar = console.error
console.error = () => {}
try {
  const malas: Record<string, any> = {
    'tabla inexistente': { from: () => ({ upsert: async () => ({ error: { message: 'relation "resumenes_ia" does not exist' } }) }) },
    'from() lanza': { from: () => { throw new Error('conexion caida') } },
    'upsert rechaza': { from: () => ({ upsert: async () => { throw new Error('timeout') } }) },
  }
  for (const [nombre, malaDb] of Object.entries(malas)) {
    assert.equal(await guardarResumen(malaDb, { candidatoId: CANDIDATO, procesoId: PROCESO, resumen: 'ok' }), false, `no guardo y no lanza: ${nombre}`)
  }

  // Lectura: sin tabla o con error, el panel recibe una lista vacia y carga igual
  const lecturaMala: Record<string, any> = {
    'tabla inexistente': { from: () => ({ select: () => ({ range: () => ({ order: async () => ({ data: null, error: { message: 'relation "resumenes_ia" does not exist' } }) }) }) }) },
    'from() lanza': { from: () => { throw new Error('conexion caida') } },
  }
  for (const [nombre, malaDb] of Object.entries(lecturaMala)) {
    assert.deepEqual(await leerResumenes(malaDb), [], `lista vacia y sin lanzar: ${nombre}`)
  }
} finally {
  console.error = silenciar
}

// Lectura feliz
const filas = [{ candidato_id: CANDIDATO, proceso_id: PROCESO, resumen: 'r', generado_en: '2026-10-06T12:00:00Z' }]
const dbLee = { from: () => ({ select: () => ({ range: () => ({ order: async () => ({ data: filas, error: null }) }) }) }) }
assert.deepEqual(await leerResumenes(dbLee), filas)

// Quien ve cada resumen: solo de los candidatos indicados, mas recientes primero; una cuenta de solo lectura, solo de sus procesos
const OTRO = '11111111-2222-4333-8444-555555555555'
const PROCESO_AJENO = '99999999-2222-4333-8444-555555555555'
const todos = [
  { candidato_id: CANDIDATO, proceso_id: PROCESO, resumen: 'viejo', generado_en: '2026-10-01T12:00:00Z' },
  { candidato_id: CANDIDATO, proceso_id: null, resumen: 'nuevo sin proceso', generado_en: '2026-10-05T12:00:00Z' },
  { candidato_id: CANDIDATO, proceso_id: PROCESO_AJENO, resumen: 'de otro proceso', generado_en: '2026-10-03T12:00:00Z' },
  { candidato_id: OTRO, proceso_id: PROCESO, resumen: 'de otra persona', generado_en: '2026-10-06T12:00:00Z' },
]
assert.deepEqual(resumenesVisibles(todos, new Set([CANDIDATO]), null).map(r => r.resumen), ['nuevo sin proceso', 'de otro proceso', 'viejo'])
assert.deepEqual(resumenesVisibles(todos, new Set([CANDIDATO]), new Set([PROCESO])).map(r => r.resumen), ['viejo'])
assert.deepEqual(resumenesVisibles(todos, new Set(), null), [])
assert.deepEqual(resumenesVisibles([], new Set([CANDIDATO]), null), [])
assert.equal(todos[0].resumen, 'viejo')

console.log('✅ resumenes-ia: un resumen por candidato y proceso que se reemplaza al regenerar, ids que no son uuid no se guardan, sin la tabla o con la BD caida nunca lanza (el panel carga igual), y cada cuenta ve solo los resumenes de sus candidatos y procesos')
