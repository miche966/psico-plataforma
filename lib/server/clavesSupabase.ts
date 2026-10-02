/**
 * Claves de Supabase que usa el servidor, con compatibilidad entre las claves nuevas y las clasicas.
 *
 * - Clave de servicio: `SUPABASE_SECRET_KEY` (sb_secret_..., la nueva) o, si no esta, `SUPABASE_SERVICE_ROLE_KEY`
 *   (el JWT clasico). Se prefiere la nueva para poder pasar a ella cambiando solo variables de entorno.
 * - Clave publica: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sb_publishable_...) o, si no, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 *
 * La clave `secret` NO es un JWT: no sirve en una cabecera `Authorization: Bearer`; hay que usarla siempre a traves
 * de supabase-js (createSupabaseAdmin) o en la cabecera `apikey`. Modulo puro (sin next/server).
 */
type Env = Record<string, string | undefined>

const limpiar = (valor: string | undefined) => (valor && valor.trim() ? valor.trim() : undefined)

export function claveDeServicio(env: Env = process.env): string | undefined {
  return limpiar(env.SUPABASE_SECRET_KEY) ?? limpiar(env.SUPABASE_SERVICE_ROLE_KEY)
}

export function clavePublica(env: Env = process.env): string | undefined {
  return limpiar(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? limpiar(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export type TipoDeClave = 'nueva' | 'clasica' | 'desconocida'

/** 'nueva' = sb_publishable_ / sb_secret_; 'clasica' = un JWT (eyJ...). Solo para diagnostico, nunca imprime la clave. */
export function tipoDeClave(clave: string | undefined): TipoDeClave {
  if (!clave) return 'desconocida'
  if (clave.startsWith('sb_publishable_') || clave.startsWith('sb_secret_')) return 'nueva'
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(clave)) return 'clasica'
  return 'desconocida'
}
