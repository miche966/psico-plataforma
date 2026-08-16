import { TEST_IDS } from './progresoEvaluacion.ts'

const NORMALIZACION_MAP: Record<string, string> = {
  'relaciones': 'relaciones',
  'relaciones interpersonales': 'relaciones',
  'relaciones interpersonales y clima': 'relaciones',
  'claridad_rol': 'claridad_rol',
  'claridad de rol': 'claridad_rol',
  'percepción de claridad de rol': 'claridad_rol',
  'burnout': 'burnout',
  'riesgo de agotamiento': 'burnout',
  'equilibrio': 'equilibrio',
  'balance vida-trabajo': 'equilibrio',
  'extraversion': 'extraversion',
  'amabilidad': 'amabilidad',
  'responsabilidad': 'responsabilidad',
  'neuroticismo': 'neuroticismo',
  'apertura': 'apertura'
}

const CLAVES_GENERICAS = new Set(['correctas', 'total', 'porcentaje', 'nivel_maximo'])

function esFactorRatio(obj: any): obj is { correctas: number; total: number } {
  return Boolean(obj) && typeof obj === 'object' && !Array.isArray(obj) &&
    typeof obj.correctas === 'number' && typeof obj.total === 'number'
}

/**
 * Arma el diccionario plano de factores (0-5) que se le pasa a la IA para redactar el informe.
 *
 * Bug corregido (2026-08-15): la version anterior guardaba cada numero encontrado usando SOLO
 * el nombre de su propia clave ("correctas", "total"), descartando el nombre del factor padre
 * ("errores_texto", "documentos", etc.). Como casi todos los tests de la bateria (SJT, ICAR,
 * Atencion al Detalle, Verbal, Numerico...) usan esa misma forma {total, correctas} en varios
 * sub-factores, cada uno pisaba al anterior en silencio -- la IA nunca llegaba a recibir un
 * valor identificable como "Precision en Datos de Texto" o similar, solo lo que quedara de la
 * ultima colision. Ahora cada sub-factor con nombre propio se normaliza a escala 0-5 (mismo
 * calculo que las barras visuales del panel, ver lib/puntajes.ts) y se guarda bajo su propio
 * nombre. Los tests sin desglose por factor (Verbal, Numerico) o el puntaje global de los que
 * si lo tienen (Icar, Atencion al Detalle) se namespacean con el nombre del propio test
 * ("verbal_general", "icar_general") para no colisionar entre si ni con un sub-factor real.
 */
export function construirFactoresCrudos(sesiones: any[]): Record<string, number> {
  const factoresCrudos: Record<string, number> = {}

  const guardar = (nombre: string, valor: number) => {
    const rawKey = nombre.toLowerCase().trim()
    const cleanKey = NORMALIZACION_MAP[rawKey] || rawKey
    factoresCrudos[cleanKey] = valor
  }

  for (const s of sesiones || []) {
    const nombreTestBase = String(TEST_IDS[s?.test_id] || s?.test_id || 'test').replace(/-/g, '_')

    const scan = (obj: any, nombreFactor: string) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return

      if (esFactorRatio(obj)) {
        guardar(nombreFactor, obj.total > 0 ? Math.round((obj.correctas / obj.total) * 500) / 100 : 0)
      }

      Object.entries(obj).forEach(([k, v]) => {
        if (CLAVES_GENERICAS.has(k.toLowerCase().trim())) return
        if (typeof v === 'number') {
          guardar(k, v)
        } else if (typeof v === 'object') {
          scan(v, k)
        }
      })
    }

    if (esFactorRatio(s?.puntaje_bruto)) {
      scan(s.puntaje_bruto, `${nombreTestBase}_general`)
    } else {
      scan(s?.puntaje_bruto, nombreTestBase)
    }
  }

  // La IA recibe la escala final: alto = mayor estabilidad emocional.
  if (typeof factoresCrudos.neuroticismo === 'number') {
    factoresCrudos.estabilidad_emocional = Math.min(5, Math.max(0, 6 - factoresCrudos.neuroticismo))
    delete factoresCrudos.neuroticismo
  }

  // Estrés Laboral (burnout/equilibrio/relaciones/claridad_rol/carga_laboral) se guarda en su
  // escala original: 1 = casi nunca sufre ese síntoma (bueno), 5 = lo sufre todo el tiempo
  // (malo) — lo opuesto a como la IA interpreta el resto de los factores (alto = favorable).
  for (const factor of ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'carga_laboral']) {
    if (typeof factoresCrudos[factor] === 'number') {
      factoresCrudos[factor] = Math.min(5, Math.max(0, 6 - factoresCrudos[factor]))
    }
  }

  return factoresCrudos
}
