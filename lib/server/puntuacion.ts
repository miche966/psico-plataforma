/**
 * Puntaje de los tests calculado en el servidor.
 *
 * Hasta ahora cada pagina de test corregia en el navegador y el servidor guardaba el resultado tal cual.
 * Este modulo reproduce esas mismas formulas (mismos nombres de clave, mismo redondeo) para que el
 * servidor pueda recalcular -- primero para comparar (modo sombra) y despues para ser quien decide.
 * La forma de `puntaje_bruto` NO puede cambiar: informe, panel, estadisticas y PDF clasifican por nombre
 * de clave. Modulo puro (sin next/server) para poder testearlo con los datos reales.
 */

export interface ItemPuntuable {
  id: string
  factor?: string | null
  inverso?: boolean | null
  respuesta_correcta?: string | null
  opciones?: string[] | null
  subtipo?: string | null
  nivel_dificultad?: number | null
}

/** Una respuesta tal como llega del navegador: `valor` (formato actual) u `opcion` (eleccion cruda). */
export interface RespuestaEntrada {
  item_id: string
  valor?: unknown
  opcion?: unknown
}

export interface OpcionesPuntaje {
  /**
   * Likert: true (formato actual) = el navegador ya invirtio el valor de los items inversos;
   * false = manda la eleccion cruda y el servidor invierte.
   */
  valoresInvertidos?: boolean
}

export type ResultadoPuntaje =
  | { ok: true; puntaje: Record<string, unknown>; respuestas: Array<{ item_id: string; valor: number }> }
  | { ok: false; error: string }

type Config =
  | { estrategia: 'likert'; factores: string[]; vacioEsCero: boolean; promedioGeneral?: boolean; nivelEstres?: boolean }
  | { estrategia: 'dass21'; factores: string[] }
  | { estrategia: 'clave'; agrupaPor: 'factor' | 'subtipo' | null }

const ID = {
  bigfive: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  icar: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
  estresLaboral: 'd0e1f2a3-b4c5-6789-defa-000000000001',
  creatividad: 'e1f2a3b4-c5d6-7890-efab-111222333444',
  integridad: 'e5f6a7b8-c9d0-1234-efab-345678901234',
  hexaco: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  numerico: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  verbal: 'd4e5f6a7-b8c9-0123-defa-234567890123',
  sjtVentas: 'a7b8c9d0-e1f2-3456-abcd-777777777777',
  tolerancia: 'e5f6a7b8-c9d0-1234-efab-555555555555',
  sjtProblemas: 'f2a3b4c5-d6e7-8901-fabc-222333444555',
  sjtLegal: 'c9d0e1f2-a3b4-5678-cdef-999999999999',
  sjtComercial: 'b2c3d4e5-f6a7-8901-bcde-222222222222',
  comercial: 'a1b2c3d4-e5f6-7890-abcd-111111111111',
  atencionDetalle: 'b8c9d0e1-f2a3-4567-bcde-888888888888',
  sjtAtencion: 'f6a7b8c9-d0e1-2345-fabc-666666666666',
  sjtCobranzas: 'e9b2c3d4-f5a6-7890-bcde-999999999999',
  dass21: '7a8b9c0d-e1f2-4356-abcd-999999999999',
  iniciativa: '0b6ade42-0c8f-4084-a4a5-9ff7869d73b6',
} as const

// Cada entrada replica a la pagina del test (app/<test>/page.tsx): que factores cuenta y que hace con uno vacio.
// vacioEsCero: Big Five e Iniciativa guardan 0 si un factor no tiene items; el resto divide por cero y guarda NaN
// (que JSON convierte en null) -- se mantiene igual para que el resultado sea identico al de hoy.
const CONFIG: Record<string, Config> = {
  [ID.bigfive]: { estrategia: 'likert', factores: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura'], vacioEsCero: true },
  [ID.hexaco]: { estrategia: 'likert', factores: ['honestidad', 'emocionalidad', 'extraversion', 'amabilidad', 'responsabilidad', 'apertura'], vacioEsCero: false },
  [ID.integridad]: { estrategia: 'likert', factores: ['honestidad', 'normas', 'etica'], vacioEsCero: false, promedioGeneral: true },
  [ID.iniciativa]: { estrategia: 'likert', factores: ['logro', 'dinamismo'], vacioEsCero: true },
  [ID.estresLaboral]: { estrategia: 'likert', factores: ['carga_laboral', 'relaciones', 'claridad_rol', 'equilibrio', 'burnout'], vacioEsCero: false, promedioGeneral: true, nivelEstres: true },
  [ID.creatividad]: { estrategia: 'likert', factores: ['pensamiento_divergente', 'flexibilidad', 'innovacion', 'tolerancia_ambiguedad', 'curiosidad'], vacioEsCero: false },
  [ID.comercial]: { estrategia: 'likert', factores: ['orientacion_cliente', 'tolerancia_rechazo', 'motivacion_logro', 'proactividad'], vacioEsCero: false },
  [ID.dass21]: { estrategia: 'dass21', factores: ['depresion', 'ansiedad', 'estres'] },
  [ID.verbal]: { estrategia: 'clave', agrupaPor: null },
  [ID.numerico]: { estrategia: 'clave', agrupaPor: null },
  [ID.icar]: { estrategia: 'clave', agrupaPor: 'subtipo' },
  [ID.atencionDetalle]: { estrategia: 'clave', agrupaPor: 'factor' },
  [ID.tolerancia]: { estrategia: 'clave', agrupaPor: 'factor' },
  [ID.sjtVentas]: { estrategia: 'clave', agrupaPor: 'factor' },
  [ID.sjtProblemas]: { estrategia: 'clave', agrupaPor: 'factor' },
  [ID.sjtLegal]: { estrategia: 'clave', agrupaPor: 'factor' },
  [ID.sjtComercial]: { estrategia: 'clave', agrupaPor: 'factor' },
  [ID.sjtAtencion]: { estrategia: 'clave', agrupaPor: 'factor' },
  [ID.sjtCobranzas]: { estrategia: 'clave', agrupaPor: 'factor' },
}

// Tests cuyas sesiones tienen sus items guardados bajo OTRO test_id. Las 131 sesiones de SJT Cobranzas
// (e9b2...9999) responden los 20 items que viven bajo Tolerancia (e5f6...5555): se verifico contra la base.
const BANCO_DE_ITEMS: Record<string, string> = {
  [ID.sjtCobranzas]: ID.tolerancia,
}

/** True si el servidor sabe puntuar este test (Frases incompletas y Role Play quedan fuera). */
export function esPuntuable(testId: string): boolean {
  return testId in CONFIG
}

/** test_id bajo el cual estan guardados los items de este test. */
export function bancoDeItems(testId: string): string {
  return BANCO_DE_ITEMS[testId] ?? testId
}

/** Es el test de ICAR: su universo de items depende del nivel maximo y de si se excluye "rotacion". */
export function esIcar(testId: string): boolean {
  return testId === ID.icar
}

const redondear1 = (n: number) => Math.round(n * 10) / 10

function esEnteroEnRango(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

/** Valida los ids de las respuestas contra los items del test; devuelve un mapa item_id -> respuesta. */
function indexarRespuestas(items: ItemPuntuable[], respuestas: RespuestaEntrada[]): { ok: true; porItem: Map<string, RespuestaEntrada> } | { ok: false; error: string } {
  const validos = new Set(items.map(i => i.id))
  const porItem = new Map<string, RespuestaEntrada>()
  for (const r of respuestas) {
    if (!validos.has(r.item_id)) return { ok: false, error: 'Una respuesta no corresponde a un ítem de esta evaluación.' }
    if (porItem.has(r.item_id)) return { ok: false, error: 'Hay una respuesta repetida para el mismo ítem.' }
    porItem.set(r.item_id, r)
  }
  return { ok: true, porItem }
}

/** Likert: media por factor (con la inversion de los items inversos), redondeada a 1 decimal. */
function puntuarLikert(cfg: Extract<Config, { estrategia: 'likert' }>, items: ItemPuntuable[], porItem: Map<string, RespuestaEntrada>, opciones: OpcionesPuntaje): ResultadoPuntaje {
  const invertidos = opciones.valoresInvertidos !== false
  const valores: Record<string, number[]> = Object.fromEntries(cfg.factores.map(f => [f, []]))
  const guardar: Array<{ item_id: string; valor: number }> = []
  for (const item of items) {
    const r = porItem.get(item.id)
    if (!r) continue
    if (!esEnteroEnRango(r.valor, 1, 5)) return { ok: false, error: 'Una respuesta tiene un valor fuera de rango.' }
    // Con valores ya invertidos (formato actual) se toma tal cual; con eleccion cruda se invierte aca
    const valor = !invertidos && item.inverso ? 6 - r.valor : r.valor
    guardar.push({ item_id: item.id, valor })
    if (item.factor && valores[item.factor]) valores[item.factor].push(valor)
  }
  const puntaje: Record<string, unknown> = {}
  const medias: number[] = []
  for (const factor of cfg.factores) {
    const v = valores[factor]
    const media = v.length > 0 ? redondear1(v.reduce((a, b) => a + b, 0) / v.length) : cfg.vacioEsCero ? 0 : NaN
    puntaje[factor] = media
    medias.push(media)
  }
  if (cfg.promedioGeneral) {
    const general = redondear1(medias.reduce((a, b) => a + b, 0) / medias.length)
    puntaje.promedio_general = general
    if (cfg.nivelEstres) puntaje.nivel_estres = general >= 4 ? 'alto' : general >= 3 ? 'moderado' : 'bajo'
  }
  return { ok: true, puntaje, respuestas: guardar }
}

/** DASS-21: suma de los valores (0-3) de cada subescala, por 2. */
function puntuarDass21(cfg: Extract<Config, { estrategia: 'dass21' }>, items: ItemPuntuable[], porItem: Map<string, RespuestaEntrada>): ResultadoPuntaje {
  const sumas: Record<string, number> = Object.fromEntries(cfg.factores.map(f => [f, 0]))
  const guardar: Array<{ item_id: string; valor: number }> = []
  for (const item of items) {
    const r = porItem.get(item.id)
    if (!r) continue
    if (!esEnteroEnRango(r.valor, 0, 3)) return { ok: false, error: 'Una respuesta tiene un valor fuera de rango.' }
    guardar.push({ item_id: item.id, valor: r.valor })
    if (item.factor && sumas[item.factor] !== undefined) sumas[item.factor] += r.valor
  }
  return { ok: true, puntaje: Object.fromEntries(cfg.factores.map(f => [f, sumas[f] * 2])), respuestas: guardar }
}

/** Una respuesta de test con clave es correcta si la opcion elegida es la `respuesta_correcta` del item. */
function esCorrecta(item: ItemPuntuable, r: RespuestaEntrada | undefined): boolean | { error: string } {
  if (!r) return false // sin respuesta (se agoto el tiempo): cuenta como incorrecta, igual que en el navegador
  if (r.opcion !== undefined && r.opcion !== null) {
    // Eleccion cruda: por indice dentro de items.opciones, o por el texto de la opcion
    const opciones = item.opciones || []
    const texto = typeof r.opcion === 'number' ? opciones[r.opcion] : typeof r.opcion === 'string' ? r.opcion : undefined
    if (texto === undefined) return { error: 'Una respuesta tiene una opción inválida.' }
    return Boolean(item.respuesta_correcta) && texto === item.respuesta_correcta
  }
  // Formato actual: el navegador manda su propia correccion (1/0). Solo se puede creer, no verificar.
  if (!esEnteroEnRango(r.valor, 0, 1)) return { error: 'Una respuesta tiene un valor fuera de rango.' }
  return r.valor === 1
}

/** Tests con clave: correctas / total / porcentaje, y desglose por factor o subtipo segun el test. */
function puntuarClave(cfg: Extract<Config, { estrategia: 'clave' }>, items: ItemPuntuable[], porItem: Map<string, RespuestaEntrada>): ResultadoPuntaje {
  let correctas = 0
  const desglose: Record<string, { correctas: number; total: number }> = {}
  const guardar: Array<{ item_id: string; valor: number }> = []
  for (const item of items) {
    const ok = esCorrecta(item, porItem.get(item.id))
    if (typeof ok === 'object') return { ok: false, error: ok.error }
    if (ok) correctas++
    guardar.push({ item_id: item.id, valor: ok ? 1 : 0 })
    if (cfg.agrupaPor) {
      const clave = String(cfg.agrupaPor === 'subtipo' ? item.subtipo : item.factor)
      desglose[clave] ??= { correctas: 0, total: 0 }
      desglose[clave].total++
      if (ok) desglose[clave].correctas++
    }
  }
  const puntaje: Record<string, unknown> = { correctas, total: items.length, porcentaje: Math.round((correctas / items.length) * 100) }
  if (cfg.agrupaPor === 'factor') puntaje.por_factor = desglose
  if (cfg.agrupaPor === 'subtipo') puntaje.por_subtipo = desglose
  return { ok: true, puntaje, respuestas: guardar }
}

/**
 * Calcula el puntaje de un test a partir de sus items y de las respuestas del candidato.
 *
 * `items` es el universo que el candidato debia responder (para ICAR, ya filtrado por nivel maximo y
 * rotacion). No incluye `metricas_fraude` ni `nivel_maximo` de ICAR: son datos que no salen de las
 * respuestas y los agrega quien llama.
 */
export function calcularPuntaje(testId: string, items: ItemPuntuable[], respuestas: RespuestaEntrada[], opciones: OpcionesPuntaje = {}): ResultadoPuntaje {
  const cfg = CONFIG[testId]
  if (!cfg) return { ok: false, error: 'Este test no se puntúa en el servidor.' }
  if (items.length === 0) return { ok: false, error: 'La evaluación no tiene ítems.' }
  const indexadas = indexarRespuestas(items, respuestas)
  if (!indexadas.ok) return indexadas
  if (cfg.estrategia === 'likert') return puntuarLikert(cfg, items, indexadas.porItem, opciones)
  if (cfg.estrategia === 'dass21') return puntuarDass21(cfg, items, indexadas.porItem)
  return puntuarClave(cfg, items, indexadas.porItem)
}
