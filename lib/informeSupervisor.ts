// Informe para supervisores (ver docs/PLAN_SUPERVISORES.md): un texto corto, en lenguaje llano, para la jefatura que va a recibir a
// la persona. NO es el informe tecnico: no lleva puntajes, factores, nombres de pruebas, datos de salud, alertas de irregularidad
// ni el dictamen. Se genera a partir del informe que el administrador ya aprobo y guardo, y solo se publica despues de que el
// administrador lo revisa. Modulo puro (sin red ni next/server) para poder testearlo.

export type InformeSupervisor = {
  version: 1
  comoTrabaja: string
  queAporta: string
  comoAcompanarlo: string
  aTenerEnCuenta: string
  /** Lo que surgio en la videoentrevista; null si no hay. */
  entrevista: string | null
}

export type ClaveSeccion = 'comoTrabaja' | 'queAporta' | 'comoAcompanarlo' | 'aTenerEnCuenta' | 'entrevista'

export const SECCIONES_SUPERVISOR: Array<{ clave: ClaveSeccion; titulo: string; ayuda: string; obligatoria: boolean }> = [
  { clave: 'comoTrabaja', titulo: 'Cómo trabaja', ayuda: 'Su estilo de trabajo: cómo se organiza, cómo se relaciona y a qué ritmo.', obligatoria: true },
  { clave: 'queAporta', titulo: 'Qué puede aportar al equipo', ayuda: 'Lo que suma a un equipo y a un puesto como este.', obligatoria: true },
  { clave: 'comoAcompanarlo', titulo: 'Cómo acompañar su incorporación', ayuda: 'Sugerencias concretas para los primeros meses.', obligatoria: true },
  { clave: 'aTenerEnCuenta', titulo: 'Aspectos a tener en cuenta', ayuda: 'Cosas a cuidar, dichas en tono constructivo.', obligatoria: true },
  { clave: 'entrevista', titulo: 'Lo que surgió en la entrevista', ayuda: 'Solo si hay videoentrevista. Puede quedar vacío.', obligatoria: false },
]

export const LARGO_MAXIMO_SECCION = 1500

export function informeVacio(): InformeSupervisor {
  return { version: 1, comoTrabaja: '', queAporta: '', comoAcompanarlo: '', aTenerEnCuenta: '', entrevista: null }
}

const limpiar = (v: unknown): string => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, LARGO_MAXIMO_SECCION) : '')

/** Acepta cualquier valor: solo se conservan las cinco secciones y solo si son texto, recortadas al largo maximo. */
export function normalizarInformeSupervisor(valor: unknown): InformeSupervisor {
  const o = valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {}
  const entrevista = limpiar(o.entrevista)
  return {
    version: 1,
    comoTrabaja: limpiar(o.comoTrabaja),
    queAporta: limpiar(o.queAporta),
    comoAcompanarlo: limpiar(o.comoAcompanarlo),
    aTenerEnCuenta: limpiar(o.aTenerEnCuenta),
    entrevista: entrevista || null,
  }
}

/** Para publicar hacen falta las cuatro secciones obligatorias. Devuelve los titulos de las que faltan. */
export function seccionesFaltantes(informe: InformeSupervisor): string[] {
  return SECCIONES_SUPERVISOR.filter(s => s.obligatoria && !informe[s.clave]).map(s => s.titulo)
}

// ---------- Revision de terminos ----------

type Regla = { patron: RegExp; motivo: string }

// BLOQUEANTES: no se puede publicar mientras aparezcan. Son el dictamen, los datos de salud, los numeros y nombres de pruebas,
// y las alertas de irregularidad. "Se recomienda acompanar..." NO bloquea: solo se bloquea recomendado/no recomendado.
const BLOQUEANTES: Regla[] = [
  { patron: /\b(no\s+)?recomendad[oa]s?\b/i, motivo: 'el dictamen' },
  { patron: /\bcon\s+reservas\b/i, motivo: 'el dictamen' },
  { patron: /\bdictamen(es)?\b/i, motivo: 'el dictamen' },
  { patron: /\b(no\s+)?apt[oa]s?\b/i, motivo: 'el dictamen' },
  { patron: /\b(contratar|descartar)(l[oa]s?)?\b/i, motivo: 'una recomendación de contratar o descartar' },
  { patron: /depresi[oó]n|depresiv/i, motivo: 'datos de salud' },
  { patron: /ansiedad|ansios/i, motivo: 'datos de salud' },
  { patron: /\bdass\b/i, motivo: 'datos de salud' },
  { patron: /burn[\s-]?out/i, motivo: 'datos de salud' },
  { patron: /salud\s+mental/i, motivo: 'datos de salud' },
  { patron: /diagn[oó]stic/i, motivo: 'datos de salud' },
  { patron: /trastorno|psicopatolog/i, motivo: 'datos de salud' },
  { patron: /estr[eé]s\s+(laboral|cr[oó]nico)/i, motivo: 'datos de salud' },
  { patron: /\d\s*%|%\s*\d/, motivo: 'un porcentaje' },
  { patron: /\bpercentil(es)?\b|\bP\d{2}\b/, motivo: 'un percentil' },
  { patron: /\bpuntaj(e|es)\b/i, motivo: 'un puntaje' },
  { patron: /\d\s*\/\s*(100|5|10)\b/, motivo: 'un puntaje' },
  { patron: /big\s*five|hexaco|\bicar\b|\bsjt\b|\bmbti\b/i, motivo: 'el nombre de una prueba' },
  { patron: /neuroticismo/i, motivo: 'un término técnico' },
  { patron: /\btests?\b/i, motivo: 'la palabra «test» (usá «prueba» o «evaluación»)' },
  { patron: /\balertas?\b|\bproctoring\b|irregularidad|copiar\s+y\s+pegar|pesta[ñn]as?\b/i, motivo: 'alertas de irregularidad' },
]

// ADVERTENCIAS: se pueden publicar, pero conviene revisarlas (suenan tecnicas para quien no es psicologo).
const ADVERTENCIAS: Regla[] = [
  { patron: /\bfactor(es)?\b/i, motivo: 'suena técnico' },
  { patron: /\bescalas?\b/i, motivo: 'suena técnico' },
  { patron: /\bdimensi(ó|o)n(es)?\b/i, motivo: 'suena técnico' },
  { patron: /\bestr[eé]s\b/i, motivo: 'puede leerse como dato de salud' },
  { patron: /psicom[eé]tric/i, motivo: 'suena técnico' },
  { patron: /\bcompetencias?\b/i, motivo: 'suena técnico' },
]

export type Hallazgo = { seccion: string; texto: string; motivo: string }
export type RevisionTerminos = { bloqueantes: Hallazgo[]; advertencias: Hallazgo[] }

export function revisarTerminos(informe: InformeSupervisor): RevisionTerminos {
  const bloqueantes: Hallazgo[] = []
  const advertencias: Hallazgo[] = []
  for (const s of SECCIONES_SUPERVISOR) {
    const texto = informe[s.clave]
    if (!texto) continue
    for (const r of BLOQUEANTES) {
      const m = texto.match(r.patron)
      if (m) bloqueantes.push({ seccion: s.titulo, texto: m[0], motivo: r.motivo })
    }
    for (const r of ADVERTENCIAS) {
      const m = texto.match(r.patron)
      if (m) advertencias.push({ seccion: s.titulo, texto: m[0], motivo: r.motivo })
    }
  }
  return { bloqueantes, advertencias }
}

// ---------- Entrada y salida de la IA ----------

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function narrativaATexto(item: unknown): string {
  if (typeof item === 'string') return item.trim()
  if (!item || typeof item !== 'object') return ''
  const d = item as Record<string, unknown>
  return [texto(d.tendencia) || texto(d.competencia), texto(d.mecanismo), texto(d.impacto_organizacional)].filter(Boolean).join('. ')
}

/**
 * Del informe tecnico guardado se toman SOLO estos campos para el informe de supervisores: resumen, fortalezas, areas de
 * desarrollo, analisis de la entrevista y el analisis del ajuste al puesto. Nunca el dictamen, el puntaje de ajuste, la
 * confiabilidad ni las alertas, los textos por factor ni nada de bienestar.
 */
export function entradaParaIa(contenido: unknown): { resumen: string; fortalezas: string[]; areasDeDesarrollo: string[]; entrevista: string; ajusteAlPuesto: string } {
  const c = contenido && typeof contenido === 'object' ? (contenido as Record<string, any>) : {}
  const lista = (v: unknown) => (Array.isArray(v) ? v.map(narrativaATexto).filter(Boolean) : [])
  const e = c.analisisEntrevista && typeof c.analisisEntrevista === 'object' ? (c.analisisEntrevista as Record<string, unknown>) : {}
  const entrevista = [e.trayectoriaMotivacion, e.estiloTrabajoAutoridad, e.gestionConflictos, e.resilienciaFrustracion, e.autoconceptoMetas].map(texto).filter(Boolean).join('\n')
  return {
    resumen: texto(c.resumenEjecutivo),
    fortalezas: lista(c.fortalezas),
    areasDeDesarrollo: lista(c.oportunidadesMejora),
    entrevista,
    ajusteAlPuesto: texto(c.ajusteCargo?.analisis),
  }
}

/** Hay material suficiente para escribir el informe? Sin resumen ni fortalezas no hay de donde partir. */
export function hayMaterial(entrada: ReturnType<typeof entradaParaIa>): boolean {
  return !!(entrada.resumen || entrada.fortalezas.length || entrada.areasDeDesarrollo.length)
}

export function construirPrompt(entrada: ReturnType<typeof entradaParaIa>, cargo: string): string {
  const bloque = (titulo: string, cuerpo: string) => (cuerpo ? `\n${titulo}:\n${cuerpo}\n` : '')
  return `Sos quien redacta, para la jefatura de una empresa, un informe breve sobre una persona que se va a incorporar al puesto de "${cargo || 'el cargo'}".
Quien lo lee es un jefe o jefa directa SIN formación en psicología: necesita entender cómo trabaja la persona y cómo acompañarla, no un informe técnico.

Reglas obligatorias:
- Lenguaje llano y frases cortas. Tercera persona, tono respetuoso y constructivo. Español rioplatense neutro.
- NO incluyas números, porcentajes, puntajes, percentiles ni escalas.
- NO nombres pruebas, tests, métodos ni siglas (nada de "Big Five", "HEXACO", "MBTI", "SJT", "ICAR", etc.), ni términos como "factor", "dimensión" o "competencia".
- NO menciones datos de salud ni de bienestar (estrés, ansiedad, depresión, burnout, diagnósticos).
- NO menciones alertas, irregularidades ni controles del proceso de evaluación.
- NO emitas ninguna recomendación sobre contratar o descartar, ni uses palabras como "recomendado", "apto" o "dictamen". Solo describís y sugerís cómo acompañar.
- No inventes datos que no estén en el material. Si algo no surge del material, no lo afirmes.
- Cada sección: de 2 a 4 oraciones.

Material de partida (informe ya revisado por el equipo de selección):
${bloque('Resumen', entrada.resumen)}${bloque('Fortalezas', entrada.fortalezas.map(f => `- ${f}`).join('\n'))}${bloque('Áreas de desarrollo', entrada.areasDeDesarrollo.map(f => `- ${f}`).join('\n'))}${bloque('Ajuste al puesto', entrada.ajusteAlPuesto)}${bloque('Entrevista', entrada.entrevista)}
Devolvé ÚNICAMENTE un JSON con estas claves, todas con texto:
{
  "comoTrabaja": "su estilo de trabajo: cómo se organiza, cómo se relaciona, a qué ritmo",
  "queAporta": "qué puede aportar al equipo y al puesto",
  "comoAcompanarlo": "sugerencias concretas para sus primeros meses",
  "aTenerEnCuenta": "aspectos a cuidar, en tono constructivo",
  "entrevista": "${entrada.entrevista ? 'lo que surgió en la entrevista, en lenguaje llano' : 'dejalo como cadena vacía'}"
}`
}

/** Saca el JSON de la respuesta de la IA, con o sin cercas de codigo. Devuelve null si no hay un objeto valido. */
export function extraerJson(respuesta: unknown): Record<string, unknown> | null {
  if (typeof respuesta !== 'string') return null
  const sinCercas = respuesta.replace(/```(?:json)?/gi, '').trim()
  const inicio = sinCercas.indexOf('{')
  const fin = sinCercas.lastIndexOf('}')
  if (inicio < 0 || fin <= inicio) return null
  try {
    const o = JSON.parse(sinCercas.slice(inicio, fin + 1))
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null
  } catch {
    return null
  }
}
