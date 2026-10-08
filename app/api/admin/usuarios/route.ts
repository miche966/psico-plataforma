import { NextResponse } from 'next/server'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { borrarFactoresMfa } from '@/lib/server/borrarFactoresMfa'
import { emailsAdmin } from '@/lib/server/supervisorRol'

// Alta y listado de cuentas "viewer" (solo lectura, acotadas a procesos especificos).
// Ambas operaciones son superadmin-only: un viewer nunca puede crear otro viewer ni
// ampliar su propio alcance -- requireFullAdmin corta antes de tocar la base.

export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const db = createSupabaseAdmin()
    const [{ data: cuentas, error: cuentasError }, { data: asignaciones, error: asignacionesError }] = await Promise.all([
      db.from('admin_roles').select('email, role, creado_en, invitado_por').order('creado_en', { ascending: false }),
      db.from('admin_role_procesos').select('email, proceso_id'),
    ])
    if (cuentasError) throw cuentasError
    if (asignacionesError) throw asignacionesError

    const procesosPorEmail = new Map<string, string[]>()
    for (const fila of asignaciones || []) {
      const lista = procesosPorEmail.get(fila.email) || []
      lista.push(fila.proceso_id)
      procesosPorEmail.set(fila.email, lista)
    }

    const resultado = (cuentas || []).map(c => ({ ...c, procesoIds: procesosPorEmail.get(c.email) || [] }))
    return NextResponse.json({ cuentas: resultado })
  } catch (error) {
    console.error('[admin/usuarios GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las cuentas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()

    if (body.accion === 'restablecer_2fa') return await restablecer2fa(req, auth, email)

    const procesoIds: string[] = Array.isArray(body.procesoIds) ? body.procesoIds.filter((id: unknown) => typeof id === 'string') : []

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (procesoIds.length === 0) {
      return NextResponse.json({ error: 'Elegí al menos un proceso para esta cuenta' }, { status: 400 })
    }

    // Un administrador siempre entra como administrador (ADMIN_EMAILS se revisa primero): darle una cuenta de solo lectura no restringe nada
    if (emailsAdmin().includes(email)) {
      return NextResponse.json({ error: 'Ese email es de un administrador y siempre ve todo: una cuenta de solo lectura no le limitaría el acceso. Usá otro email.' }, { status: 409 })
    }

    const db = createSupabaseAdmin()

    // Una cuenta no puede ser a la vez de solo lectura y supervisor
    const { data: esSupervisor, error: supervisorError } = await db.from('supervisores').select('email').eq('email', email).maybeSingle()
    if (supervisorError && supervisorError.code !== '42P01') throw supervisorError
    if (esSupervisor) return NextResponse.json({ error: 'Ese email ya es de un supervisor. Una cuenta no puede tener los dos accesos.' }, { status: 409 })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const { error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${baseUrl.replace(/\/$/, '')}/reset-password`,
    })
    if (inviteError) {
      // "already registered" no es un error real acá: la cuenta puede ya existir en Supabase
      // Auth (invitada antes, o dada de alta a mano) -- igual seguimos y le asignamos el rol.
      const yaExiste = /already.*registered|already.*exists/i.test(inviteError.message || '')
      if (!yaExiste) {
        console.error('[admin/usuarios POST] invite', inviteError)
        return NextResponse.json({ error: `No se pudo invitar a ${email}: ${inviteError.message}` }, { status: 502 })
      }
    }

    const { error: rolError } = await db.from('admin_roles').upsert(
      { email, role: 'viewer', invitado_por: auth.user?.email || null },
      { onConflict: 'email' }
    )
    if (rolError) throw rolError

    // Reemplaza la asignacion de procesos por completo (alta simple: no hay UI de edicion
    // todavia, asi que un segundo POST para el mismo email actualiza sus procesos).
    const { error: borrarError } = await db.from('admin_role_procesos').delete().eq('email', email)
    if (borrarError) throw borrarError

    const { error: insertarError } = await db.from('admin_role_procesos').insert(
      procesoIds.map(proceso_id => ({ email, proceso_id }))
    )
    if (insertarError) throw insertarError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/usuarios POST]', error)
    return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 })
  }
}

/**
 * Restablece el 2FA de una cuenta de solo lectura que perdio su dispositivo: borra sus factores (cierra todas
 * sus sesiones) y en su proximo ingreso tendra que enrolar uno nuevo. No hay codigos de recuperacion, asi que
 * esta es la via de rescate; solo el administrador completo, y solo para cuentas dadas de alta en admin_roles.
 */
async function restablecer2fa(req: Request, auth: { user?: { email?: string | null }; role?: string }, email: string) {
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  const db = createSupabaseAdmin()

  const { data: cuenta, error: cuentaError } = await db.from('admin_roles').select('email').eq('email', email).maybeSingle()
  if (cuentaError) throw cuentaError
  if (!cuenta) return NextResponse.json({ error: 'Esa cuenta no está entre las cuentas de solo lectura' }, { status: 404 })

  const { encontrado, eliminados } = await borrarFactoresMfa(db, email)
  if (!encontrado) return NextResponse.json({ error: 'La cuenta todavía no creó su usuario (no aceptó la invitación)' }, { status: 404 })

  console.warn(`[admin/usuarios] 2FA restablecido por ${auth.user?.email}: ${eliminados} dispositivo(s) de ${email}`)
  await registrarAcceso(db, auth, { accion: 'restablecer_2fa' }, req)
  return NextResponse.json({ success: true, eliminados })
}
