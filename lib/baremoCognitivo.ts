import { TESTS_COGNITIVOS } from './testsCognitivos.ts'
import { BAREMOS as BAREMOS_VIGENTES } from './baremoCognitivoDatos.ts'

// Baremo propio de las pruebas cognitivas: convierte el porcentaje de aciertos de una prueba en el rango percentil
// respecto de las personas ya evaluadas en la plataforma EN ESA MISMA PRUEBA. El porcentaje de aciertos por si solo no
// se puede interpretar (depende de lo dificil que sea la prueba: en Verbal casi todos aciertan mucho y en ICAR casi nadie).
//
// Los datos (lib/baremoCognitivoDatos.ts) los genera `npm run baremo:cognitivo` a partir de las sesiones finalizadas, una
// por persona y prueba. Es una referencia INTERNA (el grupo de los procesos de la plataforma), no una norma publicada.
// Ver docs/BAREMO_COGNITIVO.md.

/** Cuantas personas hacen falta en una prueba para que su baremo se use. Con menos, el percentil no es estable. */
export const MUESTRA_MINIMA = 30

export type Baremo = { n: number; histograma: Record<string, number> }
export type Baremos = Record<string, Baremo>
export type Valoracion = 'Bajo' | 'Medio' | 'Medio alto' | 'Alto'

/** Porcentaje de aciertos entero (0 a 100), o null si el puntaje no sirve. */
export function porcentajeDeAciertos(correctas: unknown, total: unknown): number | null {
  const c = Number(correctas)
  const t = Number(total)
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0 || c < 0) return null
  return Math.min(100, Math.round((c / t) * 100))
}

/**
 * Rango percentil (1 a 99) de un porcentaje de aciertos dentro de un baremo, con el criterio del punto medio:
 * (personas por debajo + la mitad de las que empatan) / total. Null si no hay baremo o es muy chico.
 */
export function percentilEnBaremo(baremo: Baremo | undefined, porcentaje: number): number | null {
  if (!baremo || !(baremo.n >= MUESTRA_MINIMA) || !Number.isFinite(porcentaje)) return null
  let debajo = 0
  let iguales = 0
  for (const [valor, cantidad] of Object.entries(baremo.histograma)) {
    const v = Number(valor)
    if (v < porcentaje) debajo += cantidad
    else if (v === porcentaje) iguales += cantidad
  }
  return Math.max(1, Math.min(99, Math.round(((debajo + iguales / 2) / baremo.n) * 100)))
}

/** Valoracion por cuartiles del grupo de referencia: Bajo (cuarto inferior) a Alto (cuarto superior). */
export function valoracionDePercentil(percentil: number): Valoracion {
  if (percentil >= 75) return 'Alto'
  if (percentil >= 50) return 'Medio alto'
  if (percentil >= 25) return 'Medio'
  return 'Bajo'
}

/** Mismos colores que las barras del informe: rojo, ambar, azul y verde. */
export const COLOR_VALORACION: Record<Valoracion, string> = {
  Bajo: '#dc2626',
  Medio: '#d97706',
  'Medio alto': '#2563eb',
  Alto: '#059669',
}

/** Una prueba cognitiva de la persona: su porcentaje de aciertos, su rango percentil y la mediana de aciertos del grupo. */
export type DetallePrueba = { testId: string; nombre: string; porcentaje: number; percentil: number | null; mediana: number | null }

/** Mediana de aciertos (en %) del grupo de referencia de una prueba. Null si no hay baremo o es muy chico. */
export function medianaDelBaremo(baremo: Baremo | undefined): number | null {
  if (!baremo || !(baremo.n >= MUESTRA_MINIMA)) return null
  let acumulado = 0
  for (const valor of Object.keys(baremo.histograma).map(Number).sort((a, b) => a - b)) {
    acumulado += baremo.histograma[String(valor)]
    if (acumulado / baremo.n >= 0.5) return valor
  }
  return null
}

export type ResumenCognitivo = {
  /** Aciertos y total sumados en las pruebas cognitivas. */
  correctas: number
  total: number
  /** Aciertos llevados a escala de 5, con un decimal. Null si no hay pruebas cognitivas. */
  rendimiento: number | null
  /** Promedio de los rangos percentiles de cada prueba que tiene baremo. Null si ninguna lo tiene. */
  percentil: number | null
  valoracion: Valoracion | null
  /** Cuantas pruebas cognitivas se consideraron y cuantas de ellas tenian baremo. */
  pruebas: number
  pruebasConBaremo: number
  /** Una fila por prueba cognitiva considerada. */
  detalle: DetallePrueba[]
}

const marca = (s: any) => new Date(s?.finalizada_en || 0).getTime() || 0

/**
 * Resume las pruebas cognitivas de una persona. Solo cuentan Verbal, Numerico, ICAR y Atencion al detalle (no las
 * situacionales), y de cada una la sesion finalizada mas reciente.
 */
export function resumenCognitivo(sesiones: any[], baremos: Baremos = BAREMOS_VIGENTES): ResumenCognitivo {
  const ultima = new Map<string, any>()
  for (const s of sesiones || []) {
    const testId = String(s?.test_id || '').toLowerCase()
    if (!s || !(testId in TESTS_COGNITIVOS)) continue
    if (s.estado !== undefined && s.estado !== 'finalizado') continue
    if (porcentajeDeAciertos(s.puntaje_bruto?.correctas, s.puntaje_bruto?.total) === null) continue
    const previa = ultima.get(testId)
    if (!previa || marca(s) >= marca(previa)) ultima.set(testId, s)
  }

  let correctas = 0
  let total = 0
  const percentiles: number[] = []
  const detalle: DetallePrueba[] = []
  for (const [testId, s] of ultima) {
    const c = Number(s.puntaje_bruto.correctas)
    const t = Number(s.puntaje_bruto.total)
    correctas += c
    total += t
    const porcentaje = porcentajeDeAciertos(c, t) as number
    const p = percentilEnBaremo(baremos[testId], porcentaje)
    if (p !== null) percentiles.push(p)
    detalle.push({ testId, nombre: TESTS_COGNITIVOS[testId], porcentaje, percentil: p, mediana: medianaDelBaremo(baremos[testId]) })
  }

  const percentil = percentiles.length ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : null
  return {
    correctas,
    total,
    rendimiento: total > 0 ? Math.round((correctas / total) * 5 * 10) / 10 : null,
    percentil,
    valoracion: percentil === null ? null : valoracionDePercentil(percentil),
    pruebas: ultima.size,
    pruebasConBaremo: percentiles.length,
    detalle,
  }
}
