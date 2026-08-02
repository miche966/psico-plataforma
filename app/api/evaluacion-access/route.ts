import { NextResponse } from 'next/server'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const candidatoId = String(body.candidato_id || '')
    const procesoId = String(body.proceso_id || '')
    const token = String(body.token || '')
    if (!candidatoId || !procesoId || !token) {
      return NextResponse.json({ error: 'Enlace de evaluacion incompleto' }, { status: 400 })
    }
    if (!validarTokenEvaluacion(token, candidatoId, procesoId)) {
      return NextResponse.json({ error: 'El enlace de evaluacion es invalido o vencio' }, { status: 403 })
    }
    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('Error validando enlace de evaluacion:', error)
    return NextResponse.json({ error: 'No se pudo validar el enlace de evaluacion' }, { status: 500 })
  }
}