import { z } from 'zod'

// Que puede ver cada supervisor: solo las parejas (candidato, proceso) que el administrador le habilito en
// supervisor_evaluados. Toda consulta del panel del supervisor pasa por aca; el navegador nunca decide el alcance.

const esUuid = (v: unknown): v is string => z.guid().safeParse(v).success

export type Habilitacion = { supervisor_email: string; candidato_id: string; proceso_id: string; habilitado_en: string | null }

/** Habilitaciones de un supervisor (mas recientes primero). Lanza si la base falla: un error no puede leerse como "sin acceso". */
export async function evaluadosHabilitados(db: any, email: string): Promise<Habilitacion[]> {
  const { data, error } = await db
    .from('supervisor_evaluados')
    .select('supervisor_email, candidato_id, proceso_id, habilitado_en')
    .eq('supervisor_email', String(email || '').trim().toLowerCase())
    .order('habilitado_en', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * true solo si existe la fila exacta (supervisor + candidato + proceso). Ids que no son uuid dan false sin consultar.
 * Ante un fallo de la base devuelve false (cerrado por omision) y lo registra.
 */
export async function estaHabilitado(db: any, email: string, candidatoId: unknown, procesoId: unknown): Promise<boolean> {
  if (!esUuid(candidatoId) || !esUuid(procesoId)) return false
  try {
    const { data, error } = await db
      .from('supervisor_evaluados')
      .select('candidato_id')
      .eq('supervisor_email', String(email || '').trim().toLowerCase())
      .eq('candidato_id', candidatoId)
      .eq('proceso_id', procesoId)
      .maybeSingle()
    if (error) throw error
    return !!data
  } catch (error) {
    console.error('[SUPERVISOR] No se pudo comprobar la habilitacion, se niega el acceso:', error)
    return false
  }
}
