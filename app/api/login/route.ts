import { NextResponse } from 'next/server'
import { crearClienteLogin } from '@/lib/server/clienteLogin'
import { clavePublica } from '@/lib/server/clavesSupabase'
import { rlLogin, rlPublico, verificarLimite, respuestaLimiteExcedido } from '@/lib/server/rateLimit'
import { z, validar } from '@/lib/server/validacion'

const loginSchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const campos = validar(loginSchema, body, 'Completá todos los campos.')
  if (!campos.ok) return campos.response
  const { email, password } = campos.data

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida'
  const { permitido: permitidoIp } = await verificarLimite(rlPublico, ip)
  if (!permitidoIp) return NextResponse.json(respuestaLimiteExcedido(), { status: 429 })

  const claveEmail = email.trim().toLowerCase()
  const { permitido: permitidoEmail } = await verificarLimite(rlLogin, claveEmail)
  if (!permitidoEmail) {
    return NextResponse.json({ error: 'Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.' }, { status: 429 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = clavePublica()
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Configuración de autenticación incompleta.' }, { status: 500 })
  }

  const supabase = crearClienteLogin(supabaseUrl, anonKey)
  const { data, error } = await supabase.auth.signInWithPassword({ email: claveEmail, password })

  if (error || !data.session) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos.' }, { status: 401 })
  }

  return NextResponse.json({ session: data.session })
}
