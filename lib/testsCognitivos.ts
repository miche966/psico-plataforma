import { SLUG_TO_ID } from './server/catalogoTests.ts'

/**
 * Las pruebas que miden aptitud cognitiva (razonamiento y atencion): son las que entran en el rendimiento y el rango
 * percentil del informe. Las pruebas situacionales (SJT, Tolerancia a la frustracion) tambien guardan "correctas" y
 * "total", pero miden criterio ante situaciones de trabajo y tienen efecto techo documentado: no son cognitivas y
 * inflaban el resumen.
 */
export const TESTS_COGNITIVOS: Record<string, string> = {
  [SLUG_TO_ID['verbal']]: 'Razonamiento verbal',
  [SLUG_TO_ID['numerico']]: 'Razonamiento numérico',
  [SLUG_TO_ID['icar']]: 'Razonamiento abstracto',
  [SLUG_TO_ID['atencion-detalle']]: 'Atención al detalle',
}
