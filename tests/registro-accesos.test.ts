import assert from 'node:assert/strict'

const { registrarAcceso } = await import('../lib/server/registroAccesos.ts')

const CANDIDATO = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const PROCESO = '740a08d1-a5f9-45e2-9887-a7b2ece99796'
const req = (ip?: string) => new Request('https://x.test/api', { headers: ip ? { 'x-forwarded-for': ip } : {} })

const dbQueGraba = () => {
  const filas: any[] = []
  return { filas, from: (tabla: string) => ({ insert: async (fila: any) => { filas.push({ tabla, ...fila }); return { error: null } } }) }
}

// Camino feliz: se anota quien, que, de quien y desde donde
const db = dbQueGraba()
await registrarAcceso(db, { user: { email: ' Admin@Ejemplo.COM ' }, role: 'admin' }, { accion: 'ver_informe', candidatoId: CANDIDATO, procesoId: PROCESO }, req('190.1.2.3, 10.0.0.1'))
assert.equal(db.filas.length, 1)
assert.deepEqual(db.filas[0], { tabla: 'registro_accesos', admin_email: 'admin@ejemplo.com', rol: 'admin', accion: 'ver_informe', candidato_id: CANDIDATO, proceso_id: PROCESO, ip: '190.1.2.3' }, 'email normalizado, IP = primera de x-forwarded-for')

// generar-informe recibe el candidato del cuerpo de la solicitud: un valor raro no debe romper ni guardarse
const db2 = dbQueGraba()
await registrarAcceso(db2, { user: { email: 'v@x.com' }, role: 'viewer' }, { accion: 'generar_informe', candidatoId: "1'; drop table x;--", procesoId: undefined }, req())
assert.equal(db2.filas[0].candidato_id, null, 'id que no es uuid se guarda como null')
assert.equal(db2.filas[0].proceso_id, null)
assert.equal(db2.filas[0].ip, null, 'sin x-forwarded-for la IP queda null')

// FAIL-OPEN: pase lo que pase en la BD, el administrador tiene que ver su informe igual
const dbConError = { from: () => ({ insert: async () => ({ error: { message: 'relation "registro_accesos" does not exist' } }) }) }
const dbQueLanza = { from: () => { throw new Error('conexion caida') } }
const dbQueRechaza = { from: () => ({ insert: async () => { throw new Error('timeout') } }) }
const silenciar = console.error
console.error = () => {}
try {
  for (const [nombre, malaDb] of Object.entries({ 'tabla inexistente (migracion sin correr)': dbConError, 'from() lanza': dbQueLanza, 'insert rechaza': dbQueRechaza })) {
    await assert.doesNotReject(registrarAcceso(malaDb, { user: { email: 'a@b.com' }, role: 'admin' }, { accion: 'ver_videos', candidatoId: CANDIDATO }, req()), `no debe lanzar: ${nombre}`)
  }
  await assert.doesNotReject(registrarAcceso(dbQueGraba(), {}, { accion: 'ver_videos' }, req()), 'tampoco con una sesion sin user')
} finally {
  console.error = silenciar
}

console.log('✅ registro-accesos: anota quien/que/de quien/desde donde, descarta ids que no son uuid, y nunca lanza aunque la tabla no exista o la BD falle')
