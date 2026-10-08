import { z } from 'zod'
import { readAll } from './readAll.ts'

const esUuid = (v: unknown): v is string => z.guid().safeParse(v).success

/** Una fila por candidato y proceso; "independiente" es el candidato sin proceso. */
export function claveResumen(candidatoId: string, procesoId: string | null): string {
  return `${candidatoId}:${procesoId || 'independiente'}`
}

/**
 * Guarda (o reemplaza) el resumen con IA de un candidato en un proceso (tabla resumenes_ia, ver
 * supabase/migrations/agregar_resumenes_ia.sql). Devuelve si quedo guardado.
 *
 * Nunca lanza: si la tabla todavia no existe o la BD falla, se loguea y el administrador recibe el
 * resumen igual (solo que no se conservara al recargar) -- mismo criterio fail-open que registro_accesos.
 */
export async function guardarResumen(
  db: any,
  datos: { candidatoId: unknown; procesoId?: unknown; resumen: string; email?: string | null },
): Promise<boolean> {
  try {
    if (!esUuid(datos.candidatoId) || !datos.resumen.trim()) return false
    const procesoId = esUuid(datos.procesoId) ? datos.procesoId : null
    const { error } = await db.from('resumenes_ia').upsert(
      {
        clave: claveResumen(datos.candidatoId, procesoId),
        candidato_id: datos.candidatoId,
        proceso_id: procesoId,
        resumen: datos.resumen,
        generado_en: new Date().toISOString(),
        generado_por: String(datos.email || '').trim().toLowerCase(),
      },
      { onConflict: 'clave' },
    )
    if (error) {
      console.error('[RESUMENES IA] No se pudo guardar el resumen:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[RESUMENES IA] Error guardando el resumen, se deja pasar:', err)
    return false
  }
}

export type ResumenGuardado = { candidato_id: string; proceso_id: string | null; resumen: string; generado_en: string }

/**
 * Los resumenes que una cuenta puede ver: solo de los candidatos indicados y, si se pasan procesos permitidos (cuentas de solo
 * lectura), solo de esos procesos. Los mas recientes primero.
 */
export function resumenesVisibles(
  resumenes: ResumenGuardado[],
  candidatoIds: Set<string>,
  procesosPermitidos: Set<string> | null,
): ResumenGuardado[] {
  return resumenes
    .filter(r => candidatoIds.has(r.candidato_id) && (!procesosPermitidos || (!!r.proceso_id && procesosPermitidos.has(r.proceso_id))))
    .sort((a, b) => new Date(b.generado_en).getTime() - new Date(a.generado_en).getTime())
}

/** Todos los resumenes guardados; si la tabla no existe todavia, devuelve una lista vacia. */
export async function leerResumenes(db: any): Promise<{ candidato_id: string; proceso_id: string | null; resumen: string; generado_en: string }[]> {
  try {
    return await readAll(db, 'resumenes_ia', 'candidato_id, proceso_id, resumen, generado_en', 'generado_en')
  } catch (err) {
    console.error('[RESUMENES IA] No se pudieron leer los resumenes, se deja pasar:', err)
    return []
  }
}
