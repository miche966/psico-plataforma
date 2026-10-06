// Guarda el resultado final de un test contra /api/evaluacion/public-data con reintentos.
//
// Por qué existe: casi todas las páginas de test marcaban la evaluación como "finalizado"
// (y disparaban la redirección al portal) antes de confirmar que el guardado en el servidor
// funcionó, o sin revertir ese estado si fallaba. Si el guardado fallaba por lo que sea (token
// vencido, arranque en frío del servidor, un corte de red), el candidato terminaba viendo
// "¡Evaluación completada!" sin que se haya guardado una sola respuesta (caso real: Sara
// Franco, 31/07/2026). Este helper centraliza el guardado para que cada página solo necesite
// marcar "finalizado" cuando esta función confirma éxito, nunca antes.
export type ResultadoFinalizarTest = { ok: true } | { ok: false; error: string }

export async function finalizarTest(params: {
  candidatoId: string | null | undefined
  procesoId: string | null | undefined
  token: string
  testId: string
  sesionId?: string
  puntajeBruto: unknown
  respuestas?: unknown[]
  intentos?: number
}): Promise<ResultadoFinalizarTest> {
  const intentos = params.intentos ?? 3
  let ultimoError = 'No se pudo guardar la evaluación.'

  for (let intento = 0; intento < intentos; intento++) {
    try {
      const response = await fetch('/api/evaluacion/public-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          candidato_id: params.candidatoId,
          proceso_id: params.procesoId,
          token: params.token,
          test_id: params.testId,
          sesion_id: params.sesionId,
          puntaje_bruto: params.puntajeBruto,
          respuestas: params.respuestas || [],
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.ok) return { ok: true }
      // Si la sesión ya estaba finalizada (otro intento anterior sí llegó a guardarse),
      // no es un error real — no hay nada más que guardar.
      if (payload.alreadyCompleted) return { ok: true }
      ultimoError = payload.error || ultimoError
    } catch (err: any) {
      ultimoError = err?.message || 'Error de conexión al guardar la evaluación.'
    }
    if (intento < intentos - 1) await new Promise(r => setTimeout(r, 1000 * (intento + 1)))
  }

  return { ok: false, error: ultimoError }
}

// Formato crudo (etapa 3 de docs/PUNTAJE_EN_SERVIDOR.md): el navegador manda SOLO lo que el candidato eligio y el servidor
// calcula el puntaje. `opcion` es el indice de la opcion elegida (null si se agoto el tiempo); en los Likert, `valor` es el
// valor crudo (sin invertir). `resumen` es lo que el servidor calculo, para mostrarlo en la pantalla de fin.
export type RespuestaCruda = { item_id: string; opcion?: number | null; valor?: number }
export type ResultadoFinalizarTestCrudo = { ok: true; resumen: Record<string, unknown> } | { ok: false; error: string }

export async function finalizarTestCrudo(params: {
  candidatoId: string | null | undefined
  procesoId: string | null | undefined
  token: string
  testId: string
  sesionId?: string
  respuestas: RespuestaCruda[]
  metricasFraude?: unknown
  intentos?: number
}): Promise<ResultadoFinalizarTestCrudo> {
  const intentos = params.intentos ?? 3
  let ultimoError = 'No se pudo guardar la evaluación.'

  for (let intento = 0; intento < intentos; intento++) {
    try {
      const response = await fetch('/api/evaluacion/public-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          formato: 'crudo',
          candidato_id: params.candidatoId,
          proceso_id: params.procesoId,
          token: params.token,
          test_id: params.testId,
          sesion_id: params.sesionId,
          puntaje_bruto: params.metricasFraude ? { metricas_fraude: params.metricasFraude } : {},
          respuestas: params.respuestas.map(r => ({ ...r, tiempo_respuesta: 0 })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      // Si la sesion ya estaba finalizada (un intento anterior si llego a guardarse) el servidor devuelve igual el resumen
      if (response.ok || payload.alreadyCompleted) return { ok: true, resumen: payload.resumen || {} }
      ultimoError = payload.error || ultimoError
      if (response.status === 400) break // pedido invalido: reintentar no lo arregla
    } catch (err: any) {
      ultimoError = err?.message || 'Error de conexión al guardar la evaluación.'
    }
    if (intento < intentos - 1) await new Promise(r => setTimeout(r, 1000 * (intento + 1)))
  }

  return { ok: false, error: ultimoError }
}

export const MENSAJE_ERROR_GUARDADO =
  'No pudimos guardar tus respuestas por un problema de conexión. No cierres esta ventana — presioná "Reintentar".'
