// Eliminacion de un candidato y de todo lo que cuelga de el. Es irreversible, asi que:
// - el servidor exige que se escriba el nombre completo (confirmacionValida);
// - se rechaza si tiene videoentrevistas, porque los archivos viven en el almacenamiento externo (R2) y borrar solo la
//   fila los dejaria huerfanos y sin forma de encontrarlos;
// - se borra primero lo que depende (respuestas, sesiones, vinculos...) y al final el candidato, sin depender de que la
//   base tenga ON DELETE CASCADE en todas las tablas.

/** Tablas con una columna candidato_id que se vacian antes de borrar al candidato. */
const TABLAS_DEL_CANDIDATO = ['candidatos_procesos', 'resumenes_ia', 'informes_psicometricos', 'progreso_evaluaciones', 'recordatorios_evaluacion'] as const

export type ResumenEliminacion = {
  candidato: { id: string; nombre: string; apellido: string; email: string }
  sesiones: number
  sesionesFinalizadas: number
  respuestas: number
  videos: number
  procesos: number
}

const normalizar = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Lo que hay que escribir para confirmar: "Nombre Apellido", sin distinguir mayusculas ni tildes. */
export function confirmacionValida(candidato: { nombre?: string | null; apellido?: string | null }, texto: unknown): boolean {
  const esperado = normalizar(`${candidato.nombre ?? ''} ${candidato.apellido ?? ''}`)
  return esperado !== '' && normalizar(texto) === esperado
}

const tablaInexistente = (error: any) => error?.code === '42P01' || error?.code === 'PGRST205'

async function contar(db: any, tabla: string, columna: string, valor: unknown): Promise<number> {
  const { count, error } = await db.from(tabla).select('*', { count: 'exact', head: true }).eq(columna, valor)
  if (error) throw error
  return count || 0
}

/** Lo que se borraria. Devuelve null si el candidato no existe. Lanza si la base falla. */
export async function resumenDeEliminacion(db: any, candidatoId: string): Promise<ResumenEliminacion | null> {
  const { data: candidato, error } = await db.from('candidatos').select('id, nombre, apellido, email').eq('id', candidatoId).maybeSingle()
  if (error) throw error
  if (!candidato) return null
  const { data: sesiones, error: sesionesError } = await db.from('sesiones').select('id, estado').eq('candidato_id', candidatoId)
  if (sesionesError) throw sesionesError
  const ids = (sesiones || []).map((s: any) => s.id)
  let respuestas = 0
  if (ids.length) {
    const { count, error: respuestasError } = await db.from('respuestas').select('*', { count: 'exact', head: true }).in('sesion_id', ids)
    if (respuestasError) throw respuestasError
    respuestas = count || 0
  }
  return {
    candidato,
    sesiones: ids.length,
    sesionesFinalizadas: (sesiones || []).filter((s: any) => s.estado === 'finalizado').length,
    respuestas,
    videos: await contar(db, 'respuestas_video', 'candidato_id', candidatoId),
    procesos: await contar(db, 'candidatos_procesos', 'candidato_id', candidatoId),
  }
}

export type ResultadoEliminacion = { ok: true; resumen: ResumenEliminacion } | { ok: false; status: number; error: string }

/** Verifica y borra. No hace nada si el candidato no existe, la confirmacion no coincide o tiene videoentrevistas. */
export async function eliminarCandidato(db: any, candidatoId: string, confirmacion: unknown): Promise<ResultadoEliminacion> {
  const resumen = await resumenDeEliminacion(db, candidatoId)
  if (!resumen) return { ok: false, status: 404, error: 'El candidato no existe' }
  if (!confirmacionValida(resumen.candidato, confirmacion)) return { ok: false, status: 400, error: 'El nombre escrito no coincide con el del candidato' }
  if (resumen.videos > 0) return { ok: false, status: 409, error: 'Tiene videoentrevistas guardadas. Hay que borrar primero esos archivos del almacenamiento de video.' }

  const { data: sesiones, error: sesionesError } = await db.from('sesiones').select('id').eq('candidato_id', candidatoId)
  if (sesionesError) throw sesionesError
  const ids = (sesiones || []).map((s: any) => s.id)
  if (ids.length) {
    const { error: respuestasError } = await db.from('respuestas').delete().in('sesion_id', ids)
    if (respuestasError) throw respuestasError
    const { error: sesionesBorrarError } = await db.from('sesiones').delete().in('id', ids)
    if (sesionesBorrarError) throw sesionesBorrarError
  }
  for (const tabla of TABLAS_DEL_CANDIDATO) {
    const { error } = await db.from(tabla).delete().eq('candidato_id', candidatoId)
    // Una tabla opcional que todavia no existe en este proyecto no impide el borrado
    if (error && !tablaInexistente(error)) throw error
  }
  const { error: candidatoError } = await db.from('candidatos').delete().eq('id', candidatoId)
  if (candidatoError) throw candidatoError
  return { ok: true, resumen }
}
