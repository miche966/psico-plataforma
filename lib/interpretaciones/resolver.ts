/**
 * lib/interpretaciones/resolver.ts
 *
 * Módulo puro de resolución jerárquica de interpretaciones psicométricas.
 * No accede a Supabase ni a datos externos.
 * Exportable para ser utilizado tanto en el código productivo como en tests.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface EntradaInterpretacion {
  desc: string
  q: string
}

export type DiccionarioInterpretaciones = Record<
  string,
  Record<string, EntradaInterpretacion>
>

// ─── normalizarContextoInterpretacion ────────────────────────────────────────

/**
 * Convierte un `test_id` (legible o UUID) al alias corto usado como sufijo en el
 * diccionario de interpretaciones.
 *
 * Reglas de normalización:
 * - Si contiene "icar" o "razonamiento"  → 'icar'
 * - Si contiene "sjt" y "atencion"       → 'sjt_atencion'
 * - Si contiene "sjt" y "comercial"      → 'sjt_comercial'
 * - Si contiene "sjt" y "cobranzas"      → 'sjt_cobranzas'
 * - Si contiene "sjt" y "legal"          → 'sjt_legal'
 * - Si contiene "sjt" y "ventas"         → 'sjt_ventas'
 * - Si contiene "sjt" y "problemas"      → 'sjt_problemas'
 * - Cadena vacía o undefined             → undefined (sin contexto)
 * - Cualquier otro valor normalizado     → se devuelve tal cual (lower + trim)
 *
 * Los UUID que no contienen señales conocidas devuelven undefined
 * para evitar transformaciones arbitrarias.
 */
export function normalizarContextoInterpretacion(testId?: string): string | undefined {
  if (!testId || typeof testId !== 'string') return undefined

  const limpio = testId.toLowerCase().trim()
  if (!limpio) return undefined

  if (limpio.includes('icar') || limpio.includes('razonamiento')) return 'icar'
  if (limpio.includes('sjt') && limpio.includes('atencion')) return 'sjt_atencion'
  if (limpio.includes('sjt') && limpio.includes('comercial')) return 'sjt_comercial'
  if (limpio.includes('sjt') && limpio.includes('cobranzas')) return 'sjt_cobranzas'
  if (limpio.includes('sjt') && limpio.includes('legal')) return 'sjt_legal'
  if (limpio.includes('sjt') && limpio.includes('ventas')) return 'sjt_ventas'
  if (limpio.includes('sjt') && limpio.includes('problemas')) return 'sjt_problemas'

  // UUID genérico: verificar si contiene al menos un guión en formato UUID v4
  // Si es UUID sin señal conocida, devolvemos undefined para no contaminar
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  if (uuidPattern.test(limpio)) return undefined

  // Alias legible desconocido: devolver normalizado
  return limpio
}

// ─── obtenerInterpretacion ───────────────────────────────────────────────────

/**
 * Resuelve la interpretación de un factor psicométrico en este orden de precedencia:
 *
 * 1. Clave específica de test: `${factor}_${contexto}` o `${contexto}_${factor}`
 *    según como esté guardado en el diccionario.
 * 2. Clave exacta solicitada (sin transformación).
 * 3. Fallback genérico hacia la raíz del factor SOLO si la clave solicitada tenía sufijo.
 * 4. null (sin interpretación disponible).
 *
 * La función NO muta el diccionario.
 */
export function obtenerInterpretacion(
  textosObj: DiccionarioInterpretaciones,
  factorClave: string,
  nivelClave: string,
  testIdContexto?: string,
): EntradaInterpretacion | null {
  if (!textosObj || !factorClave || !nivelClave) return null

  // 1. Precedencia absoluta: clave específica del test
  //    El diccionario usa la convención: sjt_atencion_etica, matrices_icar, etc.
  //    Es decir, el CONTEXTO puede ir como sufijo O como prefijo dependiendo del dominio.
  if (testIdContexto) {
    // Intento A: factor_contexto (ej: matrices_icar)
    const claveConSufijo = `${factorClave}_${testIdContexto}`
    if (textosObj[claveConSufijo]?.[nivelClave]) {
      return textosObj[claveConSufijo][nivelClave]
    }

    // Intento B: contexto_factor (ej: sjt_atencion_etica)
    const claveConPrefijo = `${testIdContexto}_${factorClave}`
    if (textosObj[claveConPrefijo]?.[nivelClave]) {
      return textosObj[claveConPrefijo][nivelClave]
    }
  }

  // 2. Coincidencia exacta con la clave solicitada
  if (textosObj[factorClave]?.[nivelClave]) {
    return textosObj[factorClave][nivelClave]
  }

  // 3. Fallback genérico controlado: SOLO si la clave tiene sufijo conocido
  //    (la clave ya era una versión específica sin entrada en el diccionario)
  const sinSufijo = factorClave
    .replace(/^(sjt_atencion_|sjt_comercial_|sjt_cobranzas_|sjt_legal_|sjt_ventas_|sjt_problemas_)/g, '')
    .replace(/_(icar|sjt_atencion|sjt_comercial|sjt_cobranzas|sjt_legal|sjt_ventas|sjt_problemas)$/g, '')

  if (sinSufijo !== factorClave && textosObj[sinSufijo]?.[nivelClave]) {
    return textosObj[sinSufijo][nivelClave]
  }

  // 4. Sin interpretación disponible
  return null
}
