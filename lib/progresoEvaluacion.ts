export const TEST_IDS: Record<string, string> = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': 'bigfive', 'f6a7b8c9-d0e1-2345-fabc-456789012345': 'icar',
  'd0e1f2a3-b4c5-6789-defa-000000000001': 'estres-laboral', 'e1f2a3b4-c5d6-7890-efab-111222333444': 'creatividad',
  'e5f6a7b8-c9d0-1234-efab-345678901234': 'integridad', 'b2c3d4e5-f6a7-8901-bcde-f12345678901': 'hexaco',
  'c3d4e5f6-a7b8-9012-cdef-123456789012': 'numerico', 'd4e5f6a7-b8c9-0123-defa-234567890123': 'verbal',
  'a7b8c9d0-e1f2-3456-abcd-777777777777': 'sjt-ventas', 'e5f6a7b8-c9d0-1234-efab-555555555555': 'tolerancia-frustracion',
  'f2a3b4c5-d6e7-8901-fabc-222333444555': 'sjt-problemas', 'c9d0e1f2-a3b4-5678-cdef-999999999999': 'sjt-legal',
  'b2c3d4e5-f6a7-8901-bcde-222222222222': 'sjt-comercial', 'a1b2c3d4-e5f6-7890-abcd-111111111111': 'comercial',
  'b8c9d0e1-f2a3-4567-bcde-888888888888': 'atencion-detalle', 'f6a7b8c9-d0e1-2345-fabc-666666666666': 'sjt-atencion',
  '7a8b9c0d-e1f2-4356-abcd-999999999999': 'dass21', 'e9b2c3d4-f5a6-7890-bcde-999999999999': 'sjt-cobranzas',
  'f7a8b9c0-d1e2-4356-abcd-888888888888': 'frases-incompletas', 'd8e9f0a1-b2c3-4567-defa-888888888888': 'roleplay',
  'd8e9f0a1-b2c3-4567-defa-777777777777': 'roleplay_atencion',
  '0b6ade42-0c8f-4084-a4a5-9ff7869d73b6': 'iniciativa-dinamismo',
}

export type ProgresoItem = { test_id?: string | null; estado?: string | null; entrevista_id?: string | null; pregunta_id?: string | null }
export type ProgresoResultado = { completados: number; total: number; testsCompletados: string[]; testsPendientes: string[] }

export function normalizarTestId(testId: string | null | undefined): string | null {
  return testId ? (TEST_IDS[testId] || testId) : null
}

export function calcularProgresoEvaluacion(bateria: string[] = [], sesiones: ProgresoItem[] = [], respuestasVideo: ProgresoItem[] = [], preguntasPorEntrevista: Record<string, number> = {}): ProgresoResultado {
  const completados = new Set<string>()
  sesiones.forEach(s => {
    if (s.estado && s.estado !== 'finalizado') return
    const key = normalizarTestId(s.test_id)
    if (key && bateria.includes(key)) completados.add(key)
  })
  const respuestas = new Map<string, Set<string>>()
  respuestasVideo.forEach(v => {
    if (v.estado && v.estado !== 'completado') return
    if (!v.entrevista_id || !v.pregunta_id) return
    if (!respuestas.has(v.entrevista_id)) respuestas.set(v.entrevista_id, new Set())
    respuestas.get(v.entrevista_id)!.add(v.pregunta_id)
  })
  respuestas.forEach((preguntas, entrevistaId) => {
    const key = `entrevista:${entrevistaId}`
    if ((preguntasPorEntrevista[entrevistaId] || 0) > 0 && preguntas.size >= preguntasPorEntrevista[entrevistaId] && bateria.includes(key)) completados.add(key)
  })
  const testsCompletados = bateria.filter(key => completados.has(key))
  return { completados: testsCompletados.length, total: bateria.length, testsCompletados, testsPendientes: bateria.filter(key => !completados.has(key)) }
}
