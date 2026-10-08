import { normalizarInformeSupervisor, type InformeSupervisor } from '../informeSupervisor.ts'
import { entrevistaIdsEnProcesos } from './procesoScope.ts'
import { estaHabilitado, evaluadosHabilitados } from './supervisorAlcance.ts'

// Lo que ve un supervisor (ver docs/PLAN_SUPERVISORES.md): sus evaluados habilitados, las videoentrevistas del proceso y el informe
// PUBLICADO. Cada funcion devuelve solo campos elegidos a mano (lista blanca): nunca sesiones, puntajes, respuestas, el informe
// tecnico, el dictamen ni el analisis de las videoentrevistas. Sin next/server ni S3 para poder testearlo: la firma de los videos
// se inyecta.

export type EvaluadoLista = {
  candidato_id: string
  proceso_id: string
  nombre: string
  apellido: string
  proceso_nombre: string | null
  cargo: string | null
  habilitado_en: string | null
  informe_disponible: boolean
  videos: number
}

export type DetalleEvaluado = {
  candidato_id: string
  proceso_id: string
  nombre: string
  apellido: string
  proceso_nombre: string | null
  cargo: string | null
  informe: InformeSupervisor | null
  publicado_en: string | null
}

export type VideoSupervisor = { id: string; pregunta: string; url: string | null }

const unicos = (xs: string[]) => Array.from(new Set(xs))

/** Evaluados que el administrador le habilito, con lo minimo para la lista. Lanza si la base falla. */
export async function listaEvaluados(db: any, email: string): Promise<EvaluadoLista[]> {
  const habilitaciones = await evaluadosHabilitados(db, email)
  if (habilitaciones.length === 0) return []
  const candidatoIds = unicos(habilitaciones.map(h => h.candidato_id))
  const procesoIds = unicos(habilitaciones.map(h => h.proceso_id))

  const [candidatos, procesos, informes, videos] = await Promise.all([
    db.from('candidatos').select('id, nombre, apellido').in('id', candidatoIds),
    db.from('procesos').select('id, nombre, cargo, bateria_tests').in('id', procesoIds),
    db.from('informes_supervisor').select('candidato_id, proceso_id, publicado').in('candidato_id', candidatoIds).in('proceso_id', procesoIds),
    db.from('respuestas_video').select('candidato_id, entrevista_id, pregunta_id').in('candidato_id', candidatoIds).eq('estado', 'completado'),
  ])
  for (const r of [candidatos, procesos, informes, videos]) if (r.error) throw r.error

  const candidatoPorId = new Map<string, any>((candidatos.data || []).map((c: any) => [c.id, c]))
  const procesoPorId = new Map<string, any>((procesos.data || []).map((p: any) => [p.id, p]))
  const conInforme = new Set<string>((informes.data || []).filter((i: any) => i.publicado).map((i: any) => `${i.candidato_id}:${i.proceso_id}`))
  const entrevistasDe = (p: any): Set<string> => new Set<string>((p?.bateria_tests || []).filter((t: unknown): t is string => typeof t === 'string' && t.startsWith('entrevista:')).map((t: string) => t.split(':')[1]))

  return habilitaciones
    .filter(h => candidatoPorId.has(h.candidato_id))
    .map(h => {
      const c = candidatoPorId.get(h.candidato_id)
      const p = procesoPorId.get(h.proceso_id)
      const entrevistas = entrevistasDe(p)
      // Una respuesta por pregunta (los reintentos no se cuentan dos veces)
      const preguntas = new Set<string>((videos.data || [])
        .filter((v: any) => v.candidato_id === h.candidato_id && entrevistas.has(v.entrevista_id))
        .map((v: any) => `${v.entrevista_id}:${v.pregunta_id}`))
      return {
        candidato_id: h.candidato_id,
        proceso_id: h.proceso_id,
        nombre: String(c.nombre ?? ''),
        apellido: String(c.apellido ?? ''),
        proceso_nombre: p?.nombre ?? null,
        cargo: p?.cargo ?? null,
        habilitado_en: h.habilitado_en ?? null,
        informe_disponible: conInforme.has(`${h.candidato_id}:${h.proceso_id}`),
        videos: preguntas.size,
      }
    })
}

/** Datos de un evaluado, o null si el supervisor no lo tiene habilitado en ese proceso (la ruta responde 404). */
export async function detalleEvaluado(db: any, email: string, candidatoId: unknown, procesoId: unknown): Promise<DetalleEvaluado | null> {
  if (!(await estaHabilitado(db, email, candidatoId, procesoId))) return null
  const [candidato, proceso, informe] = await Promise.all([
    db.from('candidatos').select('id, nombre, apellido').eq('id', candidatoId).maybeSingle(),
    db.from('procesos').select('id, nombre, cargo').eq('id', procesoId).maybeSingle(),
    db.from('informes_supervisor').select('publicado, publicado_en').eq('candidato_id', candidatoId).eq('proceso_id', procesoId).maybeSingle(),
  ])
  for (const r of [candidato, proceso, informe]) if (r.error) throw r.error
  if (!candidato.data) return null
  return {
    candidato_id: candidato.data.id,
    proceso_id: String(procesoId),
    nombre: String(candidato.data.nombre ?? ''),
    apellido: String(candidato.data.apellido ?? ''),
    proceso_nombre: proceso.data?.nombre ?? null,
    cargo: proceso.data?.cargo ?? null,
    // Solo lo PUBLICADO; el borrador nunca llega al supervisor
    informe: informe.data?.publicado ? normalizarInformeSupervisor(informe.data.publicado) : null,
    publicado_en: informe.data?.publicado ? informe.data.publicado_en ?? null : null,
  }
}

/**
 * Videoentrevistas del evaluado en ese proceso (solo las entrevistas del proceso), una por pregunta (la ultima grabada) y en el
 * orden de la entrevista. Devuelve null si no esta habilitado. `firmar` convierte url_video en una URL de corta vida.
 */
export async function videosDelEvaluado(
  db: any,
  email: string,
  candidatoId: unknown,
  procesoId: unknown,
  firmar: (filas: Array<{ url_video: string | null }>) => Promise<Array<{ url_video: string | null }>>,
): Promise<VideoSupervisor[] | null> {
  if (!(await estaHabilitado(db, email, candidatoId, procesoId))) return null
  const entrevistas = await entrevistaIdsEnProcesos(db, [String(procesoId)])
  if (entrevistas.size === 0) return []

  const { data: filas, error } = await db
    .from('respuestas_video')
    .select('id, entrevista_id, pregunta_id, url_video, grabada_en')
    .eq('candidato_id', candidatoId)
    .eq('estado', 'completado')
  if (error) throw error
  const delProceso = (filas || []).filter((v: any) => entrevistas.has(v.entrevista_id))
  if (delProceso.length === 0) return []

  const { data: preguntas, error: preguntasError } = await db
    .from('preguntas_video')
    .select('id, pregunta, orden')
    .in('id', unicos(delProceso.map((v: any) => v.pregunta_id).filter(Boolean)))
  if (preguntasError) throw preguntasError
  const preguntaPorId = new Map<string, any>((preguntas || []).map((p: any) => [p.id, p]))

  // Una por pregunta: la ultima grabada
  const ultimas = new Map<string, any>()
  for (const v of delProceso) {
    const clave = `${v.entrevista_id}:${v.pregunta_id}`
    const previa = ultimas.get(clave)
    if (!previa || new Date(v.grabada_en).getTime() > new Date(previa.grabada_en).getTime()) ultimas.set(clave, v)
  }
  const ordenadas = Array.from(ultimas.values()).sort((a: any, b: any) => {
    const oa = preguntaPorId.get(a.pregunta_id)?.orden
    const ob = preguntaPorId.get(b.pregunta_id)?.orden
    if (typeof oa === 'number' && typeof ob === 'number') return oa - ob
    if (typeof oa === 'number') return -1
    if (typeof ob === 'number') return 1
    return new Date(a.grabada_en).getTime() - new Date(b.grabada_en).getTime()
  })

  const firmadas = await firmar(ordenadas.map((v: any) => ({ url_video: v.url_video ?? null })))
  // Lista blanca: solo el id, el texto de la pregunta y la URL firmada
  return ordenadas.map((v: any, i: number) => ({
    id: String(v.id),
    pregunta: String(preguntaPorId.get(v.pregunta_id)?.pregunta ?? ''),
    url: firmadas[i]?.url_video ?? null,
  }))
}

/** Hay un informe publicado para descargar? Lo comprueba la descarga antes de registrarla. */
export async function hayInformePublicado(db: any, email: string, candidatoId: unknown, procesoId: unknown): Promise<boolean> {
  const detalle = await detalleEvaluado(db, email, candidatoId, procesoId)
  return !!detalle?.informe
}
