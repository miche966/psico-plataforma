import { NextResponse } from 'next/server'
import { HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2'
import { claveDeUrlVideo } from '@/lib/server/firmarVideos'
import { claveVideoPerteneceA } from '@/lib/server/urlsVideo'
import { z, validar, lenient, textoLeniente, numeroLeniente } from '@/lib/server/validacion'

// Los metadatos de un error de subida solo se guardan para diagnostico: se conservan las claves que
// el cliente realmente manda y se descarta cualquier otra (antes era JSON arbitrario sin limite
// dentro de una columna jsonb).
const extraDataSchema = z.object({
  blobSize: z.number().optional(),
  blobType: z.string().max(100).optional(),
  chunksCount: z.number().optional(),
  userAgent: z.string().max(500).optional(),
})

const guardarRespuestaSchema = z.object({
  entrevistaId: z.guid(),
  preguntaId: z.guid(),
  duracion: numeroLeniente(0, 36000),
  exito: lenient(Boolean),
  urlVideo: textoLeniente(2048),
  fileName: textoLeniente(512),
  logs: textoLeniente(5000),
  extraData: lenient(v => {
    const r = extraDataSchema.safeParse(v)
    return r.success ? r.data : {}
  }),
})

// Mismo limite que ya tiene configurado el bucket de Supabase Storage (videos-entrevista,
// file_size_limit=52428800) -- se replica aca para que R2 (la vía primaria) sea consistente con el
// fallback. Un video legitimo (bitrate throttleado a ~1.26 Mbps, cortado por tiempo_respuesta de
// cada pregunta) nunca deberia acercarse a esto.
const TAMANO_MAXIMO_VIDEO = 50 * 1024 * 1024

// Verifica tamaño/tipo del objeto ya subido a R2 antes de darlo por valido. No se puede restringir
// esto en la propia URL firmada (PutObjectCommand no soporta condiciones de tamaño como un
// presigned POST), asi que se chequea despues de subido y se borra si no pasa.
async function validarVideoR2(fileName: string): Promise<boolean> {
  try {
    const head = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: fileName }))
    const tamanoOk = typeof head.ContentLength === 'number' && head.ContentLength > 0 && head.ContentLength <= TAMANO_MAXIMO_VIDEO
    const tipoOk = head.ContentType === 'video/webm'
    if (tamanoOk && tipoOk) return true
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: fileName }))
    return false
  } catch (err) {
    // Igual que el resto de las capas de seguridad secundarias de esta plataforma (rate limiting):
    // si R2 no responde al HEAD, se deja pasar en vez de perder la respuesta del candidato por una
    // falla transitoria de un servicio de terceros.
    console.error('[entrevista-video/candidato] Error validando video en R2, se deja pasar:', err)
    return true
  }
}

// Los tres parámetros son obligatorios: antes, si faltaba CUALQUIERA de los tres (no los tres
// juntos), la función devolvía "válido" por error -- alcanzaba con omitir el token para saltarse
// la validación por completo en guardar_respuesta (escritura sin autenticación real). El único
// llamador real (app/entrevista-video/responder/page.tsx) siempre manda los tres juntos.
function tokenValido(candidatoId: string, procesoId: string, token: string) {
  if (!candidatoId || !procesoId || !token) return false
  return validarTokenEvaluacion(token, candidatoId, procesoId)
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const entrevistaId = url.searchParams.get('entrevista') || ''
    const candidatoId = url.searchParams.get('candidato') || ''
    const procesoId = url.searchParams.get('proceso') || ''
    const token = url.searchParams.get('token') || ''

    if (!entrevistaId) return NextResponse.json({ error: 'Falta id de entrevista' }, { status: 400 })
    if (!tokenValido(candidatoId, procesoId, token)) {
      return NextResponse.json({ error: 'Enlace de evaluación inválido o vencido' }, { status: 401 })
    }

    const db = createSupabaseAdmin()
    const [{ data: entrevista, error: entrevistaError }, { data: preguntas, error: preguntasError }] = await Promise.all([
      db.from('entrevistas_video').select('*').eq('id', entrevistaId).single(),
      db.from('preguntas_video').select('*').eq('entrevista_id', entrevistaId).order('orden')
    ])
    if (entrevistaError) throw entrevistaError
    if (preguntasError) throw preguntasError

    let candidato = null
    let preguntasYaRespondidas: string[] = []
    if (candidatoId) {
      const [{ data: cand }, { data: respondidas }] = await Promise.all([
        db.from('candidatos').select('nombre, apellido').eq('id', candidatoId).single(),
        db.from('respuestas_video').select('pregunta_id').eq('candidato_id', candidatoId).eq('entrevista_id', entrevistaId).eq('estado', 'completado'),
      ])
      candidato = cand
      preguntasYaRespondidas = (respondidas || []).map(r => r.pregunta_id)
    }

    return NextResponse.json({ entrevista, preguntas: preguntas || [], candidato, preguntasYaRespondidas })
  } catch (error) {
    console.error('[entrevista-video/candidato GET]', error)
    return NextResponse.json({ error: 'No se pudo cargar la entrevista' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const candidatoId = String(body.candidatoId || '')
    const procesoId = String(body.procesoId || '')
    const token = String(body.token || '')

    if (!tokenValido(candidatoId, procesoId, token)) {
      return NextResponse.json({ error: 'Enlace de evaluación inválido o vencido' }, { status: 401 })
    }

    if (action === 'guardar_respuesta') {
      const campos = validar(guardarRespuestaSchema, body, 'Faltan parámetros')
      if (!campos.ok) return campos.response
      const { entrevistaId, preguntaId, duracion, exito, urlVideo, fileName, logs, extraData } = campos.data

      const db = createSupabaseAdmin()

      // Antes de insertar, se borra cualquier fila previa de esta misma (candidato, entrevista,
      // pregunta): sin esto, un reintento tras un error de subida o un candidato respondiendo de
      // nuevo la misma pregunta dejaba filas viejas huérfanas en vez de reemplazarlas (confirmado
      // en auditoria: 87 grupos duplicados, 130 filas de más, afectando conteos de progreso).
      if (candidatoId) {
        await db.from('respuestas_video')
          .delete()
          .eq('candidato_id', candidatoId)
          .eq('entrevista_id', entrevistaId)
          .eq('pregunta_id', preguntaId)
      }

      if (exito) {
        // La URL debe ser de nuestros almacenes y su clave de ESTA entrevista y ESTE candidato. Antes se
        // guardaba cualquier texto, asi que con un token valido se podia apuntar la fila al video de otra
        // persona (y leer su transcripcion), y se podia borrar un video ajeno haciendolo fallar el HEAD de
        // R2 con un fileName ajeno. fileName ya no se usa: la clave sale de la propia URL.
        const ref = claveDeUrlVideo(urlVideo)
        let valido = Boolean(ref) && claveVideoPerteneceA(ref!.clave, entrevistaId, candidatoId)
        if (valido && ref!.origen === 'r2') {
          valido = await validarVideoR2(ref!.clave)
        }

        const { data, error } = await db.from('respuestas_video').insert({
          pregunta_id: preguntaId,
          candidato_id: candidatoId || null,
          entrevista_id: entrevistaId,
          url_video: valido ? urlVideo : null,
          duracion,
          estado: valido ? 'completado' : 'error_upload',
          ...(valido ? {} : { transcripcion: 'El video subido no paso la validacion (ubicacion, tamano o tipo)' })
        }).select('id').single()
        if (error) throw error
        return NextResponse.json({ respuesta: data })
      }

      const { error } = await db.from('respuestas_video').insert({
        pregunta_id: preguntaId,
        candidato_id: candidatoId || null,
        entrevista_id: entrevistaId,
        url_video: null,
        duracion,
        estado: 'error_upload',
        transcripcion: logs,
        analisis: extraData
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error) {
    console.error('[entrevista-video/candidato POST]', error)
    return NextResponse.json({ error: 'No se pudo guardar la respuesta' }, { status: 500 })
  }
}
