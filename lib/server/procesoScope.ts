/**
 * Deriva que candidatos pertenecen a un conjunto de procesos, para filtrar
 * las lecturas de una cuenta viewer (rol de solo lectura acotado a procesos
 * especificos, ver lib/server/adminAuth.ts). Misma fuente de verdad que ya
 * usa components/GestionProcesos.tsx para su pestana "Participantes":
 * sesiones.proceso_id es el vinculo real, no candidatos_procesos (vestigial).
 */
export async function candidatoIdsEnProcesos(db: any, procesoIds: string[]): Promise<Set<string>> {
  if (!procesoIds.length) return new Set()
  const { data, error } = await db
    .from('sesiones')
    .select('candidato_id')
    .in('proceso_id', procesoIds)
    .not('candidato_id', 'is', null)
  if (error) throw error
  return new Set((data || []).map((fila: any) => fila.candidato_id))
}

// respuestas_video no tiene proceso_id: su vinculo con un proceso es la entrada
// 'entrevista:<id>' en procesos.bateria_tests (mismo criterio que /api/evaluacion-access).
export async function entrevistaIdsEnProcesos(db: any, procesoIds: string[]): Promise<Set<string>> {
  if (!procesoIds.length) return new Set()
  const { data, error } = await db.from('procesos').select('bateria_tests').in('id', procesoIds)
  if (error) throw error
  const ids = new Set<string>()
  for (const proceso of data || []) {
    for (const test of proceso.bateria_tests || []) {
      if (typeof test === 'string' && test.startsWith('entrevista:')) ids.add(test.split(':')[1])
    }
  }
  return ids
}
