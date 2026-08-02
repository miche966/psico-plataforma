// Baremos poblacionales (Simulación)
// Convierte puntajes brutos en Percentiles (1-99)

export function obtenerPercentilBigFive(factor: string, puntajeBruto: number): number {
  // Simulamos una curva normal donde 3 es el percentil 50
  // La fórmula simple: ((puntaje - min) / (max - min)) * 100 con un poco de ajuste de curva
  let percentil = ((puntajeBruto - 1) / 4) * 100
  
  // Pequeños ajustes por factor para simular datos reales
  if (factor === 'amabilidad') percentil -= 5 // La gente suele puntuar alto aquí
  if (factor === 'neuroticismo') percentil += 5 // La gente suele puntuar bajo aquí

  return Math.max(1, Math.min(99, Math.round(percentil)))
}

export function obtenerPercentilCognitivo(correctas: number, total: number): number {
  if (total === 0) return 0
  const porcentaje = correctas / total
  
  // Simulamos que el promedio de la población acierta el 50%
  // 50% de aciertos = Percentil 50
  // 80% de aciertos = Percentil 90
  
  let percentil = 0
  if (porcentaje < 0.2) percentil = porcentaje * 100 // 0-20
  else if (porcentaje < 0.5) percentil = 20 + ((porcentaje - 0.2) / 0.3) * 30 // 20-50
  else if (porcentaje < 0.8) percentil = 50 + ((porcentaje - 0.5) / 0.3) * 40 // 50-90
  else percentil = 90 + ((porcentaje - 0.8) / 0.2) * 9 // 90-99

  return Math.max(1, Math.min(99, Math.round(percentil)))
}

export function interpretarPercentil(percentil: number): string {
  if (percentil >= 90) return 'Muy Alto'
  if (percentil >= 75) return 'Alto'
  if (percentil >= 25) return 'Promedio'
  if (percentil >= 10) return 'Bajo'
  return 'Muy Bajo'
}

/**
 * Estimates an MBTI-like profile from Big Five factors.
 * This is a descriptive estimate, not a direct MBTI test result.
 */
export function estimarMBTI(puntajeBruto: unknown): string | null {
  if (!puntajeBruto || typeof puntajeBruto !== 'object') return null

  const values: Record<string, number[]> = {}
  const aliases: Record<string, string> = {
    extraversion: 'extraversion',
    amabilidad: 'amabilidad', agreeableness: 'amabilidad',
    responsabilidad: 'responsabilidad', conscientiousness: 'responsabilidad',
    apertura: 'apertura', openness: 'apertura'
  }

  const normalize = (key: string) => key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const toScore = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'object' && value !== null && 'correctas' in value) {
      const item = value as { correctas?: unknown; total?: unknown }
      const total = Number(item.total) || 0
      const correctas = Number(item.correctas)
      return total > 0 && Number.isFinite(correctas) ? (correctas / total) * 5 : null
    }
    return null
  }

  const scan = (obj: Record<string, unknown>) => {
    Object.entries(obj).forEach(([key, value]) => {
      const factor = aliases[normalize(key)]
      const score = toScore(value)
      if (factor && score !== null) {
        const normalized = score > 5 ? (score <= 25 ? score / 25 * 5 : score <= 100 ? score / 100 * 5 : 5) : score
        if (normalized >= 0 && normalized <= 5) (values[factor] ||= []).push(normalized)
      }
      if (value && typeof value === 'object' && !('correctas' in value)) scan(value as Record<string, unknown>)
    })
  }

  scan(puntajeBruto as Record<string, unknown>)
  const average = (factor: string) => {
    const items = values[factor]
    return items?.length ? items.reduce((sum, value) => sum + value, 0) / items.length : null
  }
  const extraversion = average('extraversion')
  const apertura = average('apertura')
  const amabilidad = average('amabilidad')
  const responsabilidad = average('responsabilidad')
  if ([extraversion, apertura, amabilidad, responsabilidad].some(value => value === null)) return null

  const E = extraversion! >= 3.6 ? 'E' : 'I'
  const S = apertura! < 3.9 ? 'S' : 'N'
  const T = amabilidad! < 4.4 ? 'T' : 'F'
  const J = responsabilidad! >= 4.3 ? 'J' : 'P'
  return `${E}${S}${T}${J}`
}

export function estimarMBTIDesdeSesiones(sesiones: unknown): string | null {
  if (!Array.isArray(sesiones)) return null
  const personalidad = sesiones.filter(item => item && typeof item === 'object').map(item => {
    const session = item as { puntaje_bruto?: unknown }
    return session.puntaje_bruto
  }).filter(Boolean)
  return estimarMBTI(personalidad)
}