import { NextResponse } from 'next/server'
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'

export async function POST(request: Request) {
  try {
    const { fileName, contentType } = await request.json()

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
