// Utilidades para detectar, dentro del propio informe generado por IA:
// 1) redundancia narrativa entre campos (misma idea repetida con otras palabras), y
// 2) contradicciones numéricas entre secciones que deberían moverse juntas.
// No reemplazan el criterio humano: solo lo señalan para que el admin decida antes de publicar.

const PALABRAS_VACIAS = new Set([
  'que', 'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'su', 'sus', 'con',
  'para', 'por', 'se', 'es', 'al', 'lo', 'le', 'ha', 'muestra', 'puede', 'esta', 'este',
  'esa', 'ese', 'como', 'mas', 'menos', 'sin', 'del', 'sobre', 'entre', 'tiende',
  'tendencia', 'disposicion', 'capacidad', 'nivel', 'forma', 'manera', 'ante', 'asi',
  'pero', 'tanto', 'cual', 'cuales', 'cada', 'todo', 'toda', 'aunque', 'incluso',
])

function normalizarTexto(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(palabra => palabra.length > 3 && !PALABRAS_VACIAS.has(palabra))
}

// Similitud de Jaccard sobre palabras con contenido (ignora conectores y palabras cortas).
export function similitudTexto(a: string, b: string): number {
  const palabrasA = new Set(normalizarTexto(a || ''))
  const palabrasB = new Set(normalizarTexto(b || ''))
  if (palabrasA.size === 0 || palabrasB.size === 0) return 0
  let interseccion = 0
  palabrasA.forEach(palabra => { if (palabrasB.has(palabra)) interseccion++ })
  const union = new Set([...palabrasA, ...palabrasB]).size
  return union === 0 ? 0 : interseccion / union
}

export interface ParRedundante {
  campoA: string
  campoB: string
  similitud: number
}

export const UMBRAL_REDUNDANCIA_NARRATIVA = 0.35

// Compara los campos narrativos que el prompt ya pide mantener sin solapamiento
// (regla "CERO REDUNDANCIA ENTRE CAMPOS") y devuelve los pares que igual quedaron
// demasiado parecidos, para poder pedirle a la IA que los reescriba antes de entregar el informe.
export function detectarRedundanciaNarrativa(informe: any): ParRedundante[] {
  const campos: Record<string, string> = {
    'ajusteCargo.analisis': informe?.ajusteCargo?.analisis || '',
    resumenEjecutivo: informe?.resumenEjecutivo || '',
    fundamentacion: informe?.fundamentacion || '',
  }
  ;(informe?.fortalezas || []).forEach((f: any, i: number) => {
    const texto = [f?.tendencia, f?.mecanismo].filter(Boolean).join(' ')
    if (texto) campos[`fortalezas[${i}]`] = texto
  })
  ;(informe?.oportunidadesMejora || []).forEach((f: any, i: number) => {
    const texto = [f?.tendencia, f?.mecanismo].filter(Boolean).join(' ')
    if (texto) campos[`oportunidadesMejora[${i}]`] = texto
  })

  const nombres = Object.keys(campos)
  const pares: ParRedundante[] = []
  for (let i = 0; i < nombres.length; i++) {
    for (let j = i + 1; j < nombres.length; j++) {
      const similitud = similitudTexto(campos[nombres[i]], campos[nombres[j]])
      if (similitud >= UMBRAL_REDUNDANCIA_NARRATIVA) {
        pares.push({ campoA: nombres[i], campoB: nombres[j], similitud: Math.round(similitud * 100) / 100 })
      }
    }
  }
  return pares
}

// Diccionario de temas narrativos recurrentes en estos informes, con sus variantes/sinónimos
// habituales. A diferencia de similitudTexto (palabras literales), esto detecta el MISMO tema
// aunque esté parafraseado (ej. "afinidad notable" y "alineación profunda" son el mismo tema:
// ajuste_general_puesto). Vocabulario abierto: si aparecen patrones nuevos que se repiten,
// conviene agregarlos acá en vez de crear un mecanismo nuevo.
const TEMAS_NARRATIVOS: Record<string, string[]> = {
  comunicacion_interaccion: ['dialogo', 'dialogos', 'relacionarse', 'interaccion social', 'comunicarse', 'entablar', 'conversacion', 'discurso'],
  colaboracion_equipo: ['colabora', 'trabajo en equipo', 'apoyo mutuo', 'trato cordial', 'disposicion activa', 'compañeros', 'sinergia'],
  adaptabilidad_cambio: ['nuevas ideas', 'nuevas formas', 'adapta', 'flexib', 'cambio', 'novedad', 'explorar'],
  organizacion_cumplimiento: ['organiza', 'cumpl', 'seguimiento', 'compromisos', 'estructura sus', 'orden en sus tareas', 'responsabilidades con estructura'],
  estabilidad_presion: ['estabilidad emocional', 'ante la presion', 'mantiene la calma', 'equilibrad', 'gestiona sus reacciones', 'talante sereno'],
  desequilibrio_vida_trabajo: ['esfuerzo considerable', 'esfuerzo significativo', 'desequilibrio', 'balance', 'vida personal', 'carga laboral', 'carga de trabajo', 'descanso', 'agotamiento', 'cansancio', 'reservas de energia', 'desgaste'],
  necesidad_estructura_guia: ['estructura definida', 'estructura clara', 'directrices', 'ambigüedad', 'orientacion', 'pautas', 'validacion externa', 'alcance de su rol'],
  relaciones_distancia: ['cierta distancia', 'vinculos laborales', 'cercania', 'aislamiento', 'confianza profunda', 'relaciones interpersonales'],
  ajuste_general_puesto: ['afinidad', 'alineacion', 'alineamiento', 'adecuacion', 'demandas del puesto', 'competencias requeridas', 'idone', 'recomendable', 'consonancia', 'plenamente idonea'],
}

function normalizarParaTemas(texto: string): string {
  return (texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Devuelve el conjunto de temas presentes en un texto (una frase, un párrafo o un bloque entero).
export function detectarTemas(texto: string): Set<string> {
  const normalizado = normalizarParaTemas(texto)
  const temas = new Set<string>()
  for (const [tema, variantes] of Object.entries(TEMAS_NARRATIVOS)) {
    if (variantes.some(variante => normalizado.includes(normalizarParaTemas(variante)))) {
      temas.add(tema)
    }
  }
  return temas
}

function dividirEnFrases(texto: string): string[] {
  return (texto || '')
    .split(/(?<=[.!?])\s+/)
    .map(frase => frase.trim())
    .filter(frase => frase.length > 15)
}

export interface FraseRedundante {
  frase: string
  temas: string
}

// Detecta oraciones de un texto nuevo (ej. el resumen ejecutivo) que repiten, sin aportar ningún
// tema adicional, el mismo tema que YA cubrió por completo alguno de los textos anteriores (ej.
// una fortaleza puntual). No marca una oración solo por tocar un tema ya visto — la marca cuando
// TODOS sus temas ya estaban en un único texto anterior, es decir, cuando esa oración específica
// no está conectando nada nuevo, solo restableciendo lo mismo con otras palabras.
export function detectarFrasesTematicamenteRedundantes(textoNuevo: string, textosAnteriores: string[]): FraseRedundante[] {
  const temasPorTextoAnterior = textosAnteriores.map(t => detectarTemas(t)).filter(temas => temas.size > 0)
  if (temasPorTextoAnterior.length === 0) return []

  const redundantes: FraseRedundante[] = []
  dividirEnFrases(textoNuevo).forEach(frase => {
    const temasFrase = detectarTemas(frase)
    if (temasFrase.size === 0) return
    const yaCubiertaPorUnTextoAnterior = temasPorTextoAnterior.some(temasPrevios =>
      [...temasFrase].every(tema => temasPrevios.has(tema))
    )
    if (yaCubiertaPorUnTextoAnterior) {
      redundantes.push({ frase, temas: [...temasFrase].join(', ') })
    }
  })
  return redundantes
}

export interface AlertaConsistencia {
  etiqueta: string
  detalle: string
}

const UMBRAL_DIVERGENCIA_NUMERICA = 30 // puntos sobre 100

function compararPar(
  etiqueta: string,
  nombreA: string, valorA: number | undefined,
  nombreB: string, valorB: number | undefined,
): AlertaConsistencia | null {
  if (typeof valorA !== 'number' || typeof valorB !== 'number') return null
  const diferencia = Math.abs(valorA - valorB)
  if (diferencia < UMBRAL_DIVERGENCIA_NUMERICA) return null
  return {
    etiqueta,
    detalle: `"${nombreA}" (${valorA}) difiere ${diferencia} puntos de "${nombreB}" (${valorB}). Revisar antes de publicar.`,
  }
}

// Compara indicadores que, por cómo se calculan, deberían moverse juntos.
// Sirve tanto para informes nuevos (red de seguridad si faltan datos) como para
// informes viejos ya guardados con los valores libres que estimaba la IA antes de este cambio.
export function detectarInconsistenciasNumericas(params: {
  resiliencia?: number
  comunicacion?: number
  bienestarPromedio100?: number
  extraversion100?: number
}): AlertaConsistencia[] {
  const alertas: AlertaConsistencia[] = []
  const a = compararPar('Resiliencia vs. Bienestar', 'Resiliencia', params.resiliencia, 'Promedio de Bienestar', params.bienestarPromedio100)
  if (a) alertas.push(a)
  const b = compararPar('Comunicación vs. Extraversión', 'Comunicación', params.comunicacion, 'Extraversión', params.extraversion100)
  if (b) alertas.push(b)
  return alertas
}
