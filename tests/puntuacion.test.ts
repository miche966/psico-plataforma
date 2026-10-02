import assert from 'node:assert/strict'

const { calcularPuntaje, diferenciasDePuntaje, esPuntuable, bancoDeItems, esIcar } = await import('../lib/server/puntuacion.ts')

const BIGFIVE = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const HEXACO = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
const INTEGRIDAD = 'e5f6a7b8-c9d0-1234-efab-345678901234'
const INICIATIVA = '0b6ade42-0c8f-4084-a4a5-9ff7869d73b6'
const ESTRES = 'd0e1f2a3-b4c5-6789-defa-000000000001'
const DASS = '7a8b9c0d-e1f2-4356-abcd-999999999999'
const VERBAL = 'd4e5f6a7-b8c9-0123-defa-234567890123'
const ATENCION = 'b8c9d0e1-f2a3-4567-bcde-888888888888'
const ICAR = 'f6a7b8c9-d0e1-2345-fabc-456789012345'
const SJT_COBRANZAS = 'e9b2c3d4-f5a6-7890-bcde-999999999999'
const TOLERANCIA = 'e5f6a7b8-c9d0-1234-efab-555555555555'
const FRASES = 'f7a8b9c0-d1e2-4356-abcd-888888888888'
const ROLEPLAY = 'd8e9f0a1-b2c3-4567-defa-888888888888'

const item = (n: number, extra: object = {}) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ...extra })
const resp = (it: { id: string }, extra: object) => ({ item_id: it.id, ...extra })
const ok = (r: any) => { assert.equal(r.ok, true, r.error); return r }

// ---- Cobertura: lo que se puntua y lo que no ----
for (const t of [BIGFIVE, HEXACO, INTEGRIDAD, INICIATIVA, ESTRES, DASS, VERBAL, ATENCION, ICAR, SJT_COBRANZAS, TOLERANCIA]) assert.equal(esPuntuable(t), true, t)
for (const t of [FRASES, ROLEPLAY, 'no-existe']) assert.equal(esPuntuable(t), false, `${t} no se puntua en el servidor`)
assert.equal(calcularPuntaje(FRASES, [item(1)], []).ok, false)
assert.equal(bancoDeItems(SJT_COBRANZAS), TOLERANCIA, 'SJT Cobranzas usa los items que viven bajo Tolerancia')
assert.equal(bancoDeItems(VERBAL), VERBAL)
assert.equal(esIcar(ICAR), true)
assert.equal(esIcar(VERBAL), false)

// ---- Likert: media por factor con redondeo a 1 decimal y orden de claves de la pagina ----
{
  const items = [
    item(1, { factor: 'extraversion', inverso: false }), item(2, { factor: 'extraversion', inverso: true }),
    item(3, { factor: 'neuroticismo', inverso: false }), item(4, { factor: 'neuroticismo', inverso: false }), item(5, { factor: 'neuroticismo', inverso: false }),
    item(6, { factor: 'apertura', inverso: false }), item(7, { factor: 'ajeno', inverso: false }),
  ]
  // Formato actual: el navegador ya invirtio el item 2 (valor 4 crudo -> 2 guardado)
  const r = ok(calcularPuntaje(BIGFIVE, items, [
    resp(items[0], { valor: 5 }), resp(items[1], { valor: 2 }),
    resp(items[2], { valor: 2 }), resp(items[3], { valor: 2 }), resp(items[4], { valor: 3 }),
    resp(items[5], { valor: 4 }), resp(items[6], { valor: 1 }),
  ]))
  assert.deepEqual(r.puntaje, { extraversion: 3.5, amabilidad: 0, responsabilidad: 0, neuroticismo: 2.3, apertura: 4 }, '7/3 redondea a 2.3; un factor sin items vale 0 en Big Five; el factor ajeno no entra')
  assert.deepEqual(Object.keys(r.puntaje), ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura'], 'mismas claves y orden que la pagina')
  assert.equal(r.respuestas.length, 7)
  // Eleccion cruda: el servidor invierte el item inverso (6 - 4 = 2) y guarda el valor invertido, como hoy
  const cruda = ok(calcularPuntaje(BIGFIVE, items, [resp(items[0], { valor: 5 }), resp(items[1], { valor: 4 })], { valoresInvertidos: false }))
  assert.equal(cruda.puntaje.extraversion, 3.5)
  assert.deepEqual(cruda.respuestas, [{ item_id: items[0].id, valor: 5 }, { item_id: items[1].id, valor: 2 }], 'respuestas.valor conserva su semantica actual (invertido)')
}

// HEXACO e Integridad no protegen la division por cero: un factor vacio da NaN (JSON lo guarda como null), igual que hoy
{
  const items = [item(1, { factor: 'honestidad', inverso: false })]
  const r = ok(calcularPuntaje(HEXACO, items, [resp(items[0], { valor: 3 })]))
  assert.equal(r.puntaje.honestidad, 3)
  assert.equal(Number.isNaN(r.puntaje.emocionalidad), true)
  assert.equal(JSON.stringify(r.puntaje).includes('"emocionalidad":null'), true)
  const v = ok(calcularPuntaje(INICIATIVA, [item(1, { factor: 'logro', inverso: false })], [resp(item(1), { valor: 4 })]))
  assert.deepEqual(v.puntaje, { logro: 4, dinamismo: 0 }, 'Iniciativa guarda 0 en un factor vacio')
}

// Integridad: promedio_general es la media de las medias ya redondeadas, redondeada de nuevo
{
  const items = [
    item(1, { factor: 'honestidad', inverso: false }), item(2, { factor: 'honestidad', inverso: false }), item(3, { factor: 'honestidad', inverso: false }),
    item(4, { factor: 'normas', inverso: false }), item(5, { factor: 'etica', inverso: false }),
  ]
  const r = ok(calcularPuntaje(INTEGRIDAD, items, [
    resp(items[0], { valor: 5 }), resp(items[1], { valor: 4 }), resp(items[2], { valor: 4 }), // 13/3 = 4.333 -> 4.3
    resp(items[3], { valor: 3 }), resp(items[4], { valor: 2 }),
  ]))
  assert.deepEqual(r.puntaje, { honestidad: 4.3, normas: 3, etica: 2, promedio_general: 3.1 }, '(4.3+3+2)/3 = 3.1')
}

// Estres laboral: nivel_estres por umbrales sobre promedio_general
{
  const fs = ['carga_laboral', 'relaciones', 'claridad_rol', 'equilibrio', 'burnout']
  const items = fs.map((f, i) => item(i + 1, { factor: f, inverso: false }))
  const con = (v: number) => ok(calcularPuntaje(ESTRES, items, items.map(i => resp(i, { valor: v })))).puntaje
  assert.equal(con(5).nivel_estres, 'alto')
  assert.equal(con(4).nivel_estres, 'alto', '4 exacto ya es alto')
  assert.equal(con(3).nivel_estres, 'moderado')
  assert.equal(con(2).nivel_estres, 'bajo')
  assert.deepEqual(Object.keys(con(3)), [...fs, 'promedio_general', 'nivel_estres'])
}

// ---- DASS-21: suma por subescala x 2, sin inversion ----
{
  const items = [item(1, { factor: 'depresion' }), item(2, { factor: 'depresion' }), item(3, { factor: 'ansiedad' }), item(4, { factor: 'estres' })]
  const r = ok(calcularPuntaje(DASS, items, [resp(items[0], { valor: 3 }), resp(items[1], { valor: 1 }), resp(items[2], { valor: 0 }), resp(items[3], { valor: 2 })]))
  assert.deepEqual(r.puntaje, { depresion: 8, ansiedad: 0, estres: 4 })
}

// ---- Tests con clave ----
{
  const items = [
    item(1, { factor: 'etica', opciones: ['A', 'B', 'C'], respuesta_correcta: 'B' }),
    item(2, { factor: 'etica', opciones: ['A', 'B', 'C'], respuesta_correcta: 'C' }),
    item(3, { factor: 'negociacion', opciones: ['A', 'B', 'C'], respuesta_correcta: 'A' }),
  ]
  // Formato actual: 1/0 que manda el navegador
  const actual = ok(calcularPuntaje(ATENCION, items, [resp(items[0], { valor: 1 }), resp(items[1], { valor: 0 }), resp(items[2], { valor: 1 })]))
  assert.deepEqual(actual.puntaje, { correctas: 2, total: 3, porcentaje: 67, por_factor: { etica: { correctas: 1, total: 2 }, negociacion: { correctas: 1, total: 1 } } })
  // Eleccion cruda por indice: el servidor corrige contra respuesta_correcta, sin creerle al navegador
  const cruda = ok(calcularPuntaje(ATENCION, items, [resp(items[0], { opcion: 1 }), resp(items[1], { opcion: 0 }), resp(items[2], { opcion: 0 })]))
  assert.equal(cruda.puntaje.correctas, 2)
  assert.deepEqual(cruda.respuestas.map((r: any) => r.valor), [1, 0, 1])
  // Por texto de la opcion; un valor de 1 mandado a mano NO sirve si hay opcion elegida
  const texto = ok(calcularPuntaje(ATENCION, items, [resp(items[0], { opcion: 'A', valor: 1 }), resp(items[1], { opcion: 'C' }), resp(items[2], { opcion: 'A' })]))
  assert.equal(texto.puntaje.correctas, 2)
  assert.deepEqual(texto.respuestas.map((r: any) => r.valor), [0, 1, 1], 'la opcion manda por encima del valor mandado a mano')
  // Sin respuesta (se agoto el tiempo): incorrecta, y el total sigue siendo el de los items
  const sinResponder = ok(calcularPuntaje(ATENCION, items, [resp(items[0], { opcion: 1 })]))
  assert.deepEqual([sinResponder.puntaje.correctas, sinResponder.puntaje.total, sinResponder.puntaje.porcentaje], [1, 3, 33])
  // Sin desglose en Verbal/Numerico
  const v = ok(calcularPuntaje(VERBAL, items, [resp(items[0], { opcion: 1 })]))
  assert.deepEqual(Object.keys(v.puntaje), ['correctas', 'total', 'porcentaje'])
  // Opcion inexistente
  assert.equal(calcularPuntaje(ATENCION, items, [resp(items[0], { opcion: 9 })]).ok, false)
  assert.equal(calcularPuntaje(ATENCION, items, [resp(items[0], { opcion: {} })]).ok, false)
  // SJT Cobranzas se puntua con el mismo desglose
  assert.deepEqual(Object.keys(ok(calcularPuntaje(SJT_COBRANZAS, items, [])).puntaje), ['correctas', 'total', 'porcentaje', 'por_factor'])
  assert.equal(ok(calcularPuntaje(SJT_COBRANZAS, items, [])).puntaje.correctas, 0)
  assert.equal(ok(calcularPuntaje(TOLERANCIA, items, [])).puntaje.total, 3)
}

// ICAR: desglose por subtipo, sobre el universo de items que se le pasa (ya filtrado por nivel/rotacion)
{
  const items = [
    item(1, { subtipo: 'matrices', opciones: ['a', 'b'], respuesta_correcta: 'a' }),
    item(2, { subtipo: 'matrices', opciones: ['a', 'b'], respuesta_correcta: 'b' }),
    item(3, { subtipo: 'series', opciones: ['a', 'b'], respuesta_correcta: 'a' }),
  ]
  const r = ok(calcularPuntaje(ICAR, items, [resp(items[0], { opcion: 0 }), resp(items[1], { opcion: 0 }), resp(items[2], { opcion: 0 })]))
  assert.deepEqual(r.puntaje, { correctas: 2, total: 3, porcentaje: 67, por_subtipo: { matrices: { correctas: 1, total: 2 }, series: { correctas: 1, total: 1 } } })
  assert.equal('nivel_maximo' in r.puntaje, false, 'nivel_maximo y metricas_fraude los agrega quien llama, no salen de las respuestas')
  assert.equal('metricas_fraude' in r.puntaje, false)
}

// ---- Rechazos: ids ajenos, repetidos, fuera de rango, sin items ----
{
  const items = [item(1, { factor: 'extraversion', inverso: false }), item(2, { factor: 'extraversion', inverso: false })]
  assert.equal(calcularPuntaje(BIGFIVE, items, [resp(item(99), { valor: 3 })]).ok, false, 'item de otro test')
  assert.equal(calcularPuntaje(BIGFIVE, items, [resp(items[0], { valor: 3 }), resp(items[0], { valor: 4 })]).ok, false, 'item repetido')
  for (const malo of [0, 6, 3.5, '3', null, undefined, NaN, Infinity, -1]) {
    assert.equal(calcularPuntaje(BIGFIVE, items, [resp(items[0], { valor: malo })]).ok, false, `Likert rechaza ${String(malo)}`)
  }
  for (const malo of [4, -1, 1.5, '2']) assert.equal(calcularPuntaje(DASS, [item(1, { factor: 'estres' })], [resp(item(1), { valor: malo })]).ok, false, `DASS rechaza ${String(malo)}`)
  for (const malo of [2, -1, 0.5, '1']) assert.equal(calcularPuntaje(VERBAL, [item(1, { respuesta_correcta: 'a', opciones: ['a'] })], [resp(item(1), { valor: malo })]).ok, false, `Con clave rechaza valor ${String(malo)}`)
  assert.equal(calcularPuntaje(BIGFIVE, [], []).ok, false, 'sin items')
}

// ---- Comparacion con lo que manda el navegador (modo paralelo) ----
{
  const calculado = { correctas: 2, total: 3, porcentaje: 67, por_factor: { etica: { correctas: 1, total: 2 } } }
  const enviado = { ...calculado, metricas_fraude: { tabSwitches: 1 }, nivel_maximo: 3 }
  assert.deepEqual(diferenciasDePuntaje(enviado, calculado), [], 'las claves que el servidor no calcula (metricas_fraude, nivel_maximo) no cuentan')
  assert.deepEqual(diferenciasDePuntaje({ ...enviado, correctas: 3 }, calculado), ['correctas'], 'un puntaje inflado se detecta')
  assert.deepEqual(diferenciasDePuntaje({ ...enviado, por_factor: { etica: { correctas: 2, total: 2 } } }, calculado), ['por_factor'], 'tambien dentro de un desglose')
  assert.deepEqual(diferenciasDePuntaje({ ...enviado, por_factor: { etica: { correctas: 1, total: 2 }, extra: { correctas: 9, total: 9 } } }, calculado), ['por_factor'], 'claves de mas en el desglose')
  assert.deepEqual(diferenciasDePuntaje({ x: 1 }, { a: 1 }), ['a'], 'clave ausente')
  assert.deepEqual(diferenciasDePuntaje(null, { a: 1 }), ['a'])
  assert.deepEqual(diferenciasDePuntaje('texto', { a: 1 }), ['a'])
  assert.deepEqual(diferenciasDePuntaje({ f: null, g: 2 }, { f: NaN, g: 2 }), [], 'NaN calculado equivale al null que JSON guardo')
  assert.deepEqual(diferenciasDePuntaje({ f: 0 }, { f: NaN }), ['f'])
}

console.log('✅ puntuacion: Likert (inversion, redondeo, factores vacios, promedio_general, nivel_estres), DASS-21, tests con clave (opcion por indice/texto, sin responder) e ICAR dan la misma forma que las paginas, y se rechazan ids ajenos, repetidos y valores fuera de rango')
