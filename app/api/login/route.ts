import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rlLogin, rlPublico, verificarLimite, respuestaLimiteExcedido } from '@/lib/server/rateLimit'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.json({ error: 'Completá todos los campos.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida'
  const { permitido: permitidoIp } = await verificarLimite(rlPublico, ip)
  if (!permitidoIp) return NextResponse.json(respuestaLimiteExcedido(), { status: 429 })

  const claveEmail = email.trim().toLowerCase()
  const { permitido: permitidoEmail } = await verificarLimite(rlLogin, claveEmail)
  if (!permitidoEmail) {
    return NextResponse.json({ error: 'Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.' }, { status: 429 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Configuración de autenticación incompleta.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data, error } = await supabase.auth.signInWithPassword({ email: claveEmail, password })

  if (error || !data.session) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 })
  }

  return NextResponse.json({ session: data.session })
}
