import { NextResponse } from 'next/server'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

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
    const [{ data: candidato, error: errCand }, { data: proceso, error: errProc }, { data: sesiones, error: errSes }, { data: respuestasVideo, error: errVid }] = await Promise.all([
      db.from('candidatos').select('nombre, apellido').eq('id', candidatoId).maybeSingle(),
      db.from('procesos').select('nombre, cargo, bateria_tests').eq('id', procesoId).maybeSingle(),
      db.from('sesiones').select('test_id, estado').eq('candidato_id', candidatoId).eq('proceso_id', procesoId),
      db.from('respuestas_video').select('entrevista_id').eq('candidato_id', candidatoId)
    ])
    if (errCand) console.error('Error al cargar candidato:', errCand)
    if (errProc) console.error('Error al cargar proceso:', errProc)
    if (errSes) console.error('Error DB Sesiones:', errSes)
    if (errVid) console.error('Error DB Videos:', errVid)

    if (!candidato) return NextResponse.json({ error: `Candidato no encontrado en la base de datos (ID: ${candidatoId})` }, { status: 404 })
    if (!proceso) return NextResponse.json({ error: `Proceso de selección no encontrado (ID: ${procesoId})` }, { status: 404 })

    return NextResponse.json({ valid: true, candidato, proceso, sesiones: sesiones || [], respuestasVideo: respuestasVideo || [] })
  } catch (error) {
    console.error('Error validando enlace de evaluacion:', error)
    return NextResponse.json({ error: 'No se pudo validar el enlace de evaluacion' }, { status: 500 })
  }
}