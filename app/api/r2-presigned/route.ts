import { NextResponse } from 'next/server'
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '@/lib/r2'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { z, validar, rutaVideoSchema } from '@/lib/server/validacion'

const subidaSchema = z.object({
  fileName: rutaVideoSchema,
  contentType: z.string().max(100),
  candidatoId: z.guid(),
  procesoId: z.guid(),
  entrevistaId: z.guid(),
  token: z.string().min(1).max(2048),
})

// El cliente (app/entrevista-video/responder/page.tsx) siempre graba y sube con este único tipo --
// cualquier otro valor es una solicitud armada a mano contra el endpoint, no un candidato real.
const CONTENT_TYPES_PERMITIDOS = ['video/webm']

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const campos = validar(subidaSchema, body, 'Faltan parámetros de evaluación')
    if (!campos.ok) return campos.response
    const { fileName, contentType, candidatoId, procesoId, entrevistaId, token } = campos.data

    if (!CONTENT_TYPES_PERMITIDOS.includes(contentType)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    if (!validarTokenEvaluacion(token, candidatoId, procesoId)) {
      return NextResponse.json({ error: 'Token de evaluación inválido o vencido' }, { status: 401 })
    }

    const expectedPrefix = `${entrevistaId}/${candidatoId}/`
    if (!fileName.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Ruta de video no autorizada' }, { status: 403 })
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      ContentType: contentType,
    })

    // URL válida por 15 minutos
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 })

    const publicUrl = `${R2_PUBLIC_URL}/${fileName}`

    return NextResponse.json({ signedUrl, publicUrl })
  } catch (error: any) {
    console.error('Error generando Presigned URL:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
