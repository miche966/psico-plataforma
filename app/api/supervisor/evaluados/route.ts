import { NextResponse } from 'next/server'
import { requireSupervisorSession } from '@/lib/server/supervisorAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { listaEvaluados } from '@/lib/server/supervisorPanel'

// Lista de los evaluados que el administrador le habilito al supervisor (ver docs/PLAN_SUPERVISORES.md).
export async function GET(req: Request) {
  const auth = await requireSupervisorSession(req)
  if (auth.response) return auth.response

  try {
    const db = createSupabaseAdmin()
    const evaluados = await listaEvaluados(db, auth.email)
    await registrarAcceso(db, auth, { accion: 'supervisor_ver_evaluados' }, req)
    return NextResponse.json({ evaluados })
  } catch (error) {
    console.error('[supervisor/evaluados GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar tu lista de evaluados' }, { status: 500 })
  }
}
