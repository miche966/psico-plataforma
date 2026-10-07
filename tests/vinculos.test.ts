import assert from 'node:assert/strict'

const { asegurarVinculos, quitarVinculo, desvincularCandidato } = await import('../lib/server/vinculos.ts')

const dbQueGraba = (errorEn?: number) => {
  const llamadas: any[] = []
  let n = 0
  return {
    llamadas,
    from: (tabla: string) => ({
      upsert: async (filas: any[]) => { llamadas.push({ op: 'upsert', tabla, filas }); n++; return { error: errorEn === n ? { message: 'fallo' } : null } },
      delete: () => ({ eq: (c1: string, v1: string) => ({ eq: async (c2: string, v2: string) => { llamadas.push({ op: 'delete', tabla, [c1]: v1, [c2]: v2 }); return { error: null } } }) }),
    }),
  }
}

// Crea el vinculo con las columnas de la tabla
const db1 = dbQueGraba()
await asegurarVinculos(db1, [{ candidatoId: 'c1', procesoId: 'p1' }])
assert.deepEqual(db1.llamadas, [{ op: 'upsert', tabla: 'candidatos_procesos', filas: [{ candidato_id: 'c1', proceso_id: 'p1' }] }])

// Repetidos y filas incompletas no llegan a la base
const db2 = dbQueGraba()
await asegurarVinculos(db2, [{ candidatoId: 'c1', procesoId: 'p1' }, { candidatoId: 'c1', procesoId: 'p1' }, { candidatoId: '', procesoId: 'p1' }, { candidatoId: 'c2', procesoId: '' }])
assert.equal(db2.llamadas.length, 1)
assert.equal(db2.llamadas[0].filas.length, 1)

// Sin pares no se toca la base
const db3 = dbQueGraba()
await asegurarVinculos(db3, [])
assert.equal(db3.llamadas.length, 0)

// Una carga masiva grande va en tandas de 500
const db4 = dbQueGraba()
await asegurarVinculos(db4, Array.from({ length: 1201 }, (_, i) => ({ candidatoId: 'c' + i, procesoId: 'p1' })))
assert.deepEqual(db4.llamadas.map(l => l.filas.length), [500, 500, 201])

// Si la base falla, lanza (el panel no puede creer que el candidato quedo habilitado)
await assert.rejects(asegurarVinculos(dbQueGraba(1), [{ candidatoId: 'c1', procesoId: 'p1' }]), { message: 'fallo' })
await assert.rejects(asegurarVinculos(dbQueGraba(2), Array.from({ length: 600 }, (_, i) => ({ candidatoId: 'c' + i, procesoId: 'p1' }))), { message: 'fallo' })

// Desvincular borra solo ese par
const db5 = dbQueGraba()
await quitarVinculo(db5, 'c1', 'p1')
assert.deepEqual(db5.llamadas, [{ op: 'delete', tabla: 'candidatos_procesos', candidato_id: 'c1', proceso_id: 'p1' }])

// Desvincular un candidato borra solo sus sesiones pendientes de ese proceso, deja el resto sin proceso (no pierde resultados) y quita el vinculo
const llamadasDesvincular: any[] = []
const dbDesvincular = (falla?: 'delete' | 'update' | 'vinculo') => ({
  from: (tabla: string) => {
    const filtros: Record<string, string> = {}
    const q: any = {
      eq: (c: string, v: string) => { filtros[c] = v; return q },
      delete: () => { q.op = 'delete'; return q },
      update: (valores: any) => { q.op = 'update'; q.valores = valores; return q },
      then: (res: any, rej: any) => {
        llamadasDesvincular.push({ op: q.op, tabla, ...(q.valores ? { valores: q.valores } : {}), ...filtros })
        const clave = tabla === 'candidatos_procesos' ? 'vinculo' : q.op
        return Promise.resolve({ error: falla === clave ? { message: 'fallo' } : null }).then(res, rej)
      },
    }
    return q
  },
})
await desvincularCandidato(dbDesvincular(), 'c1', 'p1')
assert.deepEqual(llamadasDesvincular, [
  { op: 'delete', tabla: 'sesiones', candidato_id: 'c1', proceso_id: 'p1', estado: 'pendiente' },
  { op: 'update', tabla: 'sesiones', valores: { proceso_id: null }, candidato_id: 'c1', proceso_id: 'p1' },
  { op: 'delete', tabla: 'candidatos_procesos', candidato_id: 'c1', proceso_id: 'p1' },
])
// Si una etapa falla, lanza y no sigue con las siguientes
for (const etapa of ['delete', 'update', 'vinculo'] as const) {
  llamadasDesvincular.length = 0
  await assert.rejects(desvincularCandidato(dbDesvincular(etapa), 'c1', 'p1'), { message: 'fallo' })
  assert.equal(llamadasDesvincular.length, etapa === 'delete' ? 1 : etapa === 'update' ? 2 : 3)
}

console.log('✅ vinculos: crea el vinculo candidato-proceso de forma idempotente, sin repetidos ni filas incompletas, en tandas, lanza si la base falla; desvincular borra solo ese par y, al sacar a un candidato, borra sus sesiones pendientes y deja el resto sin proceso')
