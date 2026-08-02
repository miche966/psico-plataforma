import { NextResponse } from 'next/server'
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '@/lib/r2'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'

export async function POST(request: Request) {
  try {
    const { fileName, contentType, candidatoId, procesoId, entrevistaId, token } = await request.json()

    if (!fileName || !contentType || !candidatoId || !procesoId || !entrevistaId || !token) {
      return NextResponse.json({ error: 'Faltan parámetros de evaluación' }, { status: 400 })
    }

    if (!validarTokenEvaluacion(String(token), String(candidatoId), String(procesoId))) {
      return NextResponse.json({ error: 'Token de evaluación inválido o vencido' }, { status: 401 })
    }

    const expectedPrefix = `${entrevistaId}/${candidatoId}/`
    if (typeof fileName !== 'string' || !fileName.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Ruta de video no autorizada' }, { status: 403 })
    }

    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
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
