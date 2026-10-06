import assert from 'node:assert/strict'

const { resolverConfigIcar, itemsDelExamenIcar, NIVEL_ICAR_POR_DEFECTO } = await import('../lib/server/icarConfig.ts')

// ---- 1. El token manda sobre todo lo demas (URL, pedido y modo estricto) ----
assert.deepEqual(resolverConfigIcar({ token: { max: 2, sinRotacion: true }, estricto: false, max: 3, sinRotacion: false }), { max: 2, sinRotacion: true, origen: 'token' })
assert.deepEqual(resolverConfigIcar({ token: { max: 1, sinRotacion: false }, estricto: true, max: 3, sinRotacion: true }), { max: 1, sinRotacion: false, origen: 'token' }, 'el candidato no puede cambiarlo desde la URL')

// ---- 2. Sin token y en modo estricto: valores por omision; la URL se ignora ----
assert.deepEqual(resolverConfigIcar({ estricto: true, max: 1, sinRotacion: '1' }), { max: NIVEL_ICAR_POR_DEFECTO, sinRotacion: false, origen: 'defecto' })
assert.equal(NIVEL_ICAR_POR_DEFECTO, 3)

// ---- 3. Transicion (sin token y sin estricto): vale la URL, como siempre, para no romper enlaces ya emitidos ----
assert.deepEqual(resolverConfigIcar({ estricto: false, max: '2', sinRotacion: '1' }), { max: 2, sinRotacion: true, origen: 'url' })
assert.deepEqual(resolverConfigIcar({ estricto: false, max: 1, sinRotacion: true }), { max: 1, sinRotacion: true, origen: 'url' }, 'tambien del cuerpo del pedido (numero y booleano)')
assert.deepEqual(resolverConfigIcar({ estricto: false }), { max: 3, sinRotacion: false, origen: 'url' })
for (const malo of [null, undefined, '', 'x', 0, -4, NaN]) assert.equal(resolverConfigIcar({ estricto: false, max: malo }).max, 3, `nivel ${String(malo)} cae al defecto`)
assert.equal(resolverConfigIcar({ estricto: false, max: 99 }).max, 3, 'no pasa del nivel 3')
assert.equal(resolverConfigIcar({ estricto: false, sinRotacion: 'si' }).sinRotacion, false, 'solo "1" o true apagan la rotacion')

// ---- 4. Los items del examen: mismo criterio que el filtro del GET ----
const it = (nivel: number | null, subtipo: string | null, id = `${nivel}-${subtipo}`) => ({ id, nivel_dificultad: nivel, subtipo })
const banco = [it(1, 'matrices'), it(2, 'matrices'), it(3, 'rotacion'), it(2, 'rotacion'), it(1, 'series'), it(3, 'series'), it(null, 'series', 'sin-nivel'), it(1, null, 'sin-subtipo')]
assert.deepEqual(itemsDelExamenIcar(banco, { max: 3, sinRotacion: false }).map(i => i.id), ['1-matrices', '2-matrices', '3-rotacion', '2-rotacion', '1-series', '3-series', 'sin-subtipo'], 'un nivel nulo no pasa (como lte en SQL)')
assert.deepEqual(itemsDelExamenIcar(banco, { max: 2, sinRotacion: false }).map(i => i.id), ['1-matrices', '2-matrices', '2-rotacion', '1-series', 'sin-subtipo'])
assert.deepEqual(itemsDelExamenIcar(banco, { max: 3, sinRotacion: true }).map(i => i.id), ['1-matrices', '2-matrices', '1-series', '3-series'], 'sin rotacion; un subtipo nulo tampoco pasa (como neq en SQL)')
assert.deepEqual(itemsDelExamenIcar(banco, { max: 1, sinRotacion: true }).map(i => i.id), ['1-matrices', '1-series'])
assert.equal(itemsDelExamenIcar([], { max: 3, sinRotacion: false }).length, 0)

// ---- 5. Lo que se firma al armar el enlace: sale de la ruta /icar?max=..&norot=.. del panel ----
{
  const { configIcarDeRuta } = await import('../lib/server/icarConfig.ts')
  assert.deepEqual(configIcarDeRuta('/icar?max=2&norot=1'), { max: 2, sinRotacion: true })
  assert.deepEqual(configIcarDeRuta('/icar?max=1'), { max: 1, sinRotacion: false })
  assert.deepEqual(configIcarDeRuta('/icar'), { max: 3, sinRotacion: false }, 'sin parametros: el examen completo')
  assert.deepEqual(configIcarDeRuta('/icar?max=9&norot=si'), { max: 3, sinRotacion: false }, 'valores raros caen al defecto')
  for (const otra of ['/test', '/evaluacion', '/verbal?max=1', '/icarx?max=1', '//malo.example/icar?max=1']) assert.equal(configIcarDeRuta(otra), undefined, `${otra} no es ICAR`)
}

console.log('✅ icar-config: el token firmado manda sobre la URL, en modo estricto la URL se ignora, en la transición se respeta el enlace anterior, y los ítems del examen salen con el mismo criterio que el filtro del GET')
