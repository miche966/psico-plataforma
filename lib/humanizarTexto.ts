import { ETQ } from './labels.ts'
import { sanearFraseAlineamiento } from './informeSaneador.ts'

// Limpieza final del texto que escribe la IA para el informe: saca el nombre del evaluado, cambia identificadores
// tecnicos por sus etiquetas, atenua adjetivos exagerados y arregla artefactos. Antes vivia dentro de app/informe/page.tsx.

/**
 * Terminos tecnicos sueltos que no existen como palabra comun del español y que la IA puede dejar tal cual
 * (el prompt le prohibe nombrar rasgos tecnicos, pero a veces se le escapan).
 */
const TERMINOS_TECNICOS_SUELTOS = new Set(['neuroticismo', 'extraversion', 'burnout'])

/**
 * Identificadores que SI se reemplazan por su etiqueta: las claves con guion bajo escritas como identificador
 * (promedio_general, tolerancia_frustracion, errores_texto) y los terminos tecnicos sueltos de arriba.
 *
 * NO se reemplazan las claves de una sola palabra que son palabras comunes del español (normas, apertura, logro,
 * dinamismo, equilibrio, relaciones, liderazgo, resiliencia, documentos, honestidad...): sustituirlas dentro de una oracion
 * rompia la redaccion ("las normas preestablecidas" terminaba como "las sentido ético preestablecidas", "un equilibrio
 * adecuado" como "un balance vida-trabajo adecuado").
 */
const REEMPLAZOS_TECNICOS: Array<[RegExp, string]> = Object.entries(ETQ)
  .filter(([clave]) => clave.includes('_') || TERMINOS_TECNICOS_SUELTOS.has(clave))
  .map(([clave, etiqueta]): [RegExp, string] => {
    // Con guion bajo se exige la forma de identificador (con "_" o "-"): "promedio general" con espacio es prosa normal
    const patron = clave.includes('_') ? clave.replace(/_/g, '[\\-_]') : clave
    // Los limites \b evitan reemplazar subcadenas dentro de otras palabras
    return [new RegExp(`\\b${patron}\\b`, 'gi'), etiqueta.toLowerCase()]
  })

const PROHIBIDAS: Record<string, string> = {
  'arquitectura conductual': 'estilo de trabajo',
  'arquitectura mental': 'estilo de pensamiento',
  'arquitectura': 'estilo de comportamiento',
  'eficiencia cognitiva': 'efectividad operativa',
  'recurso': 'profesional',
  'un recurso': 'un perfil',
  'como recurso': 'como profesional',
  'profunda adherencia': 'adherencia consistente',
  'manejo excepcional': 'manejo efectivo',
  'inteligencia emocional': 'estabilidad emocional',
  'IE aplicada': 'gestión de emociones',
  'apego a normas y ética': 'sentido ético',
  'solvencia': 'adecuación',
  'destacada': 'notable',
  'consistente': 'clara',
  'excepcional': 'destacada',
  'sobresaliente': 'notable',
  'superior': 'destacado',
  'dominio superior': 'manejo adecuado',
  'capacidad superior': 'capacidad clara',
  'resiliencia excepcional': 'resiliencia consistente',
  'adherencia inquebrantable': 'adherencia consistente',
  'decisiones objetiva': 'decisiones objetivas',
  'DASS-21': 'bienestar emocional',
  'DASS21': 'bienestar emocional',
  'MBTI': 'perfil conductual',
  'ICAR': 'capacidad cognitiva',
  'SJT': 'juicio situacional',
  'discurso inferido': 'comunicación observada',
  'magnífico': 'adecuado',
  'maravilloso': 'positivo',
  'increíble': 'relevante',
  'proclive': 'tiende a',
  'deficitario': 'con áreas de mejora',
  'óptimo': 'adecuado',
  'máximo': 'alto',
  'esenciales': 'importantes',
  'esencial': 'importante',
  'cruciales': 'relevantes',
  'crucial': 'relevante',
}

export function humanizarTexto(texto: string, nombreEvaluado?: string | null): string {
  if (!texto || typeof texto !== 'string') return texto
  let limpio = texto.replace(/\*\*/g, '')

  // 1. Filtro de nombre: reemplaza el nombre del evaluado por "El candidato"
  if (nombreEvaluado) {
    const nombreEscapado = nombreEvaluado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    limpio = limpio.replace(new RegExp(nombreEscapado, 'gi'), 'El candidato')
  }

  // 2. Identificadores tecnicos -> etiqueta (en minusculas para que fluya en la oracion)
  for (const [regex, etiqueta] of REEMPLAZOS_TECNICOS) limpio = limpio.replace(regex, etiqueta)

  // 3. Eliminacion de maximalismos y lenguaje informal
  for (const [mal, bien] of Object.entries(PROHIBIDAS)) limpio = limpio.replace(new RegExp(`\\b${mal}\\b`, 'gi'), bien)

  // 4. Limpieza final de artefactos tecnicos
  limpio = limpio.replace(/NaN/g, 'adecuado').replace(/PUNTAJE DE AJUSTE/gi, 'nivel de adecuación').trim()

  // 5. Mayuscula al inicio de cada oracion
  limpio = limpio.replace(/(^\s*\w|[\.\!\?]\s+\w)/g, c => c.toUpperCase())

  // 6. Por seguridad, se vuelve a limpiar "alineamiento de expectativas" (ver lib/informeSaneador.ts)
  return sanearFraseAlineamiento(limpio)
}
