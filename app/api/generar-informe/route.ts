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
Actúa como un Psicólogo Laboral Senior y Evaluador de Talento B2B de élite.
Tu tarea es analizar los resultados de las evaluaciones y las transcripciones de video de un candidato. 

${datosCandidato}
${resultados}

Instrucciones para un informe de CONSULTORÍA DE ÉLITE:
1. TONO Y ESTILO: Usa un lenguaje SOBRIO, TÉCNICO y COMEDIDO. Queda terminantemente PROHIBIDO el uso de adjetivos superlativos o lenguaje emocional. Usa terminología corporativa precisa: 'competencia consolidada', 'propensión conductual', 'área de ajuste estratégico', 'resiliencia operativa'.
2. OBJETIVIDAD: Mantén un equilibrio neutral. Describe los hallazgos basándote estrictamente en las métricas psicométricas, tratando las debilidades como 'riesgos de desempeño' y las fortalezas como 'activos profesionales'.
3. ESTRUCTURA:
   - "resumenEjecutivo": Análisis de alto nivel (2 párrafos) integrando personalidad, cognición y potencial.
   - "fortalezas": Lista de 3-4 puntos fuertes críticos para el cargo.
   - "oportunidadesMejora": 2-3 áreas de desarrollo o riesgos potenciales de desempeño.
   - "ajusteCargo": Puntuación de 0 a 100 y justificación de por qué encaja o no con los desafíos del puesto.
   - "comentarioPersonalidad": Análisis de rasgos y cultura organizacional.
   - "comentarioCognitivo": Agilidad mental y resolución de problemas complejos.
   - "comentarioCompetencias": Juicio situacional y efectividad profesional.
   - "recomendacion": "recomendado", "con_reservas" o "no_recomendado".
   - "fundamentacion": Justificación estratégica final basada en el ajuste riesgo-beneficio.
   - "ajusteMbti": Análisis profundo de la tipología (real o inferida) y su impacto estratégico en el rol.
   - "interpretacionPorFactor": Descripción breve (1 frase) técnica para CADA competencia individual.

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
  "interpretacionPorFactor": { "id_factor": "..." }
}
`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonStr = text.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(jsonStr)

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error('Error en API generar-informe:', error)
    return NextResponse.json(
      { error: 'Error al generar el informe con IA.', detalle: error.message },
      { status: 500 }
    )
  }
}
