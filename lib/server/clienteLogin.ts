import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase Auth para iniciar sesion desde el servidor (/api/login).
 *
 * autoRefreshToken DEBE ser false: en Node, supabase-js arranca un timer de auto-refresh que
 * mantiene viva la sesion del cliente. Esa sesion es la MISMA que se le entrega al navegador, asi
 * que cuando el token esta por vencer (~1 hora) el servidor lo renueva por su cuenta, gasta el
 * refresh token y el navegador queda con uno "ya usado": "Invalid Refresh Token: Already Used" y
 * se cierra la sesion del administrador. El servidor solo tiene que autenticar y soltar la sesion.
 * (tests/cliente-login.test.ts cubre esta configuracion.)
 */
export function crearClienteLogin(supabaseUrl: string, anonKey: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
