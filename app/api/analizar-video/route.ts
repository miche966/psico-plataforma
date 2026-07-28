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

    const prompt = `
      Actúa como un experto en Reclutamiento y Selección de élite. 
      Analiza este video de un candidato respondiendo a una pregunta de entrevista.
      
      Instrucciones de Redacción:
      - Usa un tono PROFESIONAL y TÉCNICO para el análisis no verbal.
      - Evita clichés y maximalismos en todos los análisis.
      - Describe la actitud y el discurso de forma objetiva, humana y conductual.
      
      Tareas:
      - Transcribe con la mayor fidelidad posible lo que dice el candidato en la propiedad "transcripcion".
      - Evalúa su actitud conductual y expresión no verbal (contacto visual, gestos manuales, claridad vocal, nivel de energía, expresión facial) en la propiedad "actitud".
      - Analiza el contenido y fondo de su discurso basándote en la transcripción (su estrategia de resolución ante el problema planteado, el manejo de los límites de su rol, su vocabulario conceptual de servicio, etc.) en la propiedad "analisis_discurso". No utilices jergas de psicología clínica.
      - Resume su respuesta en 3 puntos clave de valor organizacional en la propiedad "puntos_clave".
      
      Devuelve el resultado EXCLUSIVAMENTE en formato JSON con la siguiente estructura:
      {
        "transcripcion": "texto completo...",
        "actitud": "Análisis conductual y corporal no verbal sobrio...",
        "analisis_discurso": "Análisis conceptual y de contenido de su discurso (qué ideas propone, cómo aborda el problema)...",
        "puntos_clave": ["punto 1", "punto 2", "punto 3"]
      }
    `

    // 2. Preparar y llamar a Gemini con reintentos
    let result = null
    let attempts = 0
    const maxAttempts = 3
    const apiCallStartTime = Date.now()

    console.log(`[INFO] [ANALIZAR VIDEO] Iniciando análisis de video para respuesta_id: ${respuesta_id}`)

    while (attempts < maxAttempts) {
      try {
        attempts++
        console.log(`[INFO] [ANALIZAR VIDEO] Llamando a Gemini (Intento ${attempts}/${maxAttempts})...`)
        
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            maxOutputTokens: 1000,
            responseMimeType: 'application/json'
          }
        })
        
        const callStart = Date.now()
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: Buffer.from(videoBuffer).toString('base64'),
              mimeType: 'video/webm'
            }
          }
        ])
        const callDuration = ((Date.now() - callStart) / 1000).toFixed(2)
        
        console.log(`[INFO] [ANALIZAR VIDEO] Intento ${attempts} exitoso en ${callDuration}s.`)
        break
      } catch (err: any) {
        console.error(`[WARNING] [ANALIZAR VIDEO] Error en intento ${attempts}:`, err.message || err)
        if (attempts >= maxAttempts) {
          throw err
        }
        const delay = Math.pow(2, attempts) * 1000
        console.log(`[INFO] [ANALIZAR VIDEO] Reintentando en ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    if (!result) {
      throw new Error('Fallo la llamada a la API de Gemini tras superar los reintentos máximos.')
    }

    const text = result.response.text()
    let jsonStr = text.replace(/```json|```/g, '').trim()
    
    // Extracción robusta del bloque JSON delimitado por llaves
    const firstBrace = jsonStr.indexOf('{')
    const lastBrace = jsonStr.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
    }
    
    const analisis = JSON.parse(jsonStr)

    const totalDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2)
    console.log(`[INFO] [ANALIZAR VIDEO] Análisis completado exitosamente en ${totalDuration}s para respuesta_id: ${respuesta_id}`)

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
