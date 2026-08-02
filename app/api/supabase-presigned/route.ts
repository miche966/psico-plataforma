import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'

export async function POST(request: Request) {
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta: Falta la variable SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    const { fileName, candidatoId, procesoId, entrevistaId, token } = await request.json()

    if (!fileName || !candidatoId || !procesoId || !entrevistaId || !token) {
      return NextResponse.json({ error: 'Faltan parámetros de evaluación' }, { status: 400 })
    }

    if (!validarTokenEvaluacion(String(token), String(candidatoId), String(procesoId))) {
      return NextResponse.json({ error: 'Token de evaluación inválido o vencido' }, { status: 401 })
    }

    const expectedPrefix = `${entrevistaId}/${candidatoId}/`
    if (!fileName.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Ruta de video no autorizada' }, { status: 403 })
    }

    const supabaseAdmin = createSupabaseAdmin()
    const { data, error } = await supabaseAdmin.storage
      .from('videos-entrevista')
      .createSignedUploadUrl(fileName)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      signedUrl: data.signedUrl, 
      token: data.token, 
      path: data.path 
    })
  } catch (error: any) {
    console.error('Error generando Supabase Signed Upload URL:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
