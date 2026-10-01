import { NextResponse } from 'next/server'
import { crearClienteLogin } from '@/lib/server/clienteLogin'
import { rlPublico, rlRecuperacion, verificarLimite, respuestaLimiteExcedido } from '@/lib/server/rateLimit'
import { z, validar } from '@/lib/server/validacion'

const recuperacionSchema = z.object({
  email: z.string().trim().min(3).max(254).includes('@'),
})

/**
 * Pedido de recuperacion de contrasena. Antes la pagina llamaba a Supabase Auth directo desde el
 * navegador, sin ningun limite propio; ahora pasa por aca para limitar por IP y por email.
 * Responde lo mismo exista o no la cuenta (no revela que emails estan registrados).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const campos = validar(recuperacionSchema, body, 'Ingresá tu email.')
  if (!campos.ok) return campos.response
  const email = campos.data.email.toLowerCase()

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida'
  const { permitido: permitidoIp } = await verificarLimite(rlPublico, ip)
  if (!permitidoIp) return NextResponse.json(respuestaLimiteExcedido(), { status: 429 })

  const { permitido: permitidoEmail } = await verificarLimite(rlRecuperacion, email)
  if (!permitidoEmail) {
    return NextResponse.json({ error: 'Ya se pidieron varios enlaces para este email. Esperá un rato antes de intentar de nuevo.' }, { status: 429 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Configuración de autenticación incompleta.' }, { status: 500 })
  }

  const supabase = crearClienteLogin(supabaseUrl, anonKey)
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${new URL(request.url).origin}/reset-password` })
  if (error) {
    console.error('[forgot-password] Supabase Auth rechazo el pedido:', error.message)
    return NextResponse.json({ error: 'No se pudo enviar el correo de recuperación.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
