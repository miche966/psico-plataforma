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
1. TONO Y ESTILO: Usa un lenguaje PROFESIONAL, SOBRIO y SUTIL. Evita cualquier rastro de lenguaje publicitario o exagerado.
2. ELIMINACIÓN DE MAXIMALISMOS: No uses palabras que impliquen perfección o extremos.
   - EVITA: 'total dominio', 'impresionante', 'excepcional', 'perfecto', 'crítico', 'grave', 'excelente'.
   - USA: 'sólido', 'competencia desarrollada', 'consistencia en', 'área de riesgo', 'oportunidad de ajuste', 'tendencia a'.
3. ENFOQUE HUMANO-CONSULTOR: Escribe como si fueras un socio senior explicando a otro socio los matices del candidato. No listes atributos; explica propensiones conductuales de forma matizada.
4. ESTRUCTURA Y CONTENIDO:
   - "resumenEjecutivo": 2 párrafos integrativos. Usa conectores lógicos para explicar cómo la personalidad influye en la cognición. Evita clichés como 'el candidato ideal'.
   - "fortalezas": 3-4 puntos destacados con sobriedad. Explica el *valor* de la fortaleza sin usar superlativos.
   - "oportunidadesMejora": 2-3 áreas de riesgo redactadas con elegancia técnica y neutralidad, enfocándose en el impacto organizacional.
   - "ajusteCargo": Puntuación (0-100) y análisis del encaje riesgo-beneficio basado en evidencias.
   - "comentarioPersonalidad": Propensiones conductuales y estilo relacional.
   - "comentarioCognitivo": Procesamiento de información y agilidad mental.
   - "comentarioCompetencias": Efectividad operativa y juicio profesional.
   - "recomendacion": "recomendado", "con_reservas" o "no_recomendado".
   - "fundamentacion": Argumentación técnica final. Debe ser comedida y equilibrada.
   - "ajusteMbti": Análisis tipológico matizado.
   - "interpretacionPorFactor": Descripción técnica de una frase. EVITA adjetivos innecesarios. Sé directo y factual.
   - "liderazgo", "adaptabilidad", "resiliencia": Puntuaciones de 0 a 100 basadas en la integración de todos los datos (Personalidad, SJT y Video). Si no hay datos de personalidad, infiere basándote en las competencias situacionales y actitud en video.
   - MÉTRICAS DE FRAUDE: Si detectas un número inusual de cambios de pestaña o tiempo fuera de foco, menciónalo sutilmente en 'oportunidadesMejora' como una posible distracción o falta de foco, sin ser acusatorio.

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
