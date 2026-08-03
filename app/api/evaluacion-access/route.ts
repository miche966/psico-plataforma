import { NextResponse } from 'next/server'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { calcularProgresoEvaluacion } from '@/lib/progresoEvaluacion'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const candidatoId = String(body.candidato_id || '')
    const procesoId = String(body.proceso_id || '')
    const token = String(body.token || '')
    if (!candidatoId || !procesoId) {
      return NextResponse.json({ error: 'Enlace de evaluacion incompleto' }, { status: 400 })
    }
    if (token && !validarTokenEvaluacion(token, candidatoId, procesoId)) {
      return NextResponse.json({ error: 'El enlace de evaluacion es invalido o vencio' }, { status: 403 })
    }

    const db = createSupabaseAdmin()
    const [{ data: candidato, error: errCand }, { data: proceso, error: errProc }, { data: sesiones, error: errSes }] = await Promise.all([
      db.from('candidatos').select('nombre, apellido').eq('id', candidatoId).maybeSingle(),
      db.from('procesos').select('nombre, cargo, bateria_tests, activo').eq('id', procesoId).maybeSingle(),
      db.from('sesiones').select('test_id, estado').eq('candidato_id', candidatoId).eq('proceso_id', procesoId),
    ])
    if (errCand) console.error('Error al cargar candidato:', errCand)
    if (errProc) console.error('Error al cargar proceso:', errProc)
    if (errSes) console.error('Error DB Sesiones:', errSes)

    if (!candidato) return NextResponse.json({ error: `Candidato no encontrado en la base de datos (ID: ${candidatoId})` }, { status: 404 })
    if (!proceso) return NextResponse.json({ error: `Proceso de selección no encontrado (ID: ${procesoId})` }, { status: 404 })

    const bateria: string[] = proceso.bateria_tests || []
    const entrevistaIds = bateria
      .filter((t: string) => t.startsWith('entrevista:'))
      .map((t: string) => t.split(':')[1])

    let respuestasVideo: Array<{ entrevista_id: string, pregunta_id: string, estado: string }> = []
    let preguntasVideo: Array<{ id: string, entrevista_id: string }> = []
    if (entrevistaIds.length > 0) {
      const [{ data: rv, error: errVid }, { data: pv, error: errPv }] = await Promise.all([
        db.from('respuestas_video').select('entrevista_id, pregunta_id, estado').eq('candidato_id', candidatoId).in('entrevista_id', entrevistaIds),
        db.from('preguntas_video').select('id, entrevista_id').in('entrevista_id', entrevistaIds),
      ])
      if (errVid) console.error('Error DB Videos:', errVid)
      if (errPv) console.error('Error DB Preguntas Video:', errPv)
      respuestasVideo = rv || []
      preguntasVideo = pv || []
    }

    const preguntasPorEntrevista: Record<string, number> = {}
    preguntasVideo.forEach(p => {
      preguntasPorEntrevista[p.entrevista_id] = (preguntasPorEntrevista[p.entrevista_id] || 0) + 1
    })

    const progreso = calcularProgresoEvaluacion(bateria, sesiones || [], respuestasVideo, preguntasPorEntrevista)

    return NextResponse.json({ valid: true, candidato, proceso, progreso, sesiones: sesiones || [], respuestasVideo })
  } catch (error) {
    console.error('Error validando enlace de evaluacion:', error)
    return NextResponse.json({ error: 'No se pudo validar el enlace de evaluacion' }, { status: 500 })
  }
}