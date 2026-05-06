import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
  try {
    const { url_video, respuesta_id } = await req.json()

    if (!url_video || !respuesta_id) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // 1. Descargar el video desde la URL (o via Supabase SDK)
    const response = await fetch(url_video)
    const videoBuffer = await response.arrayBuffer()

    // 2. Preparar Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `
      Actúa como un experto en Reclutamiento y Selección de élite. 
      Analiza este video de un candidato respondiendo a una pregunta de entrevista.
      
      Instrucciones de Redacción:
      - Usa un tono PROFESIONAL y TÉCNICO.
      - Evita clichés y maximalismos (no uses "increíble", "excelente", etc. a menos que sea estrictamente necesario por la evidencia).
      - Describe la actitud de forma objetiva y conductual.
      
      Tareas:
      1. Transcribe con la mayor fidelidad posible lo que dice el candidato.
      2. Evalúa su actitud conductual (seguridad gestual, claridad narrativa, nivel de energía).
      3. Resume su respuesta en 3 puntos clave de valor organizacional.
      
      Devuelve el resultado EXCLUSIVAMENTE en formato JSON:
      {
        "transcripcion": "texto completo...",
        "actitud": "Análisis conductual sobrio y profesional...",
        "puntos_clave": ["punto 1", "punto 2", "punto 3"]
      }
    `

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: Buffer.from(videoBuffer).toString('base64'),
          mimeType: 'video/webm'
        }
      }
    ])

    const text = result.response.text()
    // Limpiar el posible formato markdown del JSON
    const jsonStr = text.replace(/```json|```/g, '').trim()
    const analisis = JSON.parse(jsonStr)

    // 3. Actualizar la base de datos
    const { error: updateError } = await supabase
      .from('respuestas_video')
      .update({
        transcripcion: analisis.transcripcion,
        analisis_ia: analisis
      })
      .eq('id', respuesta_id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, analisis })

  } catch (error: any) {
    console.error('Error en analizar-video:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
