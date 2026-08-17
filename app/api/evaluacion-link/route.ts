import { NextResponse } from 'next/server'
import { generarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'

export async function POST(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const bloqueado = requireFullAdmin(auth)
    if (bloqueado) return bloqueado

    const body = await req.json()
    const candidatoId = String(body.candidato_id || '')
    const procesoId = String(body.proceso_id || '')
    const ruta = String(body.ruta || '/evaluacion')
    if (!candidatoId || !procesoId) {
      return NextResponse.json({ error: 'Candidato y proceso son obligatorios' }, { status: 400 })
    }
    if (!ruta.startsWith('/')) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin
    const token = generarTokenEvaluacion(candidatoId, procesoId)
    const separador = ruta.includes('?') ? '&' : '?'
    const evaluacionParam = ruta === '/evaluacion' ? '' : '&evaluacion=1'
    const link = `${baseUrl.replace(/\/$/, '')}${ruta}${separador}candidato=${encodeURIComponent(candidatoId)}&proceso=${encodeURIComponent(procesoId)}&token=${encodeURIComponent(token)}${evaluacionParam}`
    return NextResponse.json({ link })
  } catch (error) {
    console.error('Error generando enlace de evaluacion:', error)
    return NextResponse.json({ error: 'No se pudo generar el enlace de evaluacion' }, { status: 500 })
  }
}