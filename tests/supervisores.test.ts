import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { decidirRolSupervisor } = await import('../lib/server/supervisorRol.ts')
const { evaluadosHabilitados, estaHabilitado } = await import('../lib/server/supervisorAlcance.ts')

const CAND = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const PROC = '740a08d1-a5f9-45e2-9887-a7b2ece99796'
const OTRO_PROC = '11111111-2222-4333-8444-555555555555'
const EMAIL = 'jefa@empresa.com'

// ---- Quien es supervisor: en la tabla, activo, y sin otro rol ----
const base = { email: EMAIL, esAdmin: false, esViewer: false, filaSupervisor: { activo: true } }
assert.equal(decidirRolSupervisor(base), 'supervisor')
assert.equal(decidirRolSupervisor({ ...base, filaSupervisor: null }), 'no_autorizado', 'no esta en supervisores')
assert.equal(decidirRolSupervisor({ ...base, filaSupervisor: { activo: false } }), 'no_autorizado', 'desactivado')
assert.equal(decidirRolSupervisor({ ...base, filaSupervisor: { activo: null } }), 'no_autorizado', 'activo sin valor no cuenta')
assert.equal(decidirRolSupervisor({ ...base, filaSupervisor: {} }), 'no_autorizado')
assert.equal(decidirRolSupervisor({ ...base, email: '' }), 'no_autorizado', 'sin email')
assert.equal(decidirRolSupervisor({ ...base, esAdmin: true }), 'doble_rol', 'un administrador nunca entra como supervisor')
assert.equal(decidirRolSupervisor({ ...base, esViewer: true }), 'doble_rol', 'una cuenta de solo lectura tampoco')
assert.equal(decidirRolSupervisor({ ...base, esAdmin: true, filaSupervisor: null }), 'no_autorizado')

// ---- Alcance: base en memoria con la parte de la API de Supabase que usa el modulo ----
const habilitaciones = [
  { supervisor_email: EMAIL, candidato_id: CAND, proceso_id: PROC, habilitado_en: '2026-10-01T10:00:00Z' },
  { supervisor_email: 'otra@empresa.com', candidato_id: CAND, proceso_id: OTRO_PROC, habilitado_en: '2026-10-02T10:00:00Z' },
]
function dbCon(filas: any[], error: any = null, consultas: any[] = []) {
  return {
    from: (tabla: string) => {
      const filtros: Array<[string, unknown]> = []
      const q: any = {
        select: () => q,
        eq: (c: string, v: unknown) => { filtros.push([c, v]); return q },
        order: () => q,
        maybeSingle: async () => {
          consultas.push({ tabla, filtros })
          if (error) return { data: null, error }
          return { data: filas.find(f => filtros.every(([c, v]) => f[c] === v)) ?? null, error: null }
        },
        then: (res: any, rej: any) => {
          consultas.push({ tabla, filtros })
          const r = error ? { data: null, error } : { data: filas.filter(f => filtros.every(([c, v]) => f[c] === v)), error: null }
          return Promise.resolve(r).then(res, rej)
        },
      }
      return q
    },
  }
}

assert.equal(await estaHabilitado(dbCon(habilitaciones), EMAIL, CAND, PROC), true)
assert.equal(await estaHabilitado(dbCon(habilitaciones), EMAIL, CAND, OTRO_PROC), false, 'otro proceso de la misma persona')
assert.equal(await estaHabilitado(dbCon(habilitaciones), 'otra@empresa.com', CAND, PROC), false, 'habilitacion de otro supervisor')
assert.equal(await estaHabilitado(dbCon(habilitaciones), 'JEFA@Empresa.com ', CAND, PROC), true, 'el email se normaliza')

// Ids que no son uuid dan false sin consultar la base
const consultas: any[] = []
for (const raro of [undefined, null, '', 'abc', 7, {}, `${CAND}'; drop table x;--`]) {
  assert.equal(await estaHabilitado(dbCon(habilitaciones, null, consultas), EMAIL, raro, PROC), false, `candidato ${String(raro)}`)
  assert.equal(await estaHabilitado(dbCon(habilitaciones, null, consultas), EMAIL, CAND, raro), false, `proceso ${String(raro)}`)
}
assert.equal(consultas.length, 0, 'no se consulto la base con ids invalidos')

// Ante un fallo de la base se cierra el acceso (no se interpreta como "habilitado")
const consola = console.error; console.error = () => {}
assert.equal(await estaHabilitado(dbCon(habilitaciones, { message: 'caida' }), EMAIL, CAND, PROC), false)
assert.equal(await estaHabilitado({ from: () => { throw new Error('caida') } }, EMAIL, CAND, PROC), false)
console.error = consola

// La lista de habilitaciones es solo del supervisor, y un fallo se propaga (no se lee como "sin acceso")
assert.deepEqual((await evaluadosHabilitados(dbCon(habilitaciones), EMAIL)).map(h => h.proceso_id), [PROC])
assert.deepEqual(await evaluadosHabilitados(dbCon(habilitaciones), 'nadie@empresa.com'), [])
await assert.rejects(() => evaluadosHabilitados(dbCon(habilitaciones, { message: 'caida' }), EMAIL))

// ---- requireAdminSession no sabe nada de supervisores: nunca devuelve una sesion para ellos ----
const adminAuth = readFileSync('lib/server/adminAuth.ts', 'utf8')
assert.ok(!adminAuth.includes('supervisor'), 'adminAuth.ts no debe mencionar a los supervisores')

console.log('✅ supervisores: solo es supervisor quien esta en la tabla y activo y no tiene otro rol; el alcance es la fila exacta (supervisor, candidato, proceso), con ids invalidos o fallos de la base se niega, y la sesion de administrador no admite supervisores')
