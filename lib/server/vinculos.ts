// El vinculo candidato-proceso (tabla candidatos_procesos) es lo que exige /api/evaluacion/public-data para abrir cualquier prueba:
// sin esa fila el candidato recibe "Candidato o proceso no encontrado" aunque tenga sesiones en el proceso. /unirse ya lo creaba;
// la asignacion desde el panel, la carga masiva y "reparar vinculos" solo creaban la sesion. Estas funciones lo crean y lo quitan.

type Par = { candidatoId: string; procesoId: string }

const TANDA = 500

/** Crea los vinculos que falten (idempotente: usa la clave primaria candidato+proceso). Lanza si la base falla. */
export async function asegurarVinculos(db: any, pares: Par[]): Promise<void> {
  const unicos = new Map<string, { candidato_id: string; proceso_id: string }>()
  for (const p of pares) {
    if (p.candidatoId && p.procesoId) unicos.set(`${p.candidatoId}|${p.procesoId}`, { candidato_id: p.candidatoId, proceso_id: p.procesoId })
  }
  const filas = Array.from(unicos.values())
  for (let i = 0; i < filas.length; i += TANDA) {
    const { error } = await db.from('candidatos_procesos').upsert(filas.slice(i, i + TANDA))
    if (error) throw error
  }
}

/** Quita el vinculo de un candidato con un proceso. Lanza si la base falla. */
export async function quitarVinculo(db: any, candidatoId: string, procesoId: string): Promise<void> {
  const { error } = await db.from('candidatos_procesos').delete().eq('candidato_id', candidatoId).eq('proceso_id', procesoId)
  if (error) throw error
}

/**
 * Saca a un candidato de un proceso. Las sesiones que ya tienen algo (en curso, finalizadas) quedan guardadas pero
 * sin proceso, para no perder resultados. Las `pendiente` (asignadas y nunca abiertas, sin respuestas ni puntaje) no
 * guardan nada: se borran, porque si no quedan sueltas para siempre. Lanza si la base falla.
 */
export async function desvincularCandidato(db: any, candidatoId: string, procesoId: string): Promise<void> {
  const { error: pendientesError } = await db.from('sesiones').delete().eq('candidato_id', candidatoId).eq('proceso_id', procesoId).eq('estado', 'pendiente')
  if (pendientesError) throw pendientesError
  const { error: sesionesError } = await db.from('sesiones').update({ proceso_id: null }).eq('candidato_id', candidatoId).eq('proceso_id', procesoId)
  if (sesionesError) throw sesionesError
  await quitarVinculo(db, candidatoId, procesoId)
}
