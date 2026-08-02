import { supabase } from '@/lib/supabase'

type InicioEvaluacionParams = {
  candidatoId: string
  procesoId: string
  testId: string
}

/** Registra el inicio real sin modificar una sesi?n ya finalizada. */
export async function marcarEvaluacionEnCurso({ candidatoId, procesoId, testId }: InicioEvaluacionParams) {
  const ahora = new Date().toISOString()
  const { data: existente, error: consultaError } = await supabase
    .from('sesiones')
    .select('id, estado, iniciada_en')
    .eq('candidato_id', candidatoId)
    .eq('proceso_id', procesoId)
    .eq('test_id', testId)
    .limit(1)
    .maybeSingle()

  if (consultaError) return { data: null, error: consultaError }
  if (existente?.estado === 'finalizado') return { data: existente, error: null }

  if (existente?.id) {
    const { data, error } = await supabase
      .from('sesiones')
      .update({ estado: 'en_progreso', iniciada_en: existente.iniciada_en || ahora })
      .eq('id', existente.id)
      .select('id, estado, iniciada_en')
      .single()
    return { data, error }
  }

  const { data, error } = await supabase
    .from('sesiones')
    .insert({ candidato_id: candidatoId, proceso_id: procesoId, test_id: testId, estado: 'en_progreso', iniciada_en: ahora })
    .select('id, estado, iniciada_en')
    .single()
  return { data, error }
}
