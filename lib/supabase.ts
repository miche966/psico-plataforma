import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Clave publica: la nueva (publishable) o, si no esta, la clasica (anon). Next solo incrusta lecturas literales.
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuración de Supabase incompleta.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
