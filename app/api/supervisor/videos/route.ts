import { NextResponse } from 'next/server'
import { requireSupervisorSession } from '@/lib/server/supervisorAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { firmarVideos } from '@/lib/server/firmarVideos'
import { videosDelEvaluado } from '@/lib/server/supervisorPanel'

// Videoentrevistas de un evaluado habilitado, solo las de las entrevistas de ese proceso. Las URL salen firmadas y vencen a las 2
// horas; la pantalla las vuelve a pedir si vencen. Si no esta habilitado responde 404. Ver docs/PLAN_SUPERVISORES.md.
export async function GET(req: Request) {
  const auth = await requireSupervisorSession(req)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const candidatoId = url.searchParams.get('candidato_id')
    const procesoId = url.searchParams.get('proceso_id')
    const db = createSupabaseAdmin()
    const videos = await videosDelEvaluado(db, auth.email, candidatoId, procesoId, filas => firmarVideos(filas, db))
    if (!videos) return NextResponse.json({ error: 'No se encontró esa persona' }, { status: 404 })
    await registrarAcceso(db, auth, { accion: 'supervisor_ver_videos', candidatoId, procesoId }, req)
    return NextResponse.json({ videos })
  } catch (error) {
    console.error('[supervisor/videos GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las videoentrevistas' }, { status: 500 })
  }
}
