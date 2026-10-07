// Dictamen final de una persona: la decision que el evaluador deja guardada en su informe (informes_psicometricos.contenido
// .recomendacion). Las exportaciones a Excel del panel muestran SOLO ese valor guardado: si no hay informe guardado, un guion.
// Nunca se inventa ni se deduce un dictamen (antes la planilla decia "Recomendado" para todas las personas).

export type Dictamen = 'recomendado' | 'con_reservas' | 'no_recomendado'

export const ETIQUETA_DICTAMEN: Record<Dictamen, string> = {
  recomendado: 'Recomendado',
  con_reservas: 'Recomendado con reservas',
  no_recomendado: 'No recomendado',
}

/** El valor si es uno de los tres dictamenes conocidos; null si no. */
export function dictamenValido(valor: unknown): Dictamen | null {
  return valor === 'recomendado' || valor === 'con_reservas' || valor === 'no_recomendado' ? valor : null
}

/** Texto para la planilla: la etiqueta del dictamen guardado, o "-" si no hay. */
export function etiquetaDictamen(valor: unknown): string {
  const d = dictamenValido(valor)
  return d ? ETIQUETA_DICTAMEN[d] : '-'
}

export type ResumenDictamenes = { recomendado: string; conReservas: string; noRecomendado: string; conDictamen: number }

/**
 * Porcentaje de cada dictamen entre las personas que SI tienen dictamen guardado, con el recuento para que se vea sobre
 * cuantas se calculo ("50% (1 de 2 con dictamen)"). Si ninguna tiene dictamen, todo "-".
 */
export function resumenDictamenes(valores: unknown[]): ResumenDictamenes {
  const validos = (valores || []).map(dictamenValido).filter((d): d is Dictamen => d !== null)
  const total = validos.length
  if (total === 0) return { recomendado: '-', conReservas: '-', noRecomendado: '-', conDictamen: 0 }
  const texto = (d: Dictamen) => {
    const n = validos.filter(v => v === d).length
    return `${Math.round((n / total) * 100)}% (${n} de ${total} con dictamen)`
  }
  return { recomendado: texto('recomendado'), conReservas: texto('con_reservas'), noRecomendado: texto('no_recomendado'), conDictamen: total }
}
