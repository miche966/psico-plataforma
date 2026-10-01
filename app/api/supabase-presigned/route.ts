import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { z, validar, rutaVideoSchema } from '@/lib/server/validacion'
import { mensajeParaCliente } from '@/lib/server/mensajesError'

const subidaSchema = z.object({
  fileName: rutaVideoSchema,
  candidatoId: z.guid(),
  procesoId: z.guid(),
  entrevistaId: z.guid(),
  token: z.string().min(1).max(2048),
})

export async function POST(request: Request) {
  try {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta: Falta la variable SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const campos = validar(subidaSchema, body, 'Faltan parámetros de evaluación')
    if (!campos.ok) return campos.response
    const { fileName, candidatoId, procesoId, entrevistaId, token } = campos.data

    if (!validarTokenEvaluacion(token, candidatoId, procesoId)) {
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
      console.error('Error creando la URL firmada de Supabase Storage:', error)
      return NextResponse.json({ error: mensajeParaCliente(error, 'No se pudo preparar la subida del video.') }, { status: 500 })
    }

    return NextResponse.json({ 
      signedUrl: data.signedUrl, 
      token: data.token, 
      path: data.path 
    })
  } catch (error: any) {
    console.error('Error generando Supabase Signed Upload URL:', error)
    return NextResponse.json({ error: mensajeParaCliente(error, 'No se pudo preparar la subida del video.') }, { status: 500 })
  }
}
