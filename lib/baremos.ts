// Estimaciones descriptivas del informe (perfil tipo MBTI). El baremo real de las pruebas cognitivas vive en
// lib/baremoCognitivo.ts: aca ya no hay percentiles simulados.

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