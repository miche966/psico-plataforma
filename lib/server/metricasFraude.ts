/**
 * Saneado de `metricas_fraude` (telemetria del navegador: cambios de pestana, copiar y pegar, tiempo fuera de foco).
 *
 * Es el unico dato de `puntaje_bruto` que el servidor NO puede recalcular desde las respuestas: lo informa el navegador
 * (hooks/useProctoring.ts). Se conserva pero acotado: solo las claves y tipos esperados, numeros finitos y no negativos y
 * una lista de eventos de largo limitado. Asi un pedido hecho a mano no puede meter datos arbitrarios ni inflar la fila.
 * Modulo puro (sin next/server).
 */
const TIPOS_DE_EVENTO = new Set(['tab_switch', 'copy_paste', 'context_menu', 'blur'])
const MAX_EVENTOS = 200
const MAX_NUMERO = 1_000_000

export interface MetricasFraudeSaneadas {
  tabSwitches: number
  copyPasteAttempts: number
  timeOutOfFocus: number
  events: Array<{ tipo: string; timestamp: string; duracion?: number }>
}

const numero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), MAX_NUMERO) : 0)

/** Devuelve las metricas acotadas, o undefined si lo recibido no es un objeto. */
export function sanearMetricasFraude(valor: unknown): MetricasFraudeSaneadas | undefined {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return undefined
  const m = valor as Record<string, unknown>
  const eventos = Array.isArray(m.events) ? m.events.slice(0, MAX_EVENTOS) : []
  return {
    tabSwitches: numero(m.tabSwitches),
    copyPasteAttempts: numero(m.copyPasteAttempts),
    timeOutOfFocus: numero(m.timeOutOfFocus),
    events: eventos.flatMap(e => {
      if (!e || typeof e !== 'object') return []
      const ev = e as Record<string, unknown>
      if (typeof ev.tipo !== 'string' || !TIPOS_DE_EVENTO.has(ev.tipo)) return []
      const timestamp = typeof ev.timestamp === 'string' && !Number.isNaN(Date.parse(ev.timestamp)) ? ev.timestamp.slice(0, 40) : ''
      return [{ tipo: ev.tipo, timestamp, ...(typeof ev.duracion === 'number' && Number.isFinite(ev.duracion) && ev.duracion >= 0 ? { duracion: numero(ev.duracion) } : {}) }]
    }),
  }
}
