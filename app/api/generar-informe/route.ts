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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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
Actúa como un Psicólogo Laboral Senior y Evaluador de Talento B2B de élite.
Tu tarea es analizar los resultados de las evaluaciones y las transcripciones de video de un candidato. 

${datosCandidato}
${resultados}

Instrucciones para un informe de CONSULTORÍA DE ÉLITE:
1. TONO Y ESTILO: Usa un lenguaje PROFESIONAL, SOBRIO y SUTIL. Evita cualquier rastro de lenguaje publicitario o exagerado.
2. ELIMINACIÓN DE MAXIMALISMOS: No uses palabras que impliquen perfección o extremos.
3. ENFOQUE HUMANO-CONSULTOR: Escribe como si fueras un socio senior explicando a otro socio los matices del candidato.
4. ANÁLISIS DEL DISCURSO (CRÍTICO): Analiza la calidad narrativa en las transcripciones. Evalúa:
   - Coherencia y estructura de las ideas.
   - Vocabulario (¿Es técnico, es limitado, es adecuado para el nivel jerárquico?).
   - Seguridad y fluidez (deducida por la estructura de las frases).
   - Capacidad de síntesis vs. dispersión.
5. ESTRUCTURA Y CONTENIDO:
   - "resumenEjecutivo": 2 párrafos integrativos. Debe incluir un análisis del DISCURSO del candidato como evidencia de su profesionalismo.
   - "fortalezas": 3-4 puntos destacados con sobriedad. Incluye al menos una fortaleza comunicacional o discursiva.
   - "oportunidadesMejora": 2-3 áreas de riesgo redactadas con elegancia técnica.
   - "ajusteCargo": Puntuación (0-100) y análisis del encaje riesgo-beneficio basado en evidencias.
   - "comentarioPersonalidad": Propensiones conductuales y estilo relacional.
   - "comentarioCognitivo": Procesamiento de información y agilidad mental.
   - "comentarioCompetencias": Efectividad operativa y juicio profesional.
   - "recomendacion": "recomendado", "con_reservas" o "no_recomendado".
   - "fundamentacion": Argumentación técnica final. Debe ser comedida y equilibrada e integrar la evidencia del discurso en video.
   - "ajusteMbti": Análisis tipológico matizado.
   - "interpretacionPorFactor": Objeto que DEBE contener una descripción técnica de una frase para CADA factor recibido en los resultados (ej: "normas", "honestidad", "promedio_general", etc.). No omitas ninguno.
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
