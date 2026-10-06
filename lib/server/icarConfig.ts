// Configuracion del examen ICAR (nivel maximo y rotacion): que valor manda y que items entran.
// Antes viajaba en la URL del candidato sin firma (?max= y ?norot=); ahora va firmada en el token (lib/server/evaluacionToken.ts).
import type { ConfigIcarToken } from './evaluacionToken.ts'

export const NIVEL_ICAR_POR_DEFECTO = 3

export type ConfigIcar = { max: number; sinRotacion: boolean; origen: 'token' | 'defecto' | 'url' }

const comoNivel = (v: unknown): number => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 1 ? Math.min(n, NIVEL_ICAR_POR_DEFECTO) : NIVEL_ICAR_POR_DEFECTO
}

const comoBandera = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true'

/**
 * Decide la configuracion del examen:
 *  1. Si el token la fija, manda el token (el administrador la firmo; el candidato no la puede cambiar).
 *  2. Si no y ICAR esta en modo estricto (PUNTAJE_ESTRICTO), valen los valores por omision (3, con rotacion): la URL se ignora.
 *  3. Si no (transicion), vale lo que traiga la URL o el pedido, como antes: asi siguen funcionando los enlaces ya emitidos.
 */
export function resolverConfigIcar(p: { token?: ConfigIcarToken; estricto: boolean; max?: unknown; sinRotacion?: unknown }): ConfigIcar {
  if (p.token) return { max: p.token.max, sinRotacion: p.token.sinRotacion, origen: 'token' }
  if (p.estricto) return { max: NIVEL_ICAR_POR_DEFECTO, sinRotacion: false, origen: 'defecto' }
  return { max: comoNivel(p.max), sinRotacion: comoBandera(p.sinRotacion), origen: 'url' }
}

/** Los items que el candidato debe responder: mismo criterio que el filtro del GET (nivel <= max y, si se pide, sin rotacion). */
export function itemsDelExamenIcar<T extends { nivel_dificultad?: number | null; subtipo?: string | null }>(items: T[], cfg: Pick<ConfigIcar, 'max' | 'sinRotacion'>): T[] {
  // Igual que `.lte('nivel_dificultad', max)` y `.neq('subtipo', 'rotacion')` en SQL: un valor nulo no pasa ninguno de los dos
  return items.filter(i => typeof i.nivel_dificultad === 'number' && i.nivel_dificultad <= cfg.max && (!cfg.sinRotacion || (typeof i.subtipo === 'string' && i.subtipo !== 'rotacion')))
}

/**
 * Configuracion que el administrador eligio al armar el enlace, leida de la ruta que se le firma
 * (`/icar?max=2&norot=1`). Solo cuenta para la ruta /icar; sin `max` valido manda el nivel por omision.
 */
export function configIcarDeRuta(ruta: string): { max: 1 | 2 | 3; sinRotacion: boolean } | undefined {
  let url: URL
  try { url = new URL(ruta, 'http://local.invalid') } catch { return undefined }
  if (url.origin !== 'http://local.invalid' || url.pathname !== '/icar') return undefined // una ruta "//otro-host/icar" no es la nuestra
  return { max: comoNivel(url.searchParams.get('max')) as 1 | 2 | 3, sinRotacion: url.searchParams.get('norot') === '1' }
}
