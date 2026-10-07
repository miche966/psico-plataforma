import assert from 'node:assert/strict'

const { aplicarInformeGuardado } = await import('../lib/informeGuardado.ts')
const { leerInformeGuardado } = await import('../lib/server/informeGuardado.ts')

const base = {
  recomendacion: 'con_reservas', fundamentacion: '', resumenEjecutivo: '', fortalezas: ['', '', ''], oportunidadesMejora: ['', ''],
  ajusteCargo: { score: 0, analisis: '' }, interpretacionPorFactor: {}, interpretacionVersion: undefined, nombreEvaluador: 'Michel Ochoa',
  liderazgo: 0, adaptabilidad: 0, resiliencia: 0, colaboracion: 0, comunicacion: 0,
  confianza: 80, alertasTab: 2, alertasCopia: 1, tiempoPromedio: 12, analisisEntrevista: null,
}

// ---- Sin informe guardado (o con algo que no es un informe) la pagina queda como estaba ----
for (const nada of [null, undefined, 'texto', 7, [], true]) assert.equal(aplicarInformeGuardado(base, nada), base, String(nada))
assert.deepEqual(aplicarInformeGuardado(base, {}), base)

// ---- Se recupera lo que el evaluador dejo escrito ----
const guardado = {
  recomendacion: 'recomendado', fundamentacion: 'Texto aprobado', resumenEjecutivo: 'Resumen aprobado', nombreEvaluador: 'Ana Perez',
  fortalezas: [{ tendencia: 'Orden', mecanismo: 'Planifica', impacto_organizacional: 'Previsibilidad' }, 'Una fortaleza en texto'],
  oportunidadesMejora: [{ tendencia: 'Delegar', mecanismo: 'Concentra tareas', impacto_organizacional: 'Cuello de botella' }],
  ajusteCargo: { score: 77, analisis: 'Encaja bien' }, interpretacionPorFactor: { apertura: 'Abierta a lo nuevo' }, interpretacionVersion: 2,
  mbtiType: 'ENFJ', ajusteMbti: 'Coherente', liderazgo: 70, adaptabilidad: 65, resiliencia: 80, colaboracion: 75, comunicacion: 72,
  analisisEntrevista: { trayectoriaMotivacion: 'Motivada', gestionConflictos: 'Dialoga' },
}
const r = aplicarInformeGuardado(base, guardado) as any
assert.equal(r.recomendacion, 'recomendado')
assert.equal(r.fundamentacion, 'Texto aprobado')
assert.equal(r.resumenEjecutivo, 'Resumen aprobado')
assert.equal(r.nombreEvaluador, 'Ana Perez')
assert.deepEqual(r.fortalezas, guardado.fortalezas)
assert.deepEqual(r.oportunidadesMejora, guardado.oportunidadesMejora)
assert.deepEqual(r.ajusteCargo, { score: 77, analisis: 'Encaja bien' })
assert.deepEqual(r.interpretacionPorFactor, { apertura: 'Abierta a lo nuevo' })
assert.equal(r.interpretacionVersion, 2)
assert.equal(r.mbtiType, 'ENFJ')
assert.equal(r.ajusteMbti, 'Coherente')
assert.deepEqual([r.liderazgo, r.adaptabilidad, r.resiliencia, r.colaboracion, r.comunicacion], [70, 65, 80, 75, 72])
// La entrevista se completa con vacios para que la pagina no encuentre campos faltantes
assert.deepEqual(r.analisisEntrevista, { trayectoriaMotivacion: 'Motivada', estiloTrabajoAutoridad: '', gestionConflictos: 'Dialoga', resilienciaFrustracion: '', autoconceptoMetas: '' })
// No muta la entrada
assert.equal(base.fundamentacion, '')
assert.equal(base.recomendacion, 'con_reservas')

// ---- Lo calculado con las sesiones de hoy NO se restaura aunque venga en lo guardado ----
const conVivos = aplicarInformeGuardado(base, { ...guardado, confianza: 5, alertasTab: 99, alertasCopia: 98, tiempoPromedio: 1 }) as any
assert.deepEqual([conVivos.confianza, conVivos.alertasTab, conVivos.alertasCopia, conVivos.tiempoPromedio], [80, 2, 1, 12])

// ---- Valores con forma rara se descartan sin romper nada ----
const raro = aplicarInformeGuardado(base, {
  recomendacion: 'quizas', fundamentacion: 12, fortalezas: 'no es lista', oportunidadesMejora: [null, 3, 'ok', { tendencia: 'T', mecanismo: 5 }],
  ajusteCargo: { score: 'alto', analisis: null }, interpretacionPorFactor: { a: 'bien', b: 4 }, liderazgo: NaN, comunicacion: '70', analisisEntrevista: 'x',
}) as any
assert.equal(raro.recomendacion, 'con_reservas')
assert.equal(raro.fundamentacion, '')
assert.deepEqual(raro.fortalezas, ['', '', ''])
assert.deepEqual(raro.oportunidadesMejora, ['ok', { tendencia: 'T' }])
assert.deepEqual(raro.ajusteCargo, { score: 0, analisis: '' })
assert.deepEqual(raro.interpretacionPorFactor, { a: 'bien' })
assert.equal(raro.liderazgo, 0)
assert.equal(raro.comunicacion, 0)
assert.equal(raro.analisisEntrevista, null)

// ---- Lectura de la base: devuelve el informe o null, y una falla no rompe la pagina ----
const dbCon = (resultado: any) => ({ from: (_: string) => ({ select: (_c: string) => ({ eq: (_k: string, _v: string) => ({ maybeSingle: async () => resultado }) }) }) })
assert.deepEqual(await leerInformeGuardado(dbCon({ data: { contenido: { a: 1 }, actualizado_en: '2026-07-13T18:00:00Z' }, error: null }), 'x'), { contenido: { a: 1 }, actualizado_en: '2026-07-13T18:00:00Z' })
assert.deepEqual(await leerInformeGuardado(dbCon({ data: { contenido: { a: 1 } }, error: null }), 'x'), { contenido: { a: 1 }, actualizado_en: null })
assert.equal(await leerInformeGuardado(dbCon({ data: null, error: null }), 'x'), null)
assert.equal(await leerInformeGuardado(dbCon({ data: { contenido: null }, error: null }), 'x'), null)
assert.equal(await leerInformeGuardado(dbCon({ data: { contenido: 'texto' }, error: null }), 'x'), null)
const consola = console.error; console.error = () => {}
assert.equal(await leerInformeGuardado(dbCon({ data: null, error: { message: 'no existe la tabla' } }), 'x'), null)
assert.equal(await leerInformeGuardado({ from: () => { throw new Error('caida') } }, 'x'), null)
console.error = consola

console.log('✅ informe-guardado: al abrir se recupera el texto aprobado (con formas raras descartadas), lo calculado con las sesiones de hoy no se pisa, y sin informe o con la base caida la pagina abre igual')
