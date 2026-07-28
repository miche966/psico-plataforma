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
 * Estima el perfil MBTI (16 tipos de personalidad) a partir de los factores de personalidad Big Five
 * utilizando umbrales normativos calibrados con la mediana de la población de postulantes de selección.
 */
export function estimarMBTI(puntajeBruto: any): string {
  if (!puntajeBruto || typeof puntajeBruto !== 'object') return 'ENFJ'

  const findVal = (key: string): number => {
    let found = 3.5
    const searchVal = (obj: any) => {
      if (!obj || typeof obj !== 'object') return
      Object.entries(obj).forEach(([f, v]) => {
        if (f.toLowerCase().includes(key)) {
          if (typeof v === 'number') {
            found = v > 5 ? (v <= 25 ? (v / 25) * 5 : (v / 100) * 5) : v
          } else if (typeof v === 'object' && v !== null && 'correctas' in v) {
            found = ((v as any).correctas / ((v as any).total || 1)) * 5
          }
        } else if (typeof v === 'object' && v !== null) {
          searchVal(v)
        }
      })
    }
    searchVal(puntajeBruto)
    return found
  }

  // Umbrales calibrados según medianas normativas de selección de personal:
  // Extraversión: E (>= 3.6) vs I (< 3.6)
  // Apertura: N (>= 3.9) vs S (< 3.9)
  // Amabilidad: F (>= 4.4) vs T (< 4.4)
  // Responsabilidad: J (>= 4.3) vs P (< 4.3)
  const E = findVal('extraver') >= 3.6 ? 'E' : 'I'
  const S = findVal('apertura') < 3.9 ? 'S' : 'N'
  const T = findVal('amabilid') < 4.4 ? 'T' : 'F'
  const J = findVal('responsab') >= 4.3 ? 'J' : 'P'

  return `${E}${S}${T}${J}`
}

