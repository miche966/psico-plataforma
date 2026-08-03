import assert from 'node:assert/strict'

const { calcularProgresoEvaluacion, TEST_IDS } = await import('../lib/progresoEvaluacion.ts')

const BIGFIVE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const ENTREVISTA_A = 'entrevista-aaaa'
const ENTREVISTA_B = 'entrevista-bbbb'

// Batería vacía: nada que completar, nada pendiente.
{
  const r = calcularProgresoEvaluacion([], [], [], {})
  assert.equal(r.total, 0)
  assert.equal(r.completados, 0)
  assert.deepEqual(r.testsCompletados, [])
}

// Sesión finalizada cuenta como completada.
{
  const r = calcularProgresoEvaluacion(['bigfive'], [{ test_id: BIGFIVE_ID, estado: 'finalizado' }], [], {})
  assert.deepEqual(r.testsCompletados, ['bigfive'])
  assert.equal(r.completados, 1)
}

// Sesión no finalizada (pendiente/iniciado) NO cuenta como completada.
{
  const r = calcularProgresoEvaluacion(['bigfive'], [{ test_id: BIGFIVE_ID, estado: 'pendiente' }], [], {})
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
  const preguntasPorEntrevista = { [ENTREVISTA_A]: 3 }

  const incompleta = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p2', estado: 'completado' },
  ], preguntasPorEntrevista)
  assert.deepEqual(incompleta.testsCompletados, [], 'con 2 de 3 preguntas respondidas, la entrevista no debe contar como completada')

  const completa = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p2', estado: 'completado' },
    { entrevista_id: ENTREVISTA_A, pregunta_id: 'p3', estado: 'completado' },
  ], preguntasPorEntrevista)
  assert.deepEqual(completa.testsCompletados, [`entrevista:${ENTREVISTA_A}`], 'con las 3 de 3 preguntas respondidas, la entrevista debe contar como completada')
}

// Caso Santiago: respuestas de video de OTRA entrevista (de otro proceso) no deben contaminar el progreso de este proceso,
// incluso si llegan mezcladas en el mismo array de respuestasVideo.
{
  const bateria = [`entrevista:${ENTREVISTA_A}`]
  const preguntasPorEntrevista = { [ENTREVISTA_A]: 2, [ENTREVISTA_B]: 2 }

  const r = calcularProgresoEvaluacion(bateria, [], [
    { entrevista_id: ENTREVISTA_B, pregunta_id: 'p1', estado: 'completado' },
    { entrevista_id: ENTREVISTA_B, pregunta_id: 'p2', estado: 'completado' },
  ], preguntasPorEntrevista)
  assert.deepEqual(r.testsCompletados, [], 'respuestas de la entrevista de otro proceso no deben marcar como completada la entrevista de este proceso')
  assert.deepEqual(r.testsPendientes, [`entrevista:${ENTREVISTA_A}`])
}

console.log('✅ calcularProgresoEvaluacion: batería vacía, finalizado/pendiente, TEST_IDS completo, cuota de preguntas por entrevista y no-contaminación entre procesos verificados')
