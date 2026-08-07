export const PUNTAJES_VERSION = 2

/** Convierte los valores recibidos a una escala comun de 0 a 5. */
export function normalizarPuntaje(valor: unknown, factor = ''): number {
  const clave = factor.toLowerCase().trim()
  let resultado = 0

  if (typeof valor === 'object' && valor !== null) {
    const dato = valor as Record<string, any>
    if (clave === 'metricas_fraude') {
      const alertas = (dato.events?.length || 0) + (dato.tabSwitches || 0) + (dato.copyPasteAttempts || 0)
      resultado = Math.max(0, 5 - alertas * 0.5)
    } else if ('correctas' in dato && 'total' in dato) {
      resultado = (Number(dato.correctas) / (Number(dato.total) || 1)) * 5
    } else {
      resultado = Number(dato.correctas || dato.score || dato.promedio || dato.valor || 0)
    }
  } else if (typeof valor === 'string') {
    const texto = valor.toLowerCase().trim()
    resultado = texto === 'alto' ? 5 : (texto === 'medio' || texto === 'moderado') ? 3 : texto === 'bajo' ? 1.5 : Number(valor) || 0
  } else {
    resultado = Number(valor) || 0
  }

  if (resultado > 5) {
    if (resultado <= 25) resultado = (resultado / 25) * 5
    else if (resultado <= 100) resultado = (resultado / 100) * 5
    else resultado = 5
  }

  // Neuroticismo, y los factores del test de Estrés Laboral, se guardan en su orientación
  // original de "frecuencia del síntoma" (1 = casi nunca le pasa/bueno, 5 = le pasa siempre/
  // malo) — al revés de como se muestran e interpretan en el informe (alto = favorable).
  // La pantalla los presenta ya invertidos: estabilidad emocional, y estos 6 de Bienestar.
  const FACTORES_ESCALA_INVERTIDA = ['neuroticismo', 'burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'carga_laboral', 'nivel_estres']
  if (FACTORES_ESCALA_INVERTIDA.includes(clave)) resultado = 6 - resultado

  return Math.min(5, Math.max(0, resultado))
}

export function nivelPuntaje(valor: number): 'alto' | 'moderado' | 'bajo' {
  return valor >= 4 ? 'alto' : valor >= 3 ? 'moderado' : 'bajo'
}

export function colorPuntaje(valor: number): string {
  const resultado = Number.isFinite(valor) ? valor : 0
  return resultado >= 4 ? '#059669' : resultado >= 3 ? '#2563eb' : resultado >= 2 ? '#d97706' : '#dc2626'
}

export function interpretacionVigente(informe: any): boolean {
  return informe?.interpretacionVersion === PUNTAJES_VERSION
}