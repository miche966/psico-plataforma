import assert from 'node:assert/strict'

const { sanearMetricasFraude } = await import('../lib/server/metricasFraude.ts')

// ---- Lo que manda el navegador de verdad (hooks/useProctoring.ts) pasa igual ----
const real = { tabSwitches: 2, copyPasteAttempts: 1, timeOutOfFocus: 14, events: [{ tipo: 'tab_switch', timestamp: '2026-10-06T14:00:00.000Z' }, { tipo: 'blur', timestamp: '2026-10-06T14:00:05.000Z', duracion: 7 }] }
assert.deepEqual(sanearMetricasFraude(real), real)

// ---- Lo que no es un objeto no se guarda ----
for (const malo of [undefined, null, 'texto', 7, true, [], [1, 2]]) assert.equal(sanearMetricasFraude(malo), undefined, `descarta ${JSON.stringify(malo)}`)

// ---- Numeros: solo finitos y no negativos; con tope ----
{
  const m = sanearMetricasFraude({ tabSwitches: -5, copyPasteAttempts: 'mucho', timeOutOfFocus: Infinity, events: [] })!
  assert.deepEqual([m.tabSwitches, m.copyPasteAttempts, m.timeOutOfFocus], [0, 0, 0])
  assert.equal(sanearMetricasFraude({ tabSwitches: 9e15 })!.tabSwitches, 1_000_000, 'con tope')
  assert.equal(sanearMetricasFraude({ tabSwitches: 2.6 })!.tabSwitches, 3, 'redondeado')
}

// ---- Eventos: solo los tipos conocidos, con largo y forma acotados ----
{
  const m = sanearMetricasFraude({ events: [
    { tipo: 'tab_switch', timestamp: 'no es fecha' }, { tipo: 'hack', timestamp: '2026-10-06T14:00:00Z' }, null, 'x', 7,
    { tipo: 'copy_paste', timestamp: '2026-10-06T14:00:00Z', duracion: -3, extra: 'campo ajeno' },
    { tipo: 'context_menu', timestamp: '2026-10-06T14:00:00Z', duracion: 4 },
  ] })!
  assert.deepEqual(m.events, [
    { tipo: 'tab_switch', timestamp: '' },
    { tipo: 'copy_paste', timestamp: '2026-10-06T14:00:00Z' },
    { tipo: 'context_menu', timestamp: '2026-10-06T14:00:00Z', duracion: 4 },
  ], 'tipos desconocidos, no-objetos, campos ajenos y duraciones negativas se descartan')
  const muchos = sanearMetricasFraude({ events: Array.from({ length: 5000 }, () => ({ tipo: 'blur', timestamp: '2026-10-06T14:00:00Z' })) })!
  assert.equal(muchos.events.length, 200, 'a lo sumo 200 eventos')
}
// Una cadena enorme en timestamp no pasa de 40 caracteres
assert.ok(sanearMetricasFraude({ events: [{ tipo: 'blur', timestamp: '2026-10-06T14:00:00Z' + 'x'.repeat(5000) }] })!.events.every(e => e.timestamp.length <= 40))

console.log('✅ metricas-fraude: lo real pasa igual y un pedido hecho a mano no puede meter claves, tipos ni tamanos arbitrarios')
