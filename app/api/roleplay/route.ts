import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `
Actúas como Carlos Gómez, un cliente de microfinanzas con un microcrédito comercial atrasado 45 días por un monto de $35,000 pesos uruguayos.
Tu negocio es un pequeño almacén de barrio. Tuviste problemas de liquidez porque se te rompió una heladera comercial de fiambres y tuviste que costear la reparación con la plata de la cuota.

INSTRUCCIONES DE COMPORTAMIENTO:
1. Tono y Personalidad:
   - Al principio estás a la defensiva, un poco frustrado, evasivo y preocupado por tu negocio.
   - Habla en español rioplatense/uruguayo de manera informal y cotidiana (ej. usa palabras como "mirá", "che", "complicado", "pesos", "laburo", "plata", "cuota", "boleta").
   - No uses palabras técnicas de finanzas; habla como un comerciante común que está pasando un mal momento.
   - Tus respuestas deben ser cortas (1 a 3 oraciones como máximo) y naturales para simular una llamada telefónica fluida de voz.
2. Criterio de Negociación:
   - No aceptes pagar todo mañana de inmediato. Di que no tenés la plata junta.
   - Si el analista (candidato) es empático, te escucha de forma comprensiva y te propone una alternativa flexible (como pagar la mitad la semana que viene y refinanciar el saldo), muéstrate más cooperativo y accede.
   - Si el analista es frío, amenazante con el clearing de informes, o te interrumpe, ponte hostil y dile que vas a colgar la llamada si sigue con ese tono.

3. INSTRUCCIÓN DE SALIDA OBLIGATORIA:
   Debes responder ÚNICAMENTE con un objeto JSON con el siguiente formato, sin agregar explicaciones fuera del JSON:
   {
     "respuesta": "La frase o respuesta hablada que le dirás al candidato.",
     "cooperacion": 40, // Un número entero de 0 a 100 indicando tu nivel de cooperación actual (comienza en 20, sube si es empático, baja si es agresivo).
     "desviado": false // true si el candidato se desvió del tema de la cobranza o te preguntó cosas absurdas ajenas a la conversación.
   }
`

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const { action, mensajes, nuevoMensaje, candidatoId, procesoId, testId, latenciaPromedio, turnosTotales } = payload

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta la llave de API de Gemini.' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // ACCIÓN 1: CONTINUACIÓN DE CHAT EN TIEMPO REAL
    if (action === 'chat') {
      const history = (mensajes || []).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.role === 'user' ? m.content : JSON.stringify({ respuesta: m.content }) }]
      }))

      const chat = model.startChat({
        history,
        systemInstruction: SYSTEM_PROMPT
      })

      const result = await chat.sendMessage(nuevoMensaje)
      const responseText = result.response.text()

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText)
        return NextResponse.json(parsed)
      } catch (e) {
        // Fallback por si la IA no retorna JSON válido
        return NextResponse.json({
          respuesta: responseText,
          cooperacion: 50,
          desviado: false
        })
      }
    }

    // ACCIÓN 2: EVALUACIÓN FINAL DE LA TRANSCRIPCIÓN
    if (action === 'evaluar') {
      if (!candidatoId || !procesoId || !testId) {
        return NextResponse.json({ error: 'Faltan parámetros requeridos para guardar la sesión.' }, { status: 400 })
      }

      const transcripcion = (mensajes || []).map((m: any) => {
        const remitente = m.role === 'user' ? 'Analista (Candidato)' : 'Cliente (Carlos Gómez)'
        return `${remitente}: ${m.content}`
      }).join('\n')

      const evalPrompt = `
Eres un Evaluador Psicométrico de Recursos Humanos experto en People Analytics, cobranzas y selección de personal.
Tu tarea es analizar la transcripción de una llamada de Role Play simulada entre un candidato (Analista de Cobranzas) y el cliente Carlos Gómez.

TRANSCRIPCIÓN DE LA LLAMADA:
${transcripcion}

Evalúa al candidato en las siguientes 4 dimensiones críticas de desempeño, otorgando un puntaje de 0 a 100 para cada una:
1. empatia: Capacidad de escuchar, validar las dificultades del cliente y no mostrarse confrontativo de inmediato.
2. manejoObjeciones: Habilidad para rebatir las quejas del cliente con argumentos constructivos y buscar alternativas sin perder de vista la cobranza.
3. resolucionConflicto: Capacidad de llegar a un acuerdo o compromiso de pago viable en lugar de dejar la llamada inconclusa.
4. adherenciaProtocolo: Uso de un lenguaje formal pero cercano, presentarse al inicio y mantener el profesionalismo durante toda la llamada.

Devuelve ÚNICAMENTE un objeto JSON estructurado con el siguiente formato:
{
  "empatia": 85,
  "manejoObjeciones": 70,
  "resolucionConflicto": 90,
  "adherenciaProtocolo": 80,
  "retroalimentacion": "Resumen de fortalezas y áreas de mejora observadas durante la llamada en 3 oraciones.",
  "acuerdoAlcanzado": true
}
`

      const evalResult = await model.generateContent(evalPrompt)
      const evalText = evalResult.response.text()
      
      const jsonMatch = evalText.match(/\{[\s\S]*\}/)
      const parseado = JSON.parse(jsonMatch ? jsonMatch[0] : evalText)

      // Guardar el resultado en Supabase
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

      // 1. Buscar si existe la sesión en progreso
      const { data: sesionExistente } = await supabaseAdmin
        .from('sesiones')
        .select('id')
        .eq('candidato_id', candidatoId)
        .eq('proceso_id', procesoId)
        .eq('test_id', testId)
        .single()

      // Extraer la curva de cooperación si viene en los mensajes o si se calcula de forma implícita
      const curvaCooperacion = (mensajes || [])
        .filter((m: any) => m.role === 'model' && typeof m.cooperacion === 'number')
        .map((m: any) => m.cooperacion)

      const puntajeBruto = {
        por_factor: {
          'Empatía y Escucha': parseado.empatia,
          'Manejo de Objeciones': parseado.manejoObjeciones,
          'Resolución de Conflictos': parseado.resolucionConflicto,
          'Adherencia a Protocolo': parseado.adherenceProtocolo || parseado.adherenciaProtocolo,
        },
        transcripcion: mensajes,
        retroalimentacion: parseado.retroalimentacion,
        acuerdo_alcanzado: parseado.acuerdoAlcanzado,
        latencia_promedio: latenciaPromedio || null,
        turnos_empleados: turnosTotales || mensajes.length / 2,
        curva_cooperacion: curvaCooperacion.length > 0 ? curvaCooperacion : [20, 40, 60, 80]
      }

      if (sesionExistente) {
        // Actualizar sesión existente
        await supabaseAdmin
          .from('sesiones')
          .update({
            estado: 'finalizado',
            finalizada_en: new Date().toISOString(),
            puntaje_bruto: puntajeBruto
          })
          .eq('id', sesionExistente.id)
      } else {
        // Crear nueva sesión finalizada
        await supabaseAdmin
          .from('sesiones')
          .insert({
            candidato_id: candidatoId,
            proceso_id: procesoId,
            test_id: testId,
            estado: 'finalizado',
            finalizada_en: new Date().toISOString(),
            puntaje_bruto: puntajeBruto
          })
      }

      return NextResponse.json({ success: true, evaluacion: parseado })
    }

    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })

  } catch (error: any) {
    console.error('[API ROLEPLAY ERROR]:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
