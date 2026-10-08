import assert from 'node:assert/strict'

const { normalizarEmail, validarAlta, validarHabilitacion, idValido, otroRolDeLaCuenta, procesosDelCandidato } = await import('../lib/server/supervisoresGestion.ts')
const { borrarFactoresMfa } = await import('../lib/server/borrarFactoresMfa.ts')
const { emailsAdmin } = await import('../lib/server/supervisorRol.ts')

const CAND = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const PROC = '740a08d1-a5f9-45e2-9887-a7b2ece99796'
const PROC_2 = '11111111-2222-4333-8444-555555555555'

// ---- Alta: email valido (se normaliza) y nombre acotado ----
assert.equal(normalizarEmail('  Jefa@Empresa.COM '), 'jefa@empresa.com')
assert.equal(normalizarEmail(undefined), '')
assert.deepEqual(validarAlta({ email: ' Jefa@Empresa.com ', nombre: '  Ana   Pérez ' }), { ok: true, email: 'jefa@empresa.com', nombre: 'Ana Pérez' })
assert.deepEqual(validarAlta({ email: 'jefa@empresa.com' }), { ok: true, email: 'jefa@empresa.com', nombre: '' })
for (const mal of [undefined, null, {}, { email: '' }, { email: 'sin-arroba' }, { email: 'a@' }, { email: '@b.com' }, { email: 7 }, { email: 'a b@c.com' }]) {
  assert.equal((validarAlta(mal as any) as any).ok, false, JSON.stringify(mal))
}
assert.equal((validarAlta({ email: 'a@b.com', nombre: 'x'.repeat(121) }) as any).ok, false, 'nombre demasiado largo')
assert.equal((validarAlta({ email: 'a@b.com', nombre: 'x'.repeat(120) }) as any).ok, true)

// ---- Habilitacion: email y dos uuid ----
assert.deepEqual(validarHabilitacion({ email: 'Jefa@Empresa.com', candidato_id: CAND, proceso_id: PROC }), { ok: true, email: 'jefa@empresa.com', candidatoId: CAND, procesoId: PROC })
for (const mal of [
  {}, { email: 'jefa@empresa.com' }, { email: 'jefa@empresa.com', candidato_id: CAND }, { email: 'jefa@empresa.com', proceso_id: PROC },
  { email: 'jefa@empresa.com', candidato_id: 'abc', proceso_id: PROC }, { email: 'jefa@empresa.com', candidato_id: CAND, proceso_id: `${PROC}'--` },
  { email: 'no', candidato_id: CAND, proceso_id: PROC }, { email: 'jefa@empresa.com', candidato_id: 5, proceso_id: PROC },
]) assert.equal((validarHabilitacion(mal as any) as any).ok, false, JSON.stringify(mal))
assert.equal(idValido(CAND), true)
assert.equal(idValido('x'), false)
assert.equal(idValido(null), false)

// ---- Un administrador o una cuenta de solo lectura no pueden ser supervisores ----
const dbRoles = (viewers: string[], error: any = null) => ({
  from: (_: string) => ({ select: () => ({ eq: (_c: string, v: string) => ({ maybeSingle: async () => (error ? { data: null, error } : { data: viewers.includes(v) ? { email: v } : null, error: null }) }) }) }),
})
assert.equal(await otroRolDeLaCuenta(dbRoles([]), 'admin@empresa.com', ['admin@empresa.com']), 'admin')
assert.equal(await otroRolDeLaCuenta(dbRoles(['lector@empresa.com']), 'lector@empresa.com', ['admin@empresa.com']), 'viewer')
assert.equal(await otroRolDeLaCuenta(dbRoles(['lector@empresa.com']), 'jefa@empresa.com', ['admin@empresa.com']), null)
await assert.rejects(() => otroRolDeLaCuenta(dbRoles([], { message: 'caida' }), 'jefa@empresa.com', []), 'un fallo de la base no se lee como "sin otro rol"')

// ADMIN_EMAILS se normaliza (mayusculas, espacios, vacios)
const previo = process.env.ADMIN_EMAILS
process.env.ADMIN_EMAILS = ' Uno@Empresa.com , ,dos@empresa.com'
assert.deepEqual(emailsAdmin(), ['uno@empresa.com', 'dos@empresa.com'])
if (previo === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previo

// ---- Procesos de un candidato: los vinculados y aquellos donde tiene sesiones, sin repetir ----
const dbProcesos = (vinculos: any[], sesiones: any[], errores: { vinculos?: any; sesiones?: any } = {}) => ({
  from: (tabla: string) => {
    const filas = tabla === 'candidatos_procesos' ? vinculos : sesiones
    const error = tabla === 'candidatos_procesos' ? errores.vinculos : errores.sesiones
    const q: any = {
      select: () => q, eq: () => q, not: () => q,
      then: (res: any, rej: any) => Promise.resolve(error ? { data: null, error } : { data: filas, error: null }).then(res, rej),
    }
    return q
  },
})
assert.deepEqual((await procesosDelCandidato(dbProcesos([{ proceso_id: PROC }], [{ proceso_id: PROC }, { proceso_id: PROC_2 }, { proceso_id: null }]), CAND)).sort(), [PROC, PROC_2].sort())
assert.deepEqual(await procesosDelCandidato(dbProcesos([], []), CAND), [])
await assert.rejects(() => procesosDelCandidato(dbProcesos([], [], { vinculos: { message: 'caida' } }), CAND))
await assert.rejects(() => procesosDelCandidato(dbProcesos([], [], { sesiones: { message: 'caida' } }), CAND))

// ---- Restablecer el 2FA: encuentra la cuenta por email (sin distinguir mayusculas) y borra todos sus dispositivos ----
function dbAuth(usuarios: any[], factores: any[], opciones: { falla?: 'lista' | 'factores' | 'borrar' } = {}) {
  const borrados: string[] = []
  return {
    borrados,
    auth: {
      admin: {
        listUsers: async ({ page }: { page: number }) => (opciones.falla === 'lista' ? { data: null, error: { message: 'caida' } } : { data: { users: page === 1 ? usuarios : [] }, error: null }),
        mfa: {
          listFactors: async () => (opciones.falla === 'factores' ? { data: null, error: { message: 'caida' } } : { data: { factors: factores }, error: null }),
          deleteFactor: async ({ id }: { id: string }) => { if (opciones.falla === 'borrar') return { error: { message: 'caida' } }; borrados.push(id); return { error: null } },
        },
      },
    },
  }
}
const usuarios = [{ id: 'u1', email: 'Otra@Empresa.com' }, { id: 'u2', email: 'Jefa@Empresa.com' }]
{
  const db = dbAuth(usuarios, [{ id: 'f1' }, { id: 'f2' }])
  assert.deepEqual(await borrarFactoresMfa(db, 'jefa@empresa.com'), { encontrado: true, eliminados: 2 })
  assert.deepEqual(db.borrados, ['f1', 'f2'])
}
assert.deepEqual(await borrarFactoresMfa(dbAuth(usuarios, []), 'jefa@empresa.com'), { encontrado: true, eliminados: 0 })
assert.deepEqual(await borrarFactoresMfa(dbAuth(usuarios, [{ id: 'f1' }]), 'nadie@empresa.com'), { encontrado: false, eliminados: 0 })
for (const falla of ['lista', 'factores', 'borrar'] as const) {
  await assert.rejects(() => borrarFactoresMfa(dbAuth(usuarios, [{ id: 'f1' }], { falla }), 'jefa@empresa.com'), falla)
}

console.log('✅ supervisores-gestion: el alta valida el email y el nombre, las habilitaciones exigen email y dos uuid, un administrador o una cuenta de solo lectura no puede ser supervisor, se calculan los procesos en los que participa una persona, y restablecer el 2FA borra todos los dispositivos de esa cuenta')
