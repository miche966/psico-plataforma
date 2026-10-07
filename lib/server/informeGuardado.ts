export type InformeGuardado = { contenido: unknown; actualizado_en: string | null }

/**
 * Informe que el evaluador dejo guardado para un candidato, o null si no hay. Si la tabla no existe o la base falla devuelve
 * null y se loguea: el informe se abre igual, como si no hubiera nada guardado.
 */
export async function leerInformeGuardado(db: any, candidatoId: string): Promise<InformeGuardado | null> {
  try {
    const { data, error } = await db
      .from('informes_psicometricos')
      .select('contenido, actualizado_en')
      .eq('candidato_id', candidatoId)
      .maybeSingle()
    if (error) throw error
    if (!data || !data.contenido || typeof data.contenido !== 'object') return null
    return { contenido: data.contenido, actualizado_en: data.actualizado_en ?? null }
  } catch (error) {
    console.error('[INFORME] No se pudo leer el informe guardado, se abre sin el:', error)
    return null
  }
}
