import { dictamenValido, type Dictamen } from '../dictamen.ts'

export type DictamenGuardado = { candidato_id: string; recomendacion: Dictamen; actualizado_en: string | null }

/**
 * Lee el dictamen de cada informe guardado (solo ese campo: el informe completo es grande y no hace falta). Un informe sin
 * dictamen valido se omite. Si la tabla no existe o la base falla devuelve [] y se loguea: la planilla muestra guiones.
 */
export async function leerDictamenes(db: any): Promise<DictamenGuardado[]> {
  try {
    const filas: any[] = []
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db
        .from('informes_psicometricos')
        .select('candidato_id, recomendacion:contenido->>recomendacion, actualizado_en')
        .order('candidato_id')
        .range(desde, desde + 999)
      if (error) throw error
      filas.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    return filas
      .map(f => ({ candidato_id: String(f.candidato_id), recomendacion: dictamenValido(f.recomendacion), actualizado_en: f.actualizado_en ?? null }))
      .filter((f): f is DictamenGuardado => f.recomendacion !== null)
  } catch (error) {
    console.error('[DICTAMENES] No se pudieron leer los dictamenes guardados, se devuelve vacio:', error)
    return []
  }
}
