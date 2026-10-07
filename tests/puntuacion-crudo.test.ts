import assert from 'node:assert/strict'

const { puntuarCrudo, resumenDePuntaje, calcularPuntaje } = await import('../lib/server/puntuacion.ts')

const ID = {
  verbal: 'd4e5f6a7-b8c9-0123-defa-234567890123', numerico: 'c3d4e5f6-a7b8-9012-cdef-123456789012', atencion: 'b8c9d0e1-f2a3-4567-bcde-888888888888',
  sjtCobranzas: 'e9b2c3d4-f5a6-7890-bcde-999999999999', bigfive: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', hexaco: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  integridad: 'e5f6a7b8-c9d0-1234-efab-345678901234', estres: 'd0e1f2a3-b4c5-6789-defa-000000000001', dass: '7a8b9c0d-e1f2-4356-abcd-999999999999',
}
const it = (n: number, e: object = {}) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ...e })
const ok = (r: any) => { assert.equal(r.ok, true, r.error); return r }

// Generador determinista para no depender de Math.random
let semilla = 12345
const azar = (n: number) => { semilla = (semilla * 1103515245 + 12345) & 0x7fffffff; return semilla % n }

// ============ Tests con clave: equivalencia con la formula de las paginas (verbal/numerico, atencion, SJT) ============
{
  const factores = ['etica', 'negociacion', 'empatia']
  const items = Array.from({ length: 20 }, (_, i) => it(i + 1, { factor: factores[i % 3], opciones: ['A', 'B', 'C', 'D'], respuesta_correcta: ['A', 'B', 'C', 'D'][azar(4)] }))
  for (let vuelta = 0; vuelta < 50; vuelta++) {
    // El candidato elige un indice o se le agota el tiempo (null)
    const elecciones = items.map(() => (azar(6) === 0 ? null : azar(4)))
    const respuestas = items.map((x, i) => ({ item_id: x.id, opcion: elecciones[i] }))
    // Formula de las paginas, escrita aparte: compara el texto elegido con la respuesta correcta
    let correctas = 0
    const porFactor: Record<string, { correctas: number; total: number }> = {}
    const valores: number[] = []
    items.forEach((x, i) => {
      porFactor[x.factor] ??= { correctas: 0, total: 0 }
      porFactor[x.factor].total++
      const bien = elecciones[i] !== null && x.opciones[elecciones[i] as number] === x.respuesta_correcta
      if (bien) { correctas++; porFactor[x.factor].correctas++ }
      valores.push(bien ? 1 : 0)
    })
    const esperadoSimple = { correctas, total: 20, porcentaje: Math.round((correctas / 20) * 100) }
    assert.deepEqual(ok(puntuarCrudo(ID.verbal, items, respuestas)).puntaje, esperadoSimple, 'Verbal: forma y valores de siempre')
    assert.deepEqual(ok(puntuarCrudo(ID.numerico, items, respuestas)).puntaje, esperadoSimple, 'Numerico: igual')
    const sjt = ok(puntuarCrudo(ID.atencion, items, respuestas))
    assert.deepEqual(sjt.puntaje, { ...esperadoSimple, por_factor: porFactor })
    assert.deepEqual(sjt.respuestas.map((r: any) => r.valor), valores, 'respuestas.valor = 0/1 para TODOS los items, igual que antes')
    assert.deepEqual(sjt.resumen, sjt.puntaje, 'sin metricas el resumen es el puntaje')
    assert.deepEqual(Object.keys(sjt.puntaje), ['correctas', 'total', 'porcentaje', 'por_factor'], 'mismo orden de claves')
  }
  // SJT Cobranzas usa el mismo calculo
  assert.equal(ok(puntuarCrudo(ID.sjtCobranzas, items, [])).puntaje.correctas, 0, 'sin responder nada: 0 correctas pero total completo')
  assert.equal(ok(puntuarCrudo(ID.sjtCobranzas, items, [])).puntaje.total, 20)
}

// ---- Casos hostiles de los tests con clave ----
{
  const items = [it(1, { factor: 'f', opciones: ['A', 'B', 'C'], respuesta_correcta: 'B' }), it(2, { factor: 'f', opciones: ['A', 'B', 'C'], respuesta_correcta: 'C' })]
  assert.equal(puntuarCrudo(ID.verbal, items, [{ item_id: items[0].id, opcion: 7 }]).ok, false, 'opcion fuera de rango')
  assert.equal(puntuarCrudo(ID.verbal, items, [{ item_id: items[0].id }]).ok, false, 'falta la opcion: el 0/1 del navegador no sirve')
  assert.equal(puntuarCrudo(ID.verbal, items, [{ item_id: items[0].id, valor: 1 }]).ok, false, 'un 1 mandado a mano no cuenta como acierto')
  assert.equal(puntuarCrudo(ID.verbal, items, [{ item_id: items[0].id, opcion: 'B' as any }]).ok, false, 'en formato crudo solo se acepta el indice')
  assert.equal(puntuarCrudo(ID.verbal, items, [{ item_id: 'ajeno', opcion: 0 }]).ok, false, 'item ajeno')
  assert.equal(puntuarCrudo(ID.verbal, items, [{ item_id: items[0].id, opcion: 0 }, { item_id: items[0].id, opcion: 1 }]).ok, false, 'item repetido')
  // Con valor Y opcion manda la opcion
  const r = ok(puntuarCrudo(ID.verbal, items, [{ item_id: items[0].id, opcion: 0, valor: 1 }]))
  assert.equal(r.puntaje.correctas, 0)
  assert.equal(ok(puntuarCrudo(ID.verbal, items, [{ item_id: items[0].id, opcion: 1 }, { item_id: items[1].id, opcion: 2 }])).puntaje.correctas, 2)
  // La compatibilidad del formato anterior (calcularPuntaje sin soloEleccion) sigue intacta
  assert.equal(ok(calcularPuntaje(ID.verbal, items, [{ item_id: items[0].id, valor: 1 }])).puntaje.correctas, 1)
}

// ============ Likert: el servidor invierte; equivalencia con las paginas ============
{
  const fs = ['honestidad', 'normas', 'etica']
  const items = Array.from({ length: 30 }, (_, i) => it(i + 1, { factor: fs[i % 3], inverso: i % 2 === 1 }))
  for (let vuelta = 0; vuelta < 50; vuelta++) {
    const crudos = items.map(() => 1 + azar(5))
    const respuestas = items.map((x, i) => ({ item_id: x.id, valor: crudos[i] }))
    // Pagina: invierte en el navegador (6 - v) y promedia por factor con 1 decimal; luego promedio_general
    const g: Record<string, number[]> = { honestidad: [], normas: [], etica: [] }
    items.forEach((x, i) => g[x.factor].push(x.inverso ? 6 - crudos[i] : crudos[i]))
    const medias: Record<string, number> = {}
    for (const f of fs) medias[f] = Math.round((g[f].reduce((a, b) => a + b, 0) / g[f].length) * 10) / 10
    const general = Math.round((Object.values(medias).reduce((a, b) => a + b, 0) / 3) * 10) / 10
    const r = ok(puntuarCrudo(ID.integridad, items, respuestas))
    assert.deepEqual(r.puntaje, { ...medias, promedio_general: general })
    assert.deepEqual(r.respuestas.map((x: any) => x.valor), items.map((x, i) => (x.inverso ? 6 - crudos[i] : crudos[i])), 'respuestas.valor conserva la semantica historica: ya invertido')
  }
  // Omitir items no puede mover el puntaje: se exige una respuesta para cada uno
  assert.equal(puntuarCrudo(ID.integridad, items, items.slice(0, 29).map(x => ({ item_id: x.id, valor: 3 }))).ok, false, 'faltan respuestas')
  for (const malo of [0, 6, 2.5, '3', null, undefined]) assert.equal(puntuarCrudo(ID.integridad, items.slice(0, 1), [{ item_id: items[0].id, valor: malo as any }]).ok, false, `valor ${String(malo)}`)
}

// Estres laboral: nivel_estres sale del servidor
{
  const fs = ['carga_laboral', 'relaciones', 'claridad_rol', 'equilibrio', 'burnout']
  const items = fs.map((f, i) => it(i + 1, { factor: f, inverso: false }))
  assert.equal(ok(puntuarCrudo(ID.estres, items, items.map(x => ({ item_id: x.id, valor: 5 })))).puntaje.nivel_estres, 'alto')
  assert.equal(ok(puntuarCrudo(ID.estres, items, items.map(x => ({ item_id: x.id, valor: 2 })))).puntaje.nivel_estres, 'bajo')
}

// DASS-21: suma por subescala x 2, valores 0-3
{
  const items = [it(1, { factor: 'depresion' }), it(2, { factor: 'ansiedad' }), it(3, { factor: 'estres' })]
  assert.deepEqual(ok(puntuarCrudo(ID.dass, items, [{ item_id: items[0].id, valor: 3 }, { item_id: items[1].id, valor: 0 }, { item_id: items[2].id, valor: 2 }])).puntaje, { depresion: 6, ansiedad: 0, estres: 4 })
  assert.equal(puntuarCrudo(ID.dass, items, items.map(x => ({ item_id: x.id, valor: 4 }))).ok, false, 'DASS rechaza 4')
}

// ============ metricas_fraude: solo en Big Five, DASS-21 e ICAR, y saneadas ============
{
  const items = [it(1, { factor: 'extraversion', inverso: false })]
  const resp = [{ item_id: items[0].id, valor: 4 }]
  const m = { tabSwitches: 3, copyPasteAttempts: 0, timeOutOfFocus: 9, events: [{ tipo: 'blur', timestamp: '2026-10-06T14:00:00Z' }], inyectado: 'x' }
  const big = ok(puntuarCrudo(ID.bigfive, items, resp, m))
  assert.deepEqual(big.puntaje.metricas_fraude, { tabSwitches: 3, copyPasteAttempts: 0, timeOutOfFocus: 9, events: [{ tipo: 'blur', timestamp: '2026-10-06T14:00:00Z' }] })
  assert.equal('metricas_fraude' in big.resumen, false, 'la pantalla de fin no recibe la telemetria')
  assert.equal(big.puntaje.extraversion, 4)
  // En un test sin telemetria no se guarda aunque la manden
  assert.equal('metricas_fraude' in ok(puntuarCrudo(ID.hexaco, [it(1, { factor: 'honestidad', inverso: false })], [{ item_id: it(1).id, valor: 3 }], m)).puntaje, false)
  assert.equal('metricas_fraude' in ok(puntuarCrudo(ID.bigfive, items, resp)).puntaje, false, 'sin telemetria no se inventa')
}

// ============ ICAR: el universo es el examen que fija el token (items ya filtrados), con desglose por subtipo ============
{
  const ICAR = 'f6a7b8c9-d0e1-2345-fabc-456789012345'
  const sub = ['matrices', 'series', 'rotacion']
  const items = Array.from({ length: 9 }, (_, i) => it(i + 1, { subtipo: sub[i % 3], opciones: ['A', 'B', 'C', 'D'], respuesta_correcta: 'B', nivel_dificultad: 1 + (i % 3) }))
  // Acierta los 4 primeros (indice 1 = 'B'), falla 2, deja 3 sin responder (tiempo agotado)
  const resp = items.map((x, i) => ({ item_id: x.id, opcion: i < 4 ? 1 : i < 6 ? 0 : null }))
  const r = ok(puntuarCrudo(ICAR, items, resp, { tabSwitches: 1, copyPasteAttempts: 0, timeOutOfFocus: 3, events: [] }))
  assert.equal(r.puntaje.correctas, 4)
  assert.equal(r.puntaje.total, 9)
  assert.equal(r.puntaje.porcentaje, 44)
  assert.deepEqual(r.puntaje.por_subtipo, { matrices: { correctas: 2, total: 3 }, series: { correctas: 1, total: 3 }, rotacion: { correctas: 1, total: 3 } })
  assert.deepEqual(r.puntaje.metricas_fraude, { tabSwitches: 1, copyPasteAttempts: 0, timeOutOfFocus: 3, events: [] }, 'ICAR conserva la telemetria saneada')
  assert.equal('metricas_fraude' in r.resumen, false)
  // Un item fuera del examen del candidato (por ejemplo uno de otro nivel) se rechaza como ajeno
  assert.equal(puntuarCrudo(ICAR, items.slice(0, 3), resp.slice(0, 4)).ok, false, 'respuesta a un item que no pertenece al examen')
}

// ---- resumenDePuntaje: lo que se muestra al candidato de una sesion ya guardada ----
assert.deepEqual(resumenDePuntaje({ correctas: 3, total: 5, porcentaje: 60, metricas_fraude: { tabSwitches: 1 } }), { correctas: 3, total: 5, porcentaje: 60 })
for (const malo of [null, undefined, 'x', 5, []]) assert.deepEqual(resumenDePuntaje(malo), {})

console.log('✅ puntuacion-crudo: el servidor reproduce las formulas de las paginas desde la eleccion cruda (con clave, Likert, estres, DASS-21), exige respuestas completas y opciones validas, ignora el 0/1 del navegador y sanea la telemetria')
