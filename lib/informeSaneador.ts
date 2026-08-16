/**
 * Limpieza determinística de texto generado por IA para el informe.
 *
 * Complementa (no reemplaza) las reglas de los prompts en app/api/generar-informe/route.ts:
 * una instrucción de prompt reduce la frecuencia de un error, pero un modelo de lenguaje nunca
 * garantiza el 100% -- en pruebas reales, tras agregar una prohibición explícita en los 3 prompts
 * contra la construcción "alineamiento de expectativas" (gramaticalmente incorrecta: "alineamiento"
 * es masculino singular y no concuerda con el artículo plural/femenino que solía acompañarla), la
 * frase bajó de 4 apariciones a 1 en informes reales sucesivos, pero no desapareció del todo. Esta
 * limpieza actúa como resguardo determinístico final, aplicado a la salida ya generada.
 */
export function sanearFraseAlineamiento(texto: string): string {
  if (typeof texto !== 'string' || !texto) return texto
  const reemplazo = (coincidencia: string) => {
    const base = 'las expectativas'
    return /^[A-ZÁÉÍÓÚÑ]/.test(coincidencia) ? base.charAt(0).toUpperCase() + base.slice(1) : base
  }
  return texto
    // Con artículo pegado ("las/la/los/el alineamiento de expectativas"): se reemplaza el tramo completo.
    .replace(/\b(el|los?|la|las)\s+alineamiento\s+de\s+expectativas\b/gi, reemplazo)
    // Sin artículo previo (ej: "... o alineamiento de expectativas complejas..."): idem.
    .replace(/\balineamiento\s+de\s+expectativas\b/gi, reemplazo)
}

/**
 * Recorre un valor cualquiera (string, array, objeto anidado) y aplica sanearFraseAlineamiento
 * a cada string que encuentra, preservando la forma original de la estructura. Se usa sobre el
 * resultado completo del informe antes de devolverlo, para no depender de enumerar a mano cada
 * campo de texto libre que la IA puede llegar a producir (fortalezas, oportunidadesMejora,
 * interpretacionPorFactor, resumenEjecutivo, fundamentacion, analisisEntrevista, etc.).
 */
export function sanearProfundo<T>(valor: T): T {
  if (typeof valor === 'string') return sanearFraseAlineamiento(valor) as unknown as T
  if (Array.isArray(valor)) return valor.map(sanearProfundo) as unknown as T
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {}
    for (const [clave, val] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = sanearProfundo(val)
    }
    return salida as T
  }
  return valor
}
