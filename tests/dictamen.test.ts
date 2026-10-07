import assert from 'node:assert/strict'

const { dictamenValido, etiquetaDictamen, resumenDictamenes } = await import('../lib/dictamen.ts')
const { leerDictamenes } = await import('../lib/server/dictamenes.ts')

// ---- Solo cuentan los tres dictamenes conocidos ----
assert.equal(dictamenValido('recomendado'), 'recomendado')
assert.equal(dictamenValido('con_reservas'), 'con_reservas')
assert.equal(dictamenValido('no_recomendado'), 'no_recomendado')
for (const raro of [undefined, null, '', 'Recomendado', 'si', 3, {}]) assert.equal(dictamenValido(raro), null, String(raro))

// ---- Etiqueta para la planilla: sin dictamen guardado, un guion (nunca "Recomendado" por omision) ----
assert.equal(etiquetaDictamen('recomendado'), 'Recomendado')
assert.equal(etiquetaDictamen('con_reservas'), 'Recomendado con reservas')
assert.equal(etiquetaDictamen('no_recomendado'), 'No recomendado')
assert.equal(etiquetaDictamen(undefined), '-')
assert.equal(etiquetaDictamen(null), '-')
assert.equal(etiquetaDictamen('otra cosa'), '-')

// ---- Porcentajes sobre las personas CON dictamen, con el recuento a la vista ----
assert.deepEqual(resumenDictamenes(['recomendado', 'recomendado', 'con_reservas', 'no_recomendado']), {
  recomendado: '50% (2 de 4 con dictamen)', conReservas: '25% (1 de 4 con dictamen)', noRecomendado: '25% (1 de 4 con dictamen)', conDictamen: 4,
})
assert.deepEqual(resumenDictamenes(['recomendado']), { recomendado: '100% (1 de 1 con dictamen)', conReservas: '0% (0 de 1 con dictamen)', noRecomendado: '0% (0 de 1 con dictamen)', conDictamen: 1 })
// Lo que no es un dictamen no cuenta, y sin ninguno no se inventan porcentajes
assert.deepEqual(resumenDictamenes([undefined, null, 'x']), { recomendado: '-', conReservas: '-', noRecomendado: '-', conDictamen: 0 })
assert.deepEqual(resumenDictamenes([]), { recomendado: '-', conReservas: '-', noRecomendado: '-', conDictamen: 0 })
assert.equal(resumenDictamenes(undefined as any).conDictamen, 0)

// ---- Lectura de la base: solo dictamenes validos, y una falla no rompe el panel ----
const dbCon = (filas: any[], error: any = null) => ({
  from: (_: string) => ({ select: (_c: string) => ({ order: (_o: string) => ({ range: async (d: number) => ({ data: d === 0 ? filas : [], error }) }) }) }),
})
const leidos = await leerDictamenes(dbCon([
  { candidato_id: 'a', recomendacion: 'recomendado', actualizado_en: '2026-07-13T18:00:00Z' },
  { candidato_id: 'b', recomendacion: 'no_recomendado', actualizado_en: null },
  { candidato_id: 'c', recomendacion: null, actualizado_en: null },
  { candidato_id: 'd', recomendacion: 'cualquiera', actualizado_en: null },
]))
assert.deepEqual(leidos.map(l => [l.candidato_id, l.recomendacion]), [['a', 'recomendado'], ['b', 'no_recomendado']])
const consola = console.error; console.error = () => {}
assert.deepEqual(await leerDictamenes(dbCon([], { message: 'no existe la tabla' })), [])
assert.deepEqual(await leerDictamenes({ from: () => { throw new Error('caida') } }), [])
console.error = consola

console.log('✅ dictamen: solo cuentan recomendado, con reservas y no recomendado; sin dictamen guardado la planilla muestra un guion y nunca "Recomendado" por omision; los porcentajes se calculan sobre quienes lo tienen y muestran el recuento')
