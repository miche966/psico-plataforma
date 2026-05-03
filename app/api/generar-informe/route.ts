import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function POST(req: Request) {
  try {
    const { candidato, proceso, sesiones, hasP, hasC, hasK } = await req.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'La llave de API de Gemini no está configurada en .env.local' },
        { status: 500 }
      )
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

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
      resultados += `\nEvaluación #${idx + 1}:\n`
      Object.entries(s.puntaje_bruto || {}).forEach(([key, val]) => {
        resultados += `- ${key}: ${val}\n`
      })
    })

    const prompt = `
Actúa como un Psicólogo Laboral Senior y Evaluador de Talento B2B.
Tu tarea es analizar los resultados de las evaluaciones psicométricas de un candidato y redactar resúmenes profesionales, directos y basados exclusivamente en la evidencia de los puntajes proporcionados.

${datosCandidato}
${resultados}

Instrucciones:
1. "resumenEjecutivo": Debe ser un párrafo de 3 a 5 oraciones que resuma el perfil del candidato, sus mayores fortalezas y sus áreas de atención o desarrollo, indicando si hace un buen "fit" (ajuste) con el puesto solicitado (si hay uno).
2. "comentarioPersonalidad": Solo si el candidato tomó pruebas de personalidad (Big Five o HEXACO). Un párrafo de 2 a 4 oraciones analizando las implicancias de sus rasgos de personalidad en el entorno laboral. Si no tomó, devuelve "".
3. "comentarioCognitivo": Solo si el candidato tomó pruebas cognitivas (ítems como "correctas", "total"). Un párrafo de 2 a 3 oraciones evaluando su capacidad de razonamiento numérico, lógico o verbal según sus aciertos. Si no tomó, devuelve "".
4. "comentarioCompetencias": Solo si el candidato tomó pruebas de Situational Judgment Tests (SJT) o competencias. Un párrafo evaluando su juicio situacional o desempeño en las competencias medidas. Si no tomó, devuelve "".
5. "recomendacion": Basado en el perfil general, decide una recomendación de contratación. DEBE ser estrictamente uno de estos tres valores: "recomendado", "con_reservas" o "no_recomendado".
6. "fundamentacion": Un párrafo de 2 a 3 oraciones que justifique la decisión de recomendación, mencionando por qué el candidato es idóneo, qué reservas existen, o por qué no se recomienda.
7. "ajusteMbti": Solo si hay información de cargo y prueba de personalidad. Un breve párrafo (1 o 2 oraciones) indicando cómo el perfil de personalidad del candidato se alinea específicamente con las funciones del cargo. Si no aplica, devuelve "".

La respuesta DEBE ser EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura, sin formato markdown de bloques de código y sin texto adicional antes o después:

{
  "resumenEjecutivo": "texto aquí",
  "comentarioPersonalidad": "texto aquí",
  "comentarioCognitivo": "texto aquí",
  "comentarioCompetencias": "texto aquí",
  "recomendacion": "recomendado",
  "fundamentacion": "texto aquí",
  "ajusteMbti": "texto aquí"
}
`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2, // Baja temperatura para que sea analítico y consistente
        responseMimeType: "application/json",
      }
    })

    const textoRespuesta = response.text
    if (!textoRespuesta) {
      throw new Error('No se recibió respuesta del modelo.')
    }

    const resultado = JSON.parse(textoRespuesta)

    return NextResponse.json(resultado)
  } catch (error: any) {
    console.error('Error en API generar-informe:', error)
    return NextResponse.json(
      { error: 'Error al generar el informe con IA.', detalle: error.message },
      { status: 500 }
    )
  }
}
