import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from './supabaseAdmin'
import { cumpleMfa } from './mfa'
import { clavePublica } from './clavesSupabase'
import { decidirRolSupervisor } from './supervisorRol'

// Autorizacion de los supervisores de la empresa (ver docs/PLAN_SUPERVISORES.md). Es un rol APARTE del administrador y del de
// solo lectura: requireAdminSession nunca devuelve una sesion para un supervisor, y estas rutas (/api/supervisor/*) solo
// aceptan supervisores. Una misma cuenta no puede tener dos roles.

export type SupervisorSession =
  | { response: NextResponse; user?: undefined; role?: undefined; email?: undefined }
  | { user: any; role: 'supervisor'; email: string; response?: undefined }

function emailsAdmin(): string[] {
  return (process.env.ADMIN_EMAILS || 'mochoa@republicamicrofinanzas.com.uy')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Valida la sesion de un supervisor: el token lo valida Supabase Auth, se exige 2FA ('aal2') salvo `permitirAal1`
 * (solo whoami, para que la pantalla sepa si tiene que verificar el codigo) y el email debe estar en `supervisores` y activo.
 */
export async function requireSupervisorSession(req: Request, opciones: { permitirAal1?: boolean } = {}): Promise<SupervisorSession> {
  const authorization = req.headers.get('authorization')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = clavePublica()

  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !anonKey) {
    return { response: NextResponse.json({ error: 'Sesion requerida' }, { status: 401 }) }
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
    cache: 'no-store',
  })
  if (!userResponse.ok) {
    return { response: NextResponse.json({ error: 'Sesion invalida o vencida' }, { status: 401 }) }
  }

  if (!opciones.permitirAal1 && !cumpleMfa(authorization)) {
    return { response: NextResponse.json({ error: 'Se requiere verificación en dos pasos', codigo: 'mfa_requerido' }, { status: 401 }) }
  }

  const user = await userResponse.json()
  const email = String(user.email || '').trim().toLowerCase()
  const noAutorizado = { response: NextResponse.json({ error: 'La cuenta no esta autorizada para esta operacion' }, { status: 403 }) }
  if (!email) return noAutorizado

  const db = createSupabaseAdmin()
  const { data: filaSupervisor } = await db.from('supervisores').select('email, activo').eq('email', email).maybeSingle()
  const { data: filaViewer } = filaSupervisor ? await db.from('admin_roles').select('email').eq('email', email).maybeSingle() : { data: null }

  const decision = decidirRolSupervisor({
    email,
    esAdmin: emailsAdmin().includes(email),
    esViewer: !!filaViewer,
    filaSupervisor: filaSupervisor || null,
  })
  if (decision !== 'supervisor') return noAutorizado

  return { user, role: 'supervisor', email }
}
