import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { readAll } from '@/lib/server/readAll'
import { candidatoIdsEnProcesos } from '@/lib/server/procesoScope'
import { leerResumenes } from '@/lib/server/resumenesIa'
import { leerDictamenes } from '@/lib/server/dictamenes'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response

    const db = createSupabaseAdmin()
    let [candidatos, procesos, sesiones, respuestasVideo, preguntasVideo] = await Promise.all([
      readAll(db, 'candidatos', '*', 'creado_en'),
      readAll(db, 'procesos', '*', 'creado_en'),
      readAll(db, 'sesiones', '*, procesos (id, nombre, cargo, competencias_requeridas, bateria_tests)', 'finalizada_en'),
      readAll(db, 'respuestas_video', '*', 'grabada_en'),
      readAll(db, 'preguntas_video', 'id, entrevista_id, pregunta')
    ])

    let progresoOperativo: any[] = []
    try {
      progresoOperativo = await readAll(db, 'progreso_evaluaciones', '*', 'ultima_actividad_en')
    } catch {
      progresoOperativo = []
    }

    let resumenesIa = await leerResumenes(db)
    // Dictamen guardado de cada informe (solo ese campo): lo usan las exportaciones a Excel
    let dictamenes = await leerDictamenes(db)

    if (auth.role === 'viewer') {
      const procesosPermitidos = new Set(auth.allowedProcesoIds)
      procesos = (procesos || []).filter((p: any) => procesosPermitidos.has(p.id))
      sesiones = (sesiones || []).filter((s: any) => s.proceso_id && procesosPermitidos.has(s.proceso_id))
      progresoOperativo = (progresoOperativo || []).filter((p: any) => p.proceso_id && procesosPermitidos.has(p.proceso_id))
      resumenesIa = resumenesIa.filter(r => r.proceso_id && procesosPermitidos.has(r.proceso_id))
      const idsCandidatos = await candidatoIdsEnProcesos(db, auth.allowedProcesoIds)
      dictamenes = dictamenes.filter(d => idsCandidatos.has(d.candidato_id))
      candidatos = (candidatos || []).filter((c: any) => idsCandidatos.has(c.id))
      respuestasVideo = (respuestasVideo || []).filter((r: any) => idsCandidatos.has(r.candidato_id))
    }

    return NextResponse.json({
      candidatos,
      procesos,
      sesiones,
      // El panel solo usa quien respondio que y cuando: la URL del video se pide aparte (ya firmada) al abrir al candidato
      respuestasVideo: (respuestasVideo || []).map((r: any) => { const { url_video, ...resto } = r; return resto }),
      preguntasVideo,
      progresoOperativo,
      resumenesIa,
      dictamenes
    })
  } catch (error: any) {
    console.error('Error cargando datos administrativos del panel:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos administrativos' }, { status: 500 })
  }
}