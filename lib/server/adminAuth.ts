import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from './supabaseAdmin'

function allowedAdminEmails() {
  return (process.env.ADMIN_EMAILS || 'mochoa@republicamicrofinanzas.com.uy')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export type AdminSession =
  | { response: NextResponse; user?: undefined; role?: undefined }
  | { user: any; role: 'admin'; response?: undefined }
  | { user: any; role: 'viewer'; allowedProcesoIds: string[]; response?: undefined }

/**
 * Busca el email en admin_roles/admin_role_procesos (segundo nivel de acceso,
 * de solo lectura y acotado a procesos especificos). Se consulta solo cuando
 * el email NO esta en ADMIN_EMAILS -- no agrega ninguna consulta al camino
 * feliz de la cuenta admin existente.
 */
async function buscarRolViewer(email: string): Promise<{ role: 'viewer'; allowedProcesoIds: string[] } | null> {
  const db = createSupabaseAdmin()
  const { data: fila } = await db.from('admin_roles').select('email').eq('email', email).maybeSingle()
  if (!fila) return null

  const { data: procesos } = await db.from('admin_role_procesos').select('proceso_id').eq('email', email)
  return { role: 'viewer', allowedProcesoIds: (procesos || []).map(p => p.proceso_id) }
}

export async function requireAdminSession(req: Request): Promise<AdminSession> {
  const authorization = req.headers.get('authorization')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !anonKey) {
    return { response: NextResponse.json({ error: 'Sesion administrativa requerida' }, { status: 401 }) }
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
    cache: 'no-store',
  })

  if (!userResponse.ok) {
    return { response: NextResponse.json({ error: 'Sesion administrativa invalida o vencida' }, { status: 401 }) }
  }

  const user = await userResponse.json()
  const email = String(user.email || '').trim().toLowerCase()
  if (!email) {
    return { response: NextResponse.json({ error: 'La cuenta no esta autorizada para esta operacion' }, { status: 403 }) }
  }

  if (allowedAdminEmails().includes(email)) {
    return { user, role: 'admin' }
  }

  const rolViewer = await buscarRolViewer(email)
  if (rolViewer) {
    return { user, ...rolViewer }
  }

  return { response: NextResponse.json({ error: 'La cuenta no esta autorizada para esta operacion' }, { status: 403 }) }
}

/** Para rutas de escritura/generacion: un viewer nunca debe pasar de aca. */
export function requireFullAdmin(auth: AdminSession) {
  if (auth.response) return auth.response
  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'Esta cuenta tiene acceso de solo lectura' }, { status: 403 })
  }
  return null
}