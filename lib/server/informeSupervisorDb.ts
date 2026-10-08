import { informeVacio, normalizarInformeSupervisor, type InformeSupervisor } from '../informeSupervisor.ts'

// Lectura y escritura del informe para supervisores (tabla informes_supervisor, una fila por candidato y proceso). Sin next/server
// para poder testearlo. Lo publicado y el borrador son columnas aparte: editar el borrador nunca cambia lo que ve el supervisor.

export type EstadoInformeSupervisor = {
  borrador: InformeSupervisor | null
  publicado: InformeSupervisor | null
  actualizado_en: string | null
  publicado_en: string | null
  publicado_por: string | null
  /** El borrador es distinto de lo publicado (o hay borrador sin publicar). */
  conCambiosSinPublicar: boolean
}

const mismoContenido = (a: InformeSupervisor | null, b: InformeSupervisor | null) => JSON.stringify(a) === JSON.stringify(b)

/** Estado del informe de un candidato en un proceso. Lanza si la base falla. */
export async function leerInformeSupervisor(db: any, candidatoId: string, procesoId: string): Promise<EstadoInformeSupervisor> {
  const { data, error } = await db
    .from('informes_supervisor')
    .select('borrador, publicado, actualizado_en, publicado_en, publicado_por')
    .eq('candidato_id', candidatoId)
    .eq('proceso_id', procesoId)
    .maybeSingle()
  if (error) throw error
  const borrador = data?.borrador ? normalizarInformeSupervisor(data.borrador) : null
  const publicado = data?.publicado ? normalizarInformeSupervisor(data.publicado) : null
  return {
    borrador,
    publicado,
    actualizado_en: data?.actualizado_en ?? null,
    publicado_en: data?.publicado_en ?? null,
    publicado_por: data?.publicado_por ?? null,
    conCambiosSinPublicar: !!borrador && !mismoContenido(borrador, publicado),
  }
}

/**
 * Guarda el borrador (crea la fila si no existe) sin tocar lo publicado. Usa update y, si no habia fila, insert: asi un
 * borrador nuevo nunca pisa lo ya publicado. Lanza si la base falla.
 */
export async function guardarBorrador(db: any, candidatoId: string, procesoId: string, borrador: unknown): Promise<InformeSupervisor> {
  const limpio = normalizarInformeSupervisor(borrador)
  const ahora = new Date().toISOString()
  const { data: actualizadas, error } = await db
    .from('informes_supervisor')
    .update({ borrador: limpio, actualizado_en: ahora })
    .eq('candidato_id', candidatoId)
    .eq('proceso_id', procesoId)
    .select('candidato_id')
  if (error) throw error
  if (!actualizadas || actualizadas.length === 0) {
    const { error: insertError } = await db
      .from('informes_supervisor')
      .insert({ candidato_id: candidatoId, proceso_id: procesoId, borrador: limpio, actualizado_en: ahora })
    if (insertError) throw insertError
  }
  return limpio
}

/** Copia el borrador a lo publicado. Devuelve null si no hay borrador. Lanza si la base falla. */
export async function publicarBorrador(db: any, candidatoId: string, procesoId: string, email: string | null): Promise<InformeSupervisor | null> {
  const estado = await leerInformeSupervisor(db, candidatoId, procesoId)
  if (!estado.borrador) return null
  const { error } = await db
    .from('informes_supervisor')
    .update({ publicado: estado.borrador, publicado_en: new Date().toISOString(), publicado_por: email })
    .eq('candidato_id', candidatoId)
    .eq('proceso_id', procesoId)
  if (error) throw error
  return estado.borrador
}

/** Retira lo publicado (el supervisor deja de verlo); el borrador se conserva. Lanza si la base falla. */
export async function despublicar(db: any, candidatoId: string, procesoId: string): Promise<void> {
  const { error } = await db
    .from('informes_supervisor')
    .update({ publicado: null, publicado_en: null, publicado_por: null })
    .eq('candidato_id', candidatoId)
    .eq('proceso_id', procesoId)
  if (error) throw error
}

export { informeVacio }
