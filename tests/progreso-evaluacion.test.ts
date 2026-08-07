import assert from 'node:assert/strict'

const { calcularProgresoEvaluacion, TEST_IDS } = await import('../lib/progresoEvaluacion.ts')

const BIGFIVE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const ENTREVISTA_A = 'entrevista-aaaa'
const ENTREVISTA_B = 'entrevista-bbbb'

// Batería vacía: nada que completar, nada pendiente.
{
  const r = calcularProgresoEvaluacion([], [], [], [])
  assert.equal(r.total, 0)
  assert.equal(r.completados, 0)
  assert.deepEqual(r.testsCompletados, [])
}

// Sesión finalizada cuenta como completada.
{
  const r = calcularProgresoEvaluacion(['bigfive'], [{ test_id: BIGFIVE_ID, estado: 'finalizado' }], [], [])
  assert.deepEqual(r.testsCompletados, ['bigfive'])
  assert.equal(r.completados, 1)
}

// Sesión no finalizada (pendiente/iniciado) NO cuenta como completada.
{
  const r = calcularProgresoEvaluacion(['bigfive'], [{ test_id: BIGFIVE_ID, estado: 'pendiente' }], [], [])
  assert.deepEqual(r.testsCompletados, [])
  assert.deepEqual(r.testsPendientes, ['bigfive'])
}

// TEST_IDS incluye los 5 tipos que faltaban antes de esta corrección (dass21, sjt-cobranzas, roleplay, roleplay_atencion, frases-incompletas).
{
  const slugs = Object.values(TEST_IDS)
  ;['dass21', 'sjt-cobranzas', 'roleplay', 'roleplay_atencion', 'frases-incompletas'].forEach(slug => {
    assert.ok(slugs.includes(slug), `TEST_IDS debe incluir ${slug}`)
  })
}

// Entrevista de video: solo cuenta como completada si las respuestas alcanzan el total de preguntas de ESA entrevista.
{
  const bateria = [`entrevista:${ENTREVISTA_A}`]
  const preguntasVideo = [
    { id: 'p1', entrevista_id: ENTREVISTA_A },
    { id: 'p2', entrevista_id: ENTREVISTA_A },
    { id: 'p3', entrevista_id: ENTREVISTA_A },
  ]

  const incompleta = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p2', estado: 'completado' },
  ], preguntasVideo)
  assert.deepEqual(incompleta.testsCompletados, [], 'con 2 de 3 preguntas respondidas, la entrevista no debe contar como completada')

  const completa = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p2', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p3', estado: 'completado' },
  ], preguntasVideo)
  assert.deepEqual(completa.testsCompletados, [`entrevista:${ENTREVISTA_A}`], 'con las 3 de 3 preguntas respondidas, la entrevista debe contar como completada')
}

// Caso Santiago: respuestas de video de OTRA entrevista (de otro proceso) no deben contaminar el progreso de este proceso,
// incluso si llegan mezcladas en el mismo array de respuestasVideo.
{
  const bateria = [`entrevista:${ENTREVISTA_A}`]
  const preguntasVideo = [
    { id: 'a1', entrevista_id: ENTREVISTA_A },
    { id: 'a2', entrevista_id: ENTREVISTA_A },
    { id: 'b1', entrevista_id: ENTREVISTA_B },
    { id: 'b2', entrevista_id: ENTREVISTA_B },
  ]

  const r = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_B, pregunta_id: 'b1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_B, pregunta_id: 'b2', estado: 'completado' },
  ], preguntasVideo)
  assert.deepEqual(r.testsCompletados, [], 'respuestas de la entrevista de otro proceso no deben marcar como completada la entrevista de este proceso')
  assert.deepEqual(r.testsPendientes, [`entrevista:${ENTREVISTA_A}`])
}

// Caso Santiago Peraza (real, 2026-08-06): entrevista con ramas de experiencia [CON_EXP]/[SIN_EXP].
// Un candidato que respondió TODAS las preguntas de su rama (pero ninguna de la otra) debe quedar
// completo — antes de esta corrección se exigía siempre el total de las dos ramas juntas, algo que
// ningún candidato puede cumplir porque solo ve y responde una de las dos.
{
  const bateria = [`entrevista:${ENTREVISTA_A}`]
  const preguntasVideo = [
    { id: 'con1', entrevista_id: ENTREVISTA_A, pregunta: '[CON_EXP] ¿Contame de tu experiencia?' },
    { id: 'con2', entrevista_id: ENTREVISTA_A, pregunta: '[CON_EXP] ¿Cómo resolviste un conflicto?' },
    { id: 'sin1', entrevista_id: ENTREVISTA_A, pregunta: '[SIN_EXP] ¿Por qué te interesa el puesto?' },
    { id: 'sin2', entrevista_id: ENTREVISTA_A, pregunta: '[SIN_EXP] ¿Cómo organizás tu tiempo?' },
    { id: 'comun', entrevista_id: ENTREVISTA_A, pregunta: 'Contanos sobre vos' },
  ]

  const respondioSoloConExp = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'con1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'con2', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'comun', estado: 'completado' },
  ], preguntasVideo)
  assert.deepEqual(respondioSoloConExp.testsCompletados, [`entrevista:${ENTREVISTA_A}`], 'respondiendo las 2 [CON_EXP] + la común, la entrevista debe quedar completa aunque nunca respondió las [SIN_EXP]')

  const faltaUnaDeSuRama = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'con1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'comun', estado: 'completado' },
  ], preguntasVideo)
  assert.deepEqual(faltaUnaDeSuRama.testsCompletados, [], 'si todavía falta una pregunta de su propia rama, sigue pendiente')

  const entrevistaSinRamas = [
    { id: 'x1', entrevista_id: ENTREVISTA_B, pregunta: 'Pregunta pareja para todos' },
    { id: 'x2', entrevista_id: ENTREVISTA_B, pregunta: 'Otra pregunta pareja para todos' },
  ]
  const sinRamasIncompleta = calcularProgresoEvaluacion([`entrevista:${ENTREVISTA_B}`], [], [
    { entrevista_id: ENTREVISTA_B, pregunta_id: 'x1', estado: 'completado' },
  ], entrevistaSinRamas)
  assert.deepEqual(sinRamasIncompleta.testsCompletados, [], 'entrevistas sin ramas siguen exigiendo el total de preguntas, sin cambios')
}

console.log('✅ calcularProgresoEvaluacion: batería vacía, finalizado/pendiente, TEST_IDS completo, cuota de preguntas por entrevista, no-contaminación entre procesos y ramas de experiencia (caso Santiago) verificados')
