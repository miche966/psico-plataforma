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
