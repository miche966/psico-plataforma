import assert from 'node:assert/strict'

const { confirmacionValida, resumenDeEliminacion, eliminarCandidato } = await import('../lib/server/eliminarCandidato.ts')

// Base en memoria con la parte de la API de Supabase que usa el modulo (select, eq, in, maybeSingle, delete, conteo)
function baseFalsa(tablas: Record<string, any[]>, opciones: { sinTabla?: string; falla?: string } = {}) {
  const borrados: string[] = []
  const from = (tabla: string) => {
    const filtros: Array<(f: any) => boolean> = []
    let modo: 'select' | 'delete' = 'select'
    let conteo = false
    const filas = () => (tablas[tabla] || []).filter(f => filtros.every(fn => fn(f)))
    const resultado = (): any => {
      if (opciones.sinTabla === tabla) return { data: null, count: null, error: { code: '42P01', message: 'no existe' } }
      if (opciones.falla === tabla && modo === 'delete') return { data: null, count: null, error: { code: 'XX', message: 'fallo' } }
      if (modo === 'delete') {
        const quitar = new Set(filas())
        tablas[tabla] = (tablas[tabla] || []).filter(f => !quitar.has(f))
        borrados.push(tabla)
        return { data: null, error: null }
      }
      const f = filas()
      return { data: f, count: conteo ? f.length : null, error: null }
    }
    const q: any = {
      select: (_c?: string, o?: any) => { conteo = !!o?.count; return q },
      delete: () => { modo = 'delete'; return q },
      eq: (c: string, v: unknown) => { filtros.push(f => f[c] === v); return q },
      in: (c: string, vs: unknown[]) => { filtros.push(f => vs.includes(f[c])); return q },
      maybeSingle: async () => { const r = resultado(); return { data: r.data?.[0] ?? null, error: r.error } },
      then: (res: any, rej: any) => Promise.resolve(resultado()).then(res, rej),
    }
    return q
  }
  return { from, tablas, borrados }
}

const crear = () => ({
  candidatos: [{ id: 'c1', nombre: 'Darío', apellido: 'Benedetto', email: 'a@b.com' }, { id: 'c2', nombre: 'Otra', apellido: 'Persona', email: 'o@p.com' }],
  sesiones: [{ id: 's1', candidato_id: 'c1', estado: 'finalizado' }, { id: 's2', candidato_id: 'c1', estado: 'pendiente' }, { id: 's3', candidato_id: 'c2', estado: 'finalizado' }],
  respuestas: [{ id: 'r1', sesion_id: 's1' }, { id: 'r2', sesion_id: 's1' }, { id: 'r3', sesion_id: 's3' }],
  candidatos_procesos: [{ candidato_id: 'c1', proceso_id: 'p1' }, { candidato_id: 'c2', proceso_id: 'p1' }],
  respuestas_video: [] as any[],
  resumenes_ia: [{ candidato_id: 'c1', proceso_id: 'p1' }],
})

// La confirmacion es el nombre completo, sin distinguir mayusculas, tildes ni espacios de mas
assert.equal(confirmacionValida({ nombre: 'Darío', apellido: 'Benedetto' }, 'dario  BENEDETTO '), true)
assert.equal(confirmacionValida({ nombre: 'Darío', apellido: 'Benedetto' }, 'Dario'), false)
assert.equal(confirmacionValida({ nombre: 'Darío', apellido: 'Benedetto' }, ''), false)
assert.equal(confirmacionValida({ nombre: '', apellido: '' }, ''), false)

// El resumen cuenta lo que se borraria
const db1 = baseFalsa(crear())
const r1 = await resumenDeEliminacion(db1, 'c1')
assert.deepEqual({ ...r1, candidato: undefined }, { candidato: undefined, sesiones: 2, sesionesFinalizadas: 1, respuestas: 2, videos: 0, procesos: 1 })
assert.equal(await resumenDeEliminacion(db1, 'no-existe'), null)

// Con la confirmacion correcta borra todo lo del candidato y nada de los demas
const t2 = crear()
const db2 = baseFalsa(t2)
const e2 = await eliminarCandidato(db2, 'c1', 'Dario Benedetto')
assert.equal(e2.ok, true)
assert.deepEqual(t2.candidatos.map(c => c.id), ['c2'])
assert.deepEqual(t2.sesiones.map(s => s.id), ['s3'])
assert.deepEqual(t2.respuestas.map(r => r.id), ['r3'])
assert.deepEqual(t2.candidatos_procesos.map(c => c.candidato_id), ['c2'])
assert.equal(t2.resumenes_ia.length, 0)
// El candidato se borra al final, cuando ya no queda nada que dependa de el
assert.equal(db2.borrados[db2.borrados.length - 1], 'candidatos')
assert.ok(db2.borrados.indexOf('respuestas') < db2.borrados.indexOf('sesiones') && db2.borrados.indexOf('sesiones') < db2.borrados.indexOf('candidatos'))

// Sin confirmacion o con otro nombre no se borra nada
for (const texto of [undefined, '', 'Otra Persona', 'Dario']) {
  const t = crear()
  const e = await eliminarCandidato(baseFalsa(t), 'c1', texto)
  assert.equal(e.ok, false)
  assert.equal(e.ok === false && e.status, 400)
  assert.deepEqual(t, crear())
}

// Con videoentrevistas se rechaza: los archivos quedarian huerfanos en el almacenamiento externo
const t3 = crear()
t3.respuestas_video.push({ candidato_id: 'c1', url_video: 'x' })
const e3 = await eliminarCandidato(baseFalsa(t3), 'c1', 'Dario Benedetto')
assert.equal(e3.ok === false && e3.status, 409)
assert.equal(t3.candidatos.length, 2)
assert.equal(t3.sesiones.length, 3)

// Un candidato inexistente da 404
const e4 = await eliminarCandidato(baseFalsa(crear()), 'zzz', 'Dario Benedetto')
assert.equal(e4.ok === false && e4.status, 404)

// Una tabla opcional que no existe no impide el borrado; una falla real si lo corta y no borra al candidato
const t5 = crear()
const e5 = await eliminarCandidato(baseFalsa(t5, { sinTabla: 'resumenes_ia' }), 'c1', 'Dario Benedetto')
assert.equal(e5.ok, true)
assert.deepEqual(t5.candidatos.map(c => c.id), ['c2'])
const t6 = crear()
await assert.rejects(() => eliminarCandidato(baseFalsa(t6, { falla: 'candidatos_procesos' }), 'c1', 'Dario Benedetto'))
assert.ok(t6.candidatos.some(c => c.id === 'c1'))

console.log('✅ eliminar-candidato: pide el nombre completo, borra solo lo del candidato (y al final a el), rechaza videoentrevistas, y una falla real no deja al candidato a medias')
