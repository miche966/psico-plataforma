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
