type EstadoOperativo = 'pendiente' | 'en_curso' | 'pausada' | 'completada' | 'error' | 'vencida'

interface ProgresoPatch {
  candidato_id: string
  proceso_id: string
  evaluacion_key: string
  token?: string | null
  estado?: EstadoOperativo
  pregunta_actual?: number | null
  total_preguntas?: number | null
  respuestas_completadas?: number
  iniciada_en?: string
  completada_en?: string | null
}

async function guardarProgreso(patch: ProgresoPatch) {
  if (!patch.candidato_id || !patch.proceso_id || !patch.token) return false
  const response = await fetch('/api/progreso-evaluacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) {
    if (response.status !== 503) console.warn('No se pudo actualizar el progreso operativo:', response.status)
    return false
  }
  return true
}

export function marcarEvaluacionOperativaEnCurso(args: { candidatoId?: string | null; procesoId?: string | null; evaluacionKey: string; token?: string | null; totalPreguntas?: number; preguntaActual?: number; respuestasCompletadas?: number }) {
  if (!args.candidatoId || !args.procesoId || !args.token) return Promise.resolve(false)
  return guardarProgreso({ candidato_id: args.candidatoId, proceso_id: args.procesoId, evaluacion_key: args.evaluacionKey, token: args.token, estado: 'en_curso', iniciada_en: new Date().toISOString(), pregunta_actual: args.preguntaActual ?? 0, total_preguntas: args.totalPreguntas ?? null, respuestas_completadas: args.respuestasCompletadas ?? 0 })
}

export function marcarEvaluacionOperativaCompletada(args: { candidatoId?: string | null; procesoId?: string | null; evaluacionKey: string; token?: string | null; totalPreguntas?: number; respuestasCompletadas?: number }) {
  if (!args.candidatoId || !args.procesoId || !args.token) return Promise.resolve(false)
  return guardarProgreso({ candidato_id: args.candidatoId, proceso_id: args.procesoId, evaluacion_key: args.evaluacionKey, token: args.token, estado: 'completada', pregunta_actual: args.totalPreguntas, total_preguntas: args.totalPreguntas, respuestas_completadas: args.respuestasCompletadas, completada_en: new Date().toISOString() })
}

export function registrarActividadEvaluacion(args: { candidatoId?: string | null; procesoId?: string | null; evaluacionKey: string; token?: string | null; preguntaActual: number; totalPreguntas: number; respuestasCompletadas: number; estado?: EstadoOperativo }) {
  if (!args.candidatoId || !args.procesoId || !args.token) return Promise.resolve(false)
  return guardarProgreso({
    candidato_id: args.candidatoId,
    proceso_id: args.procesoId,
    evaluacion_key: args.evaluacionKey,
    token: args.token,
    estado: args.estado || 'en_curso',
    pregunta_actual: args.preguntaActual,
    total_preguntas: args.totalPreguntas,
    respuestas_completadas: args.respuestasCompletadas,
  })
}