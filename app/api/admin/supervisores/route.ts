import { NextResponse } from 'next/server'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { borrarFactoresMfa } from '@/lib/server/borrarFactoresMfa'
import { emailsAdmin } from '@/lib/server/supervisorRol'
import { normalizarEmail, otroRolDeLaCuenta, validarAlta } from '@/lib/server/supervisoresGestion'

// Alta, listado y estado de los supervisores de la empresa (ver docs/PLAN_SUPERVISORES.md). Solo el administrador completo:
// un supervisor (o una cuenta de solo lectura) nunca puede crear supervisores ni ampliar su propio alcance.

export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const db = createSupabaseAdmin()
    const [{ data: supervisores, error: supervisoresError }, { data: habilitaciones, error: habilitacionesError }] = await Promise.all([
      db.from('supervisores').select('email, nombre, activo, creado_en, invitado_por').order('creado_en', { ascending: false }),
      db.from('supervisor_evaluados').select('supervisor_email, candidato_id, proceso_id, habilitado_en').order('habilitado_en', { ascending: false }),
    ])
    if (supervisoresError) throw supervisoresError
    if (habilitacionesError) throw habilitacionesError

    // Nombres legibles de las personas y los procesos habilitados
    const candidatoIds = Array.from(new Set((habilitaciones || []).map(h => h.candidato_id)))
    const procesoIds = Array.from(new Set((habilitaciones || []).map(h => h.proceso_id)))
    const [candidatos, procesos] = await Promise.all([
      candidatoIds.length ? db.from('candidatos').select('id, nombre, apellido').in('id', candidatoIds) : Promise.resolve({ data: [], error: null }),
      procesoIds.length ? db.from('procesos').select('id, nombre, cargo').in('id', procesoIds) : Promise.resolve({ data: [], error: null }),
    ])
    if (candidatos.error) throw candidatos.error
    if (procesos.error) throw procesos.error
    const nombreCandidato = new Map((candidatos.data || []).map((c: any) => [c.id, `${c.nombre} ${c.apellido}`.trim()]))
    const datosProceso = new Map((procesos.data || []).map((p: any) => [p.id, p]))

    const resultado = (supervisores || []).map(s => ({
      ...s,
      habilitaciones: (habilitaciones || [])
        .filter(h => h.supervisor_email === s.email)
        .map(h => ({
          candidato_id: h.candidato_id,
          proceso_id: h.proceso_id,
          habilitado_en: h.habilitado_en,
          candidato_nombre: nombreCandidato.get(h.candidato_id) || 'Persona eliminada',
          proceso_nombre: datosProceso.get(h.proceso_id)?.nombre || null,
          proceso_cargo: datosProceso.get(h.proceso_id)?.cargo || null,
        })),
    }))
    return NextResponse.json({ supervisores: resultado })
  } catch (error) {
    console.error('[admin/supervisores GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar los supervisores' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const body = await req.json().catch(() => ({}))
    const accion = String(body.accion || 'alta')
    const db = createSupabaseAdmin()

    if (accion === 'activar' || accion === 'desactivar') return await cambiarEstado(db, auth, req, normalizarEmail(body.email), accion === 'activar')
    if (accion === 'restablecer_2fa') return await restablecer2fa(db, auth, req, normalizarEmail(body.email))
    if (accion !== 'alta') return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })

    const datos = validarAlta(body)
    if (!datos.ok) return NextResponse.json({ error: datos.error }, { status: 400 })

    // Una cuenta no puede ser supervisor y ademas administrador o de solo lectura
    const otroRol = await otroRolDeLaCuenta(db, datos.email, emailsAdmin())
    if (otroRol) {
      const quien = otroRol === 'admin' ? 'administrador' : 'de solo lectura'
      return NextResponse.json({ error: `Ese email ya es una cuenta ${quien}. Una cuenta no puede tener dos accesos.` }, { status: 409 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const { error: inviteError } = await db.auth.admin.inviteUserByEmail(datos.email, {
      redirectTo: `${baseUrl.replace(/\/$/, '')}/reset-password`,
    })
    if (inviteError) {
      // "already registered" no es un error real: el usuario puede existir en Supabase Auth (invitado antes o creado a mano)
      const yaExiste = /already.*registered|already.*exists/i.test(inviteError.message || '')
      if (!yaExiste) {
        console.error('[admin/supervisores POST] invite', inviteError)
        return NextResponse.json({ error: 'No se pudo enviar la invitación. Revisá que el email sea correcto e intentá de nuevo.' }, { status: 502 })
      }
    }

    // Un alta repetida actualiza el nombre y reactiva la cuenta; conserva la fecha de creacion y sus habilitaciones
    const { error } = await db.from('supervisores').upsert(
      { email: datos.email, nombre: datos.nombre, activo: true, invitado_por: auth.user?.email || null },
      { onConflict: 'email' },
    )
    if (error) throw error

    await registrarAcceso(db, auth, { accion: 'alta_supervisor' }, req)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/supervisores POST]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 })
  }
}

async function cambiarEstado(db: any, auth: any, req: Request, email: string, activo: boolean) {
  if (!email) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  const { data, error } = await db.from('supervisores').update({ activo }).eq('email', email).select('email')
  if (error) throw error
  if (!data || data.length === 0) return NextResponse.json({ error: 'Ese supervisor no existe' }, { status: 404 })
  await registrarAcceso(db, auth, { accion: 'cambiar_estado_supervisor' }, req)
  return NextResponse.json({ success: true, activo })
}

/** Restablece el 2FA de un supervisor que perdio su dispositivo (solo cuentas de `supervisores`). */
async function restablecer2fa(db: any, auth: any, req: Request, email: string) {
  if (!email) return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  const { data: cuenta, error: cuentaError } = await db.from('supervisores').select('email').eq('email', email).maybeSingle()
  if (cuentaError) throw cuentaError
  if (!cuenta) return NextResponse.json({ error: 'Ese email no es de un supervisor' }, { status: 404 })

  const { encontrado, eliminados } = await borrarFactoresMfa(db, email)
  if (!encontrado) return NextResponse.json({ error: 'La cuenta todavía no creó su usuario (no aceptó la invitación)' }, { status: 404 })

  console.warn(`[admin/supervisores] 2FA restablecido por ${auth.user?.email}: ${eliminados} dispositivo(s) de ${email}`)
  await registrarAcceso(db, auth, { accion: 'restablecer_2fa' }, req)
  return NextResponse.json({ success: true, eliminados })
}
