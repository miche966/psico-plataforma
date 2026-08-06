import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAdminSession } from '@/lib/server/adminAuth'

const FRASES_ESTIMULO: Record<number, string> = {
  1: 'Siempre me gustó',
  2: 'Cuando me enfrento a varias opciones',
  3: 'Lo más importante en la vida es',
  4: 'Siempre me preocupó',
  5: 'Creo que soy hábil para',
  6: 'Lo más difícil para mí es',
  7: 'Controlarme es muy difícil para mí cuando',
  8: 'Cuando las cosas no se dan como yo esperaba',
  9: 'En un grupo yo',
  10: 'En el futuro me veo',
  11: 'Nunca imaginé que yo',
  12: 'Me fastidia',
  13: 'No sé explicar por qué todos dicen',
  14: 'No estoy de acuerdo',
  15: 'Me aburre',
  16: 'El mayor cambio de mi vida',
  17: 'Cuando me enfrento a un cambio',
  18: 'Este cargo significa para mí',
  19: 'Mis jefes',
  20: 'Me gusta trabajar con',
  21: 'Mi mayor desafío ha sido',
  22: 'En síntesis, yo'
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response

    const payload = await req.json()
    const { candidato, proceso, respuestas } = payload
    const respuestasEntries = Object.entries(respuestas || {})
    if (!respuestas || typeof respuestas !== 'object' || respuestasEntries.length > 50 || respuestasEntries.some(([, value]) => String(value ?? '').length > 3000)) {
      return NextResponse.json({ error: 'Las respuestas no tienen un formato o tamaño válido' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta la llave de API de Gemini.' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // Formatear las respuestas para el prompt
    let respuestasFormateadas = ''
    Object.entries(respuestas || {}).forEach(([idStr, respuesta]) => {
      const id = Number(idStr)
      const estimulo = FRASES_ESTIMULO[id] || `Frase ${id}`
      respuestasFormateadas += `${id}. ${estimulo}... ${respuesta}\n`
    })

    const prompt = `
Eres un Psicólogo Organizacional Senior experto en técnicas proyectivas de diagnóstico laboral (Frases Incompletas de Sacks/Rotter) y análisis del discurso.

Tu tarea es analizar las respuestas completadas por el candidato a una vacante laboral.

DATOS DEL PROCESO:
- Candidato: ${candidato?.nombre || 'No especificado'} ${candidato?.apellido || ''}
- Puesto al que postula: ${proceso?.cargo || 'No especificado'}
- Empresa/Proceso: ${proceso?.nombre || 'No especificado'}

FRASES COMPLETADAS POR EL CANDIDATO:
${respuestasFormateadas}

REALIZA EL ANÁLISIS SIGUIENDO ESTAS INSTRUCCIONES:

1. AUDITORÍA ORTOGRÁFICA:
   Analiza con extrema precisión la ortografía y redacción de cada una de las respuestas del candidato (las respuestas escritas a mano que completan la frase). Identifica cualquier error ortográfico, falta de tildes (acentuación), mal uso de letras (ej. s/c/z, b/v), o problemas sintácticos.
   Completa la lista detallada de errores indicando el número de frase, la palabra errónea original, la corrección sugerida y el tipo de error (ej: "Acentuación", "Grafía", "Sintaxis").

2. ANÁLISIS PSICOMÉTRICO CLÍNICO (Proyección):
   - dinamicaLaboral: Evalúa la toma de decisiones del candidato (¿es impulsivo, analítico, indeciso?), su motivación, estilo de trabajo y proyección de metas.
   - interpersonal: Evalúa su actitud ante la autoridad, su estilo de colaboración en equipos y sus habilidades diplomáticas de comunicación.
   - emocional: Evalúa su tolerancia a la frustración, su control de impulsos y su estabilidad ante situaciones de estrés o cambio.
   - autoconcepto: Evalúa su autoimagen (seguridad/inseguridad) y sus valores profesionales centrales.

3. CONCLUSIONES Y RECOMENDACIÓN:
   - Identifica fortalezas claras (mínimo 3) y áreas de atención/riesgo (mínimo 2).
   - Genera una recomendación de gestión útil para su futuro líder (cómo gestionarlo, qué motiva al perfil).
   - Proporciona un veredicto de ajuste final basado en las respuestas: "RECOMENDADO", "RECOMENDADO CON RESERVAS" o "NO RECOMIENDA".

REGLAS DE REDACCIÓN:
- Tono: Profesional, técnico pero humano, y descriptivo.
- Prohibido el uso de maximalismos ("total", "óptimo", "necesario") o juicios de valor. Habla de tendencias observadas.

Devuelve ÚNICAMENTE un objeto JSON estructurado con el siguiente formato:
{
  "analisisClinico": {
    "dinamicaLaboral": "Análisis descriptivo sobre toma de decisiones, metas y estilo de trabajo del candidato.",
    "interpersonal": "Análisis descriptivo sobre su relación con la autoridad y trabajo en equipo.",
    "emocional": "Análisis descriptivo sobre tolerancia al estrés, resiliencia y estabilidad emocional.",
    "autoconcepto": "Análisis descriptivo sobre su autoimagen y escala de valores."
  },
  "auditoriaOrtografica": {
    "tieneErrores": true, // o false si no hay ningún error ortográfico
    "conteoErrores": 0, // número entero total de errores encontrados
    "detalles": [
      { "frase": 1, "original": "palabra_con_error", "corregida": "palabra_corregida", "tipo": "Acentuación/Grafía/Sintaxis" }
    ]
  },
  "conclusion": {
    "fortalezas": ["Fortaleza 1", "Fortaleza 2", "Fortaleza 3"],
    "areasAtencion": ["Área de atención 1", "Área de atención 2"],
    "alertas": ["Alerta o riesgo (dejar vacío si no se aprecian alertas rojas)"],
    "recomendacionGestion": "Guía práctica para liderar a esta persona en el trabajo diario.",
    "veredicto": "RECOMENDADO / RECOMENDADO CON RESERVAS / NO RECOMENDADO"
  }
}
`

    let result = null
    let attempts = 0
    const maxAttempts = 3
    const apiCallStartTime = Date.now()

    console.log(`[INFO] [ANALISIS FRASES] Iniciando análisis para candidato: ${candidato?.nombre || 'No especificado'} ${candidato?.apellido || ''}`)

    while (attempts < maxAttempts) {
      try {
        attempts++
        console.log(`[INFO] [ANALISIS FRASES] Llamando a Gemini (Intento ${attempts}/${maxAttempts})...`)
        
        const model = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: {
            // 1200 arriesgaba corte con el thinking activo, y este endpoint no tiene fallback si
            // el JSON queda invalido (devuelve 500 directo, pudiendo trabar al candidato a mitad
            // del test de Frases Incompletas).
            maxOutputTokens: 3000,
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
        
        const callStart = Date.now()
        result = await model.generateContent(prompt)
        const callDuration = ((Date.now() - callStart) / 1000).toFixed(2)
        
        console.log(`[INFO] [ANALISIS FRASES] Intento ${attempts} exitoso en ${callDuration}s.`)
        break
      } catch (err: any) {
        console.error(`[WARNING] [ANALISIS FRASES] Error en intento ${attempts}:`, err.message || err)
        if (attempts >= maxAttempts) {
          throw err
        }
        const delay = Math.pow(2, attempts) * 1000
        console.log(`[INFO] [ANALISIS FRASES] Reintentando en ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    if (!result) {
      throw new Error('Fallo la llamada a la API de Gemini tras superar los reintentos máximos.')
    }

    const text = (await result.response).text()
    
    // Extraer y parsear el JSON de la respuesta de Gemini
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const resultado = JSON.parse(jsonMatch ? jsonMatch[0] : text)

    const totalDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2)
    console.log(`[INFO] [ANALISIS FRASES] Proceso completado exitosamente en ${totalDuration}s.`)

    return NextResponse.json(resultado)

  } catch (error: any) {
    console.error('[ANALISIS FRASES ERROR FATAL]:', error.message || error)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}
