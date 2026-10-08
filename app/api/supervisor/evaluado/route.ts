import { NextResponse } from 'next/server'
import { requireSupervisorSession } from '@/lib/server/supervisorAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { detalleEvaluado } from '@/lib/server/supervisorPanel'

// Un evaluado: datos basicos y el informe PUBLICADO. Si el supervisor no lo tiene habilitado en ese proceso responde 404 (no se
// confirma que la persona exista). Ver docs/PLAN_SUPERVISORES.md.
const NO_ENCONTRADO = () => NextResponse.json({ error: 'No se encontró esa persona' }, { status: 404 })

export async function GET(req: Request) {
  const auth = await requireSupervisorSession(req)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const candidatoId = url.searchParams.get('candidato_id')
    const procesoId = url.searchParams.get('proceso_id')
    const db = createSupabaseAdmin()
    const detalle = await detalleEvaluado(db, auth.email, candidatoId, procesoId)
    if (!detalle) return NO_ENCONTRADO()
    await registrarAcceso(db, auth, { accion: 'supervisor_ver_evaluado', candidatoId, procesoId }, req)
    return NextResponse.json({ evaluado: detalle })
  } catch (error) {
    console.error('[supervisor/evaluado GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar esta persona' }, { status: 500 })
  }
}

/** Registra la descarga del informe en PDF (la pantalla lo llama justo antes de generarlo). */
export async function POST(req: Request) {
  const auth = await requireSupervisorSession(req)
  if (auth.response) return auth.response

  try {
    const body = await req.json().catch(() => ({}))
    if (body.accion !== 'descargar') return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
    const db = createSupabaseAdmin()
    const detalle = await detalleEvaluado(db, auth.email, body.candidato_id, body.proceso_id)
    if (!detalle || !detalle.informe) return NO_ENCONTRADO()
    await registrarAcceso(db, auth, { accion: 'supervisor_descargar_informe', candidatoId: body.candidato_id, procesoId: body.proceso_id }, req)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[supervisor/evaluado POST]', error)
    return NextResponse.json({ error: 'No se pudo preparar la descarga' }, { status: 500 })
  }
}
