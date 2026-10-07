// Informe guardado (informes_psicometricos.contenido): lo que el evaluador dejo escrito y aprobado. Al abrir el informe de una
// persona se vuelve a cargar ese texto en vez de partir siempre de una pagina vacia. Solo se restauran los campos EDITORIALES; lo
// que se calcula con las sesiones de hoy (confianza, alertas, tiempo promedio) y el ajuste al cargo se recalculan siempre.

type Rec = 'recomendado' | 'con_reservas' | 'no_recomendado'
const RECOMENDACIONES: Rec[] = ['recomendado', 'con_reservas', 'no_recomendado']

const esTexto = (v: unknown): v is string => typeof v === 'string'
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const textosDe = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => esTexto(v)))

/** Fortalezas / areas: lista de textos o de {tendencia, mecanismo, impacto_organizacional}; lo que no tiene esa forma se descarta. */
function narrativas(v: unknown): unknown[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.filter(x => esTexto(x) || esObjeto(x)).map(x => (esTexto(x) ? x : textosDe(x as Record<string, unknown>)))
}

const CAMPOS_TEXTO = ['fundamentacion', 'resumenEjecutivo', 'nombreEvaluador', 'mbti', 'mbtiType', 'ajusteMbti'] as const
const CAMPOS_NUMERO = ['liderazgo', 'adaptabilidad', 'resiliencia', 'colaboracion', 'comunicacion'] as const

/**
 * Devuelve `base` con los campos editoriales del informe guardado encima. Un campo ausente o con forma rara se deja como esta;
 * `guardado` nulo o que no es un objeto devuelve `base` sin cambios. Nunca toca confianza, alertas ni tiempo promedio.
 */
export function aplicarInformeGuardado<T extends Record<string, any>>(base: T, guardado: unknown): T {
  if (!esObjeto(guardado)) return base
  const salida: Record<string, any> = { ...base }

  if (RECOMENDACIONES.includes(guardado.recomendacion as Rec)) salida.recomendacion = guardado.recomendacion
  for (const k of CAMPOS_TEXTO) if (esTexto(guardado[k])) salida[k] = guardado[k]
  for (const k of CAMPOS_NUMERO) if (esNumero(guardado[k])) salida[k] = guardado[k]
  if (esNumero(guardado.interpretacionVersion)) salida.interpretacionVersion = guardado.interpretacionVersion

  const fortalezas = narrativas(guardado.fortalezas)
  if (fortalezas) salida.fortalezas = fortalezas
  const areas = narrativas(guardado.oportunidadesMejora)
  if (areas) salida.oportunidadesMejora = areas

  if (esObjeto(guardado.interpretacionPorFactor)) salida.interpretacionPorFactor = textosDe(guardado.interpretacionPorFactor)

  if (esObjeto(guardado.ajusteCargo)) {
    salida.ajusteCargo = {
      score: esNumero(guardado.ajusteCargo.score) ? guardado.ajusteCargo.score : base.ajusteCargo?.score ?? 0,
      analisis: esTexto(guardado.ajusteCargo.analisis) ? guardado.ajusteCargo.analisis : base.ajusteCargo?.analisis ?? '',
    }
  }

  if (esObjeto(guardado.analisisEntrevista)) {
    const a = textosDe(guardado.analisisEntrevista)
    salida.analisisEntrevista = {
      trayectoriaMotivacion: '', estiloTrabajoAutoridad: '', gestionConflictos: '', resilienciaFrustracion: '', autoconceptoMetas: '', ...a,
    }
  }
  return salida as T
}
