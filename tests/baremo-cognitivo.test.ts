import assert from 'node:assert/strict'

const { porcentajeDeAciertos, percentilEnBaremo, valoracionDePercentil, resumenCognitivo, MUESTRA_MINIMA } = await import('../lib/baremoCognitivo.ts')
const { TESTS_COGNITIVOS } = await import('../lib/testsCognitivos.ts')
const { SLUG_TO_ID } = await import('../lib/server/catalogoTests.ts')

// ---- Porcentaje de aciertos ----
assert.equal(porcentajeDeAciertos(13, 20), 65)
assert.equal(porcentajeDeAciertos(0, 20), 0)
assert.equal(porcentajeDeAciertos(7, 9), 78)
for (const [c, t] of [[1, 0], [1, -3], ['x', 20], [20, undefined], [-1, 20], [NaN, 20]] as const) assert.equal(porcentajeDeAciertos(c, t), null, `no sirve: ${c}/${t}`)
assert.equal(porcentajeDeAciertos(30, 20), 100, 'no pasa de 100')

// ---- Percentil con punto medio ----
// 100 personas: 10 con 40 %, 40 con 60 %, 40 con 80 %, 10 con 100 %
const baremo = { n: 100, histograma: { '40': 10, '60': 40, '80': 40, '100': 10 } }
assert.equal(percentilEnBaremo(baremo, 60), 30, 'debajo 10 + la mitad de 40 empatados = 30')
assert.equal(percentilEnBaremo(baremo, 80), 70)
assert.equal(percentilEnBaremo(baremo, 100), 95)
assert.equal(percentilEnBaremo(baremo, 40), 5)
assert.equal(percentilEnBaremo(baremo, 0), 1, 'por debajo de todos: minimo 1')
assert.equal(percentilEnBaremo({ n: 100, histograma: { '10': 100 } }, 100), 99, 'por encima de todos: maximo 99')
assert.equal(percentilEnBaremo(baremo, 70), 50, 'valor sin empates: lo de abajo')
// Sin baremo o con muy pocas personas no se inventa un percentil
assert.equal(percentilEnBaremo(undefined, 60), null)
assert.equal(percentilEnBaremo({ n: MUESTRA_MINIMA - 1, histograma: { '60': MUESTRA_MINIMA - 1 } }, 60), null)
assert.equal(percentilEnBaremo({ n: MUESTRA_MINIMA, histograma: { '60': MUESTRA_MINIMA } }, 60), 50)

// ---- Valoracion por cuartiles del grupo ----
for (const [p, v] of [[1, 'Bajo'], [24, 'Bajo'], [25, 'Medio'], [49, 'Medio'], [50, 'Medio alto'], [74, 'Medio alto'], [75, 'Alto'], [99, 'Alto']] as const) assert.equal(valoracionDePercentil(p), v, `P${p}`)

// ---- Solo cuentan las pruebas cognitivas ----
const ID = { verbal: SLUG_TO_ID['verbal'], numerico: SLUG_TO_ID['numerico'], icar: SLUG_TO_ID['icar'], detalle: SLUG_TO_ID['atencion-detalle'], sjt: SLUG_TO_ID['sjt-atencion'], tolerancia: SLUG_TO_ID['tolerancia-frustracion'] }
assert.deepEqual(Object.keys(TESTS_COGNITIVOS).sort(), [ID.verbal, ID.numerico, ID.icar, ID.detalle].sort())
const sesion = (test_id: string, correctas: number, total = 20, finalizada_en = '2026-10-01T10:00:00Z', estado = 'finalizado') => ({ test_id, estado, finalizada_en, puntaje_bruto: { correctas, total } })
const baremos = {
  [ID.verbal]: { n: 100, histograma: { '65': 100 } },     // todos 65 %: un 65 % cae en el medio (P50)
  [ID.numerico]: { n: 100, histograma: { '50': 100 } },   // un 70 % supera a todos (P99)
}

const brian = [sesion(ID.icar, 13), sesion(ID.sjt, 20), sesion(ID.tolerancia, 20), sesion(ID.detalle, 12), sesion(ID.verbal, 13), sesion(ID.numerico, 14)]
const r = resumenCognitivo(brian, baremos)
assert.equal(r.pruebas, 4, 'las situacionales no entran')
assert.equal(r.correctas, 52)
assert.equal(r.total, 80)
assert.equal(r.rendimiento, 3.3, '52/80 sobre 5, no 92/120 con las situacionales (que daba 3,8)')
// Verbal 65 % -> P50 ; Numerico 70 % -> P99 ; ICAR y Atencion no tienen baremo y no cuentan para el percentil
assert.equal(r.pruebasConBaremo, 2)
assert.equal(r.percentil, 75)
assert.equal(r.valoracion, 'Alto')

// Una sesion por prueba: la finalizada mas reciente; las no finalizadas no cuentan
const repetidas = [sesion(ID.verbal, 10, 20, '2026-09-01T00:00:00Z'), sesion(ID.verbal, 18, 20, '2026-10-01T00:00:00Z'), sesion(ID.verbal, 1, 20, '2026-10-05T00:00:00Z', 'en_progreso')]
const r2 = resumenCognitivo(repetidas, baremos)
assert.equal(r2.pruebas, 1)
assert.equal(r2.correctas, 18, 'la mas reciente finalizada')

// Sin pruebas cognitivas, o sin baremo, no se inventa nada
const nada = resumenCognitivo([sesion(ID.sjt, 20)], baremos)
assert.deepEqual({ ...nada }, { correctas: 0, total: 0, rendimiento: null, percentil: null, valoracion: null, pruebas: 0, pruebasConBaremo: 0 })
const sinBaremo = resumenCognitivo([sesion(ID.icar, 13)], {})
assert.equal(sinBaremo.percentil, null)
assert.equal(sinBaremo.valoracion, null)
assert.equal(sinBaremo.rendimiento, 3.3, 'el rendimiento se calcula igual sin baremo')
assert.equal(resumenCognitivo([], baremos).pruebas, 0)
assert.equal(resumenCognitivo(undefined as any, baremos).pruebas, 0)
// Puntajes que no sirven se ignoran
assert.equal(resumenCognitivo([{ test_id: ID.verbal, estado: 'finalizado', puntaje_bruto: { correctas: 5, total: 0 } }, { test_id: ID.icar, puntaje_bruto: null }], baremos).pruebas, 0)

// ---- Los datos generados son coherentes ----
const { BAREMOS } = await import('../lib/baremoCognitivoDatos.ts')
for (const id of Object.keys(TESTS_COGNITIVOS)) {
  const b = BAREMOS[id]
  assert.ok(b, `hay baremo de ${TESTS_COGNITIVOS[id]}`)
  assert.ok(b.n >= MUESTRA_MINIMA, `${TESTS_COGNITIVOS[id]}: muestra suficiente`)
  assert.equal(Object.values(b.histograma).reduce((a, c) => a + c, 0), b.n, `${TESTS_COGNITIVOS[id]}: el histograma suma n`)
}

// ---- Sesiones importadas por CSV: traen solo un "porcentaje" de relleno (siempre 80) y no cuentan ----
const importada = { test_id: ID.verbal, estado: 'finalizado', finalizada_en: '2026-07-30T01:07:00Z', puntaje_bruto: { completado_csv: true, porcentaje: 80 } }
assert.equal(resumenCognitivo([importada], baremos).pruebas, 0)
const mixta = resumenCognitivo([importada, sesion(ID.verbal, 13, 20, '2026-06-01T00:00:00Z')], baremos)
assert.equal(mixta.pruebas, 1, 'la importada no tapa a una sesion real aunque sea mas nueva')
assert.equal(mixta.correctas, 13)

// El id de la prueba no distingue mayusculas
assert.equal(resumenCognitivo([{ ...sesion(ID.verbal, 13), test_id: ID.verbal.toUpperCase() }], baremos).pruebas, 1)

console.log('✅ baremo-cognitivo: el percentil sale del grupo de cada prueba (punto medio), la valoracion es por cuartiles, solo cuentan las pruebas cognitivas (una sesion por prueba) y sin baremo no se inventa nada')
