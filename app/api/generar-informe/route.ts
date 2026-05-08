import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const { candidato, proceso, sesiones, hasP, hasC, hasK } = await req.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'La llave de API de Gemini no está configurada en .env.local' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Preparar el prompt con toda la información disponible
    let datosCandidato = `Candidato: ${candidato.nombre} ${candidato.apellido}\n`
    if (proceso) {
      datosCandidato += `Proceso al que postula: ${proceso.nombre}\n`
      datosCandidato += `Cargo: ${proceso.cargo}\n`
      if (proceso.descripcion_cargo) {
        datosCandidato += `Descripción del cargo: ${proceso.descripcion_cargo}\n`
      }
    }

    let resultados = '--- RESULTADOS DE LAS EVALUACIONES ---\n'
    sesiones.forEach((s: any, idx: number) => {
      resultados += `\nEvaluación #${idx + 1} (Test ID: ${s.test_id || 'Psicométrico'}):\n`
      // Aplanamos datos para que la IA los vea bien
      const data = (s.puntaje_bruto?.por_factor as Record<string, any>) || s.puntaje_bruto || {};
      Object.entries(data).forEach(([key, val]) => {
        if (typeof val === 'object' && val !== null && 'correctas' in val) {
          resultados += `- ${key}: ${(val as any).correctas}/${(val as any).total || 5}\n`
        } else {
          resultados += `- ${key}: ${val}\n`
        }
      })
      if (s.transcripcion) {
        resultados += `Transcripción de Video: "${s.transcripcion}"\n`
      }
    })

    const prompt = `
Actúa como un Líder de Talento con mucha experiencia, alguien que sabe leer a las personas y lo explica de forma sencilla, cercana y humana.
Tu tarea es analizar los resultados de las evaluaciones y las transcripciones de video de un candidato.

${datosCandidato}
${resultados}

Instrucciones de Redacción (CRÍTICAS):
1. TONO HUMANO Y CERCANO: Escribe de forma natural, como si me estuvieras contando sobre el candidato en un café. Evita sonar como un informe técnico o una IA.
2. SIN TERMINOLOGÍA TÉCNICA: Prohibido usar palabras como "neuroticismo", "extraversión", "apertura", "mbti", "percentiles" o nombres de tests específicos (DASS-21, etc.). Traduce todo a lenguaje común (ej: "su forma de relacionarse", "cómo maneja el estrés", "su capacidad de aprendizaje").
3. CERO MAXIMALISMOS: No uses palabras exageradas como "excepcional", "extraordinario", "perfecto", "impecable" o "insuperable". Usa términos realistas y matizados como "buen desempeño", "adecuado", "fluido", "consistente".
4. ANÁLISIS DEL DISCURSO: Fíjate en cómo habla en el video. ¿Es claro al expresarse? ¿Se nota seguro? ¿Tiene un vocabulario acorde al puesto? Cuéntamelo con palabras simples.
5. ENFOQUE EN MATICES: No busques la perfección. Busca entender qué es lo que mejor hace y dónde podría tener dificultades, explicándolo con empatía.
6. ESTRUCTURA:
   - "resumenEjecutivo": 2 párrafos cortos y directos que me digan quién es esta persona.
   - "fortalezas": 3 puntos claros en lenguaje cotidiano.
   - "oportunidadesMejora": 2 puntos de cuidado explicados con sutileza y realismo.
   - "ajusteCargo": Puntuación (0-100) y un comentario breve de por qué encaja o no.
   - "comentarioPersonalidad": Cómo es su carácter y forma de ser.
   - "comentarioCognitivo": Cómo piensa y resuelve problemas en el día a día.
   - "comentarioCompetencias": Qué tan efectivo es trabajando.
   - "recomendacion": "recomendado", "con_reservas" o "no_recomendado".
   - "fundamentacion": El porqué final de tu decisión, explicado de forma clara y sin vueltas.
   - "ajusteMbti": No menciones letras (como ENFJ). Explica su estilo de personalidad de forma descriptiva.
   - "interpretacionPorFactor": Objeto con una frase CERCANA para cada factor recibido.
   - "liderazgo", "adaptabilidad", "resiliencia": Puntuaciones de 0 a 100.
   - MÉTRICAS DE FRAUDE: Menciónalo sutilmente en 'oportunidadesMejora' si aplica.
   - RESULTADOS CLÍNICOS (DASS-21): Si aplica, incluye 'ALERTAS DE BIENESTAR'.

Devuelve EXCLUSIVAMENTE un JSON válido:
{
  "resumenEjecutivo": "...",
  "fortalezas": ["...", "..."],
  "oportunidadesMejora": ["...", "..."],
  "ajusteCargo": { "score": 85, "analisis": "..." },
  "comentarioPersonalidad": "...",
  "comentarioCognitivo": "...",
  "comentarioCompetencias": "...",
  "recomendacion": "...",
  "fundamentacion": "...",
  "ajusteMbti": "...",
  "interpretacionPorFactor": { "id_factor": "..." },
  "liderazgo": 85,
  "adaptabilidad": 90,
  "resiliencia": 80
}
`

    console.log(`[AUDITORÍA IA] Iniciando generación para: ${candidato.nombre} ${candidato.apellido}`)
    console.log(`[AUDITORÍA IA] Factores enviados:`, sesiones.map((s: any) => Object.keys(s.puntaje_bruto?.por_factor || s.puntaje_bruto || {})).flat())

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    
    // Log de la respuesta cruda para detectar truncamientos o errores de formato
    console.log(`[AUDITORÍA IA] Respuesta cruda recibida (primeros 500 chars):`, text.slice(0, 500))

    const jsonStr = text.replace(/```json|```/g, '').trim()
    let resultado: any;
    
    try {
      resultado = JSON.parse(jsonStr)
    } catch (parseError: any) {
      console.error(`[CRÍTICO] Error de parseo JSON de la IA. Contenido:`, jsonStr)
      throw new Error(`La IA devolvió un formato inválido: ${parseError.message}`)
    }

    // Validación de Integridad: ¿Están todos los factores?
    const factoresEnviados = sesiones.flatMap((s: any) => Object.keys(s.puntaje_bruto?.por_factor || s.puntaje_bruto || {}))
      .filter(f => f !== 'total' && f !== 'porcentaje' && f !== 'por_factor')
    
    const factoresRecibidos = Object.keys(resultado.interpretacionPorFactor || {})
    const faltantes = factoresEnviados.filter(f => !factoresRecibidos.includes(f.toLowerCase()))

    if (faltantes.length > 0) {
      console.warn(`[ADVERTENCIA IA] Factores omitidos por la IA:`, faltantes)
    } else {
      console.log(`[AUDITORÍA IA] Todos los factores (${factoresRecibidos.length}) fueron interpretados correctamente.`)
    }

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error('--- ERROR EN MOTOR DE INFORME IA ---')
    console.error('Mensaje:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      { error: 'Error al generar el informe con IA.', detalle: error.message },
      { status: 500 }
    )
  }
}
