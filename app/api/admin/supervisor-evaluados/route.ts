import { NextResponse } from 'next/server'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { idValido, procesosDelCandidato, validarHabilitacion } from '@/lib/server/supervisoresGestion'

// Habilitaciones: que evaluado (en que proceso) puede ver cada supervisor. Solo el administrador completo.

/** Con que supervisores se comparte un evaluado, mas lo que hace falta para compartirlo (sus procesos y los supervisores activos). */
export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const candidatoId = new URL(req.url).searchParams.get('candidato_id')
    if (!idValido(candidatoId)) return NextResponse.json({ error: 'Candidato inválido' }, { status: 400 })
    const db = createSupabaseAdmin()

    const procesoIds = await procesosDelCandidato(db, candidatoId)
    const [procesos, supervisores, habilitaciones] = await Promise.all([
      procesoIds.length ? db.from('procesos').select('id, nombre, cargo').in('id', procesoIds) : Promise.resolve({ data: [], error: null }),
      db.from('supervisores').select('email, nombre, activo').order('creado_en', { ascending: true }),
      db.from('supervisor_evaluados').select('supervisor_email, proceso_id, habilitado_en').eq('candidato_id', candidatoId),
    ])
    if (procesos.error) throw procesos.error
    if (supervisores.error) throw supervisores.error
    if (habilitaciones.error) throw habilitaciones.error

    return NextResponse.json({ procesos: procesos.data || [], supervisores: supervisores.data || [], habilitaciones: habilitaciones.data || [] })
  } catch (error) {
    console.error('[admin/supervisor-evaluados GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar con quién se comparte esta persona' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const body = await req.json().catch(() => ({}))
    const accion = String(body.accion || '')
    if (accion !== 'habilitar' && accion !== 'quitar') return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })

    const datos = validarHabilitacion(body)
    if (!datos.ok) return NextResponse.json({ error: datos.error }, { status: 400 })
    const db = createSupabaseAdmin()

    if (accion === 'habilitar') {
      const { data: supervisor, error: supervisorError } = await db.from('supervisores').select('email, activo').eq('email', datos.email).maybeSingle()
      if (supervisorError) throw supervisorError
      if (!supervisor) return NextResponse.json({ error: 'Ese supervisor no existe' }, { status: 404 })
      if (!supervisor.activo) return NextResponse.json({ error: 'Ese supervisor está desactivado. Activalo antes de compartirle a alguien.' }, { status: 409 })

      // Solo se comparte un proceso en el que la persona realmente participa
      const procesos = await procesosDelCandidato(db, datos.candidatoId)
      if (!procesos.includes(datos.procesoId)) return NextResponse.json({ error: 'Esa persona no participa de ese proceso' }, { status: 400 })

      const { error } = await db.from('supervisor_evaluados').upsert(
        { supervisor_email: datos.email, candidato_id: datos.candidatoId, proceso_id: datos.procesoId, habilitado_por: auth.user?.email || null },
        { onConflict: 'supervisor_email,candidato_id,proceso_id', ignoreDuplicates: true },
      )
      if (error) throw error
      await registrarAcceso(db, auth, { accion: 'habilitar_supervisor', candidatoId: datos.candidatoId, procesoId: datos.procesoId }, req)
      return NextResponse.json({ success: true })
    }

    const { error } = await db.from('supervisor_evaluados').delete()
      .eq('supervisor_email', datos.email).eq('candidato_id', datos.candidatoId).eq('proceso_id', datos.procesoId)
    if (error) throw error
    await registrarAcceso(db, auth, { accion: 'quitar_supervisor', candidatoId: datos.candidatoId, procesoId: datos.procesoId }, req)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/supervisor-evaluados POST]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 })
  }
}
