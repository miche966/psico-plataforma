import { createClient } from '@supabase/supabase-js'
import { claveDeServicio } from './clavesSupabase'

/**
 * Cliente exclusivo para rutas server-side.
 * Nunca debe importarse desde componentes del navegador.
 */
export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  // SUPABASE_SECRET_KEY (la clave nueva) o, si no esta, SUPABASE_SERVICE_ROLE_KEY (la clasica)
  const serviceRoleKey = claveDeServicio()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuración de Supabase servidor incompleta.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
