// Calcula las 5 "Habilidades para el Trabajo" (Sección III del informe) a partir de los
// mismos factores psicométricos crudos que alimentan el resto del informe, en vez de
// dejarlos como una estimación libre de la IA sin anclaje a los datos reales.
//
// Por qué: antes la IA "adivinaba" estos 5 números en la misma llamada que redacta el
// texto narrativo, sin instrucción de que coincidieran con los factores ya calculados.
// Eso producía contradicciones dentro del propio informe (ej. "Resiliencia: 75/100" en
// esta sección conviviendo con "Nivel de Bienestar y Energía: 1.8/5" en Bienestar).
// Al derivarlos de los mismos factores, ambas secciones quedan alineadas por construcción.

export type FactoresCrudos = Record<string, number>

export interface MetaCompetencias {
  liderazgo?: number
  adaptabilidad?: number
  resiliencia?: number
  colaboracion?: number
  comunicacion?: number
}

function promedioDisponible(factores: FactoresCrudos, claves: string[]): number | undefined {
  const valores = claves
    .map(clave => factores[clave])
    .filter((valor): valor is number => typeof valor === 'number' && Number.isFinite(valor))
  if (valores.length === 0) return undefined
  const promedioEnEscala5 = valores.reduce((suma, valor) => suma + valor, 0) / valores.length
  return Math.max(1, Math.min(100, Math.round((promedioEnEscala5 / 5) * 100)))
}

export function calcularMetaCompetencias(factoresCrudos: FactoresCrudos): MetaCompetencias {
  const resultado: MetaCompetencias = {}

  const comunicacion = promedioDisponible(factoresCrudos, ['extraversion'])
  if (comunicacion !== undefined) resultado.comunicacion = comunicacion

  const colaboracion = promedioDisponible(factoresCrudos, ['amabilidad', 'relaciones'])
  if (colaboracion !== undefined) resultado.colaboracion = colaboracion

  const adaptabilidad = promedioDisponible(factoresCrudos, ['apertura', 'dinamismo'])
  if (adaptabilidad !== undefined) resultado.adaptabilidad = adaptabilidad

  // Resiliencia se ancla a los MISMOS factores que la Sección de Bienestar
  // (equilibrio = Balance Vida-Trabajo, burnout = Nivel de Bienestar y Energía),
  // para que ambas secciones no puedan contradecirse.
  const resiliencia = promedioDisponible(factoresCrudos, ['estabilidad_emocional', 'equilibrio', 'burnout'])
  if (resiliencia !== undefined) resultado.resiliencia = resiliencia

  const liderazgo = promedioDisponible(factoresCrudos, ['responsabilidad', 'logro'])
  if (liderazgo !== undefined) resultado.liderazgo = liderazgo

  return resultado
}
