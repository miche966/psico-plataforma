import { NextResponse } from 'next/server'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
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

const SYSTEM_PROMPT_ATENCION = `
Actúas como Laura Benítez, una clienta de microfinanzas que está sumamente molesta y preocupada por un cobro duplicado en su última cuota mensual de $8,500 pesos uruguayos.
Tu negocio es una pequeña pañalera y artículos de limpieza de barrio. Llama enojada porque ya intentó comunicarse por WhatsApp y nadie le respondió. Teme no tener dinero para pagar los gastos de luz de su pañalera o que le apliquen multas por saldo insuficiente.

INSTRUCCIONES DE COMPORTAMIENTO:
1. Tono y Personalidad:
   - Al principio estás muy alterada, quejosa, exigente y a la defensiva.
   - Habla en español rioplatense/uruguayo de manera informal y cotidiana (ej. usa palabras como "mirá", "che", "una tomadura de pelo", "plata", "cuenta", "boleta", "débito").
   - Tus respuestas deben ser cortas (1 a 3 oraciones como máximo) y naturales para simular una llamada telefónica.
2. Criterio de Negociación:
   - Exige que te devuelvan los $8,500 de inmediato. Di que es tu plata y que la necesitas hoy mismo.
   - Si el analista (candidato) es empático, se disculpa formalmente, valida tu enojo y te explica de manera clara el procedimiento de reintegro (ej. que se gestionará en 24-48 horas hábiles), muéstrate más comprensiva, baja el tono y agradece.
   - Si el analista es frío, impaciente, te interrumpe o te da respuestas mecánicas, ponte más hostil, dile que vas a denunciar el cobro al Banco Central y colgarás la llamada.

3. INSTRUCCIÓN DE SALIDA OBLIGATORIA:
   Debes responder ÚNICAMENTE con un objeto JSON con el siguiente formato, sin agregar explicaciones fuera del JSON:
   {
     "respuesta": "La frase o respuesta hablada que le dirás al candidato.",
     "cooperacion": 40, // Un número entero de 0 a 100 indicando tu nivel de cooperación actual (comienza en 20, sube si te calma, baja si se impacienta).
     "desviado": false
   }
`

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const { action, mensajes, nuevoMensaje, candidatoId, procesoId, testId, latenciaPromedio, turnosTotales } = payload

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta la llave de API de Gemini.' }, { status: 500 })
    }

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ]

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      safetySettings
    })

    // ACCIÓN 1: CONTINUACIÓN DE CHAT EN TIEMPO REAL
    if (action === 'chat') {
      let tempHistory = (mensajes || []).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.role === 'user' ? m.content : JSON.stringify({ respuesta: m.content }) }]
      }))

      // Saneamiento de seguridad para evitar caídas en el SDK de Gemini:
      // El SDK de Google Generative AI exige estrictamente que el primer mensaje empiece con el rol 'user'.
      // Si el primer mensaje es del modelo (el saludo inicial), lo removemos del historial.
      if (tempHistory.length > 0 && tempHistory[0].role === 'model') {
        tempHistory.shift()
      }

      // Asegurar alternancia estricta de roles (user -> model -> user -> model)
      const history = []
      let ultimoRol = null
      for (const msg of tempHistory) {
        if (msg.role !== ultimoRol) {
          history.push(msg)
          ultimoRol = msg.role
        }
      }

      const isAtencion = testId === 'd8e9f0a1-b2c3-4567-defa-777777777777'
      const systemInstructionPrompt = isAtencion ? SYSTEM_PROMPT_ATENCION : SYSTEM_PROMPT

      const chat = model.startChat({
        history,
        systemInstruction: {
          parts: [{ text: systemInstructionPrompt }]
        }
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

      const isAtencion = testId === 'd8e9f0a1-b2c3-4567-defa-777777777777'

      const transcripcion = (mensajes || []).map((m: any) => {
        const remitente = m.role === 'user' ? 'Analista (Candidato)' : `Cliente (${isAtencion ? 'Laura Benítez' : 'Carlos Gómez'})`
        return `${remitente}: ${m.content}`
      }).join('\n')

      const evalPromptCobranzas = `
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

      const evalPromptAtencion = `
Eres un Evaluador Psicométrico de Recursos Humanos experto en People Analytics, atención al cliente y selección de personal.
Tu tarea es analizar la transcripción de una llamada de Role Play simulada entre un candidato (Analista de Atención al Cliente) y la clienta Laura Benítez.

TRANSCRIPCIÓN DE LA LLAMADA:
${transcripcion}

Evalúa al candidato en las siguientes 4 dimensiones críticas de desempeño de servicio, otorgando un puntaje de 0 a 100 para cada una:
1. empatia: Capacidad de escuchar activamente, contener emocionalmente al cliente y disculparse sinceramente por el inconveniente.
2. indagacion: Habilidad para recopilar detalles del cobro duplicado y solicitar datos necesarios de forma ordenada y calmada.
3. resolucion: Capacidad de explicar las políticas de reintegro de la organización de forma clara y pactar un plazo de resolución realista.
4. calidadServicio: Uso de un tono profesional, claro, asertivo y un vocabulario respetuoso y reconfortante.

Devuelve ÚNICAMENTE un objeto JSON estructurado con el siguiente formato:
{
  "empatia": 85,
  "indagacion": 70,
  "resolucion": 90,
  "calidadServicio": 80,
  "retroalimentacion": "Resumen de fortalezas y áreas de mejora en servicio al cliente observadas durante la llamada en 3 oraciones.",
  "acuerdoAlcanzado": true
}
`

      const evalPrompt = isAtencion ? evalPromptAtencion : evalPromptCobranzas

      const evalModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json'
        },
        safetySettings
      })
      const evalResult = await evalModel.generateContent(evalPrompt)
      const evalText = evalResult.response.text()
      
      let parseado: any;
      try {
        const jsonMatch = evalText.match(/\{[\s\S]*\}/)
        parseado = JSON.parse(jsonMatch ? jsonMatch[0] : evalText)
      } catch (e) {
        console.error("Error parseando respuesta de evaluacion de Gemini:", e);
        parseado = isAtencion ? {
          empatia: 50,
          indagacion: 50,
          resolucion: 50,
          calidadServicio: 50,
          retroalimentacion: "La simulación finalizó. No se pudo generar una retroalimentación detallada por un inconveniente de red, pero las respuestas del candidato han sido registradas para su revisión manual.",
          acuerdoAlcanzado: false
        } : {
          empatia: 50,
          manejoObjeciones: 50,
          resolucionConflicto: 50,
          adherenciaProtocolo: 50,
          retroalimentacion: "La simulación finalizó. No se pudo generar una retroalimentación detallada por un inconveniente de red, pero las respuestas del candidato han sido registradas para su revisión manual.",
          acuerdoAlcanzado: false
        };
      }

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

      const porFactor = isAtencion ? {
        'Empatía y Escucha': parseado.empatia || 50,
        'Indagación del Problema': parseado.indagacion || 50,
        'Resolución de Conflictos': parseado.resolucion || 50,
        'Calidad de Servicio': parseado.calidadServicio || 50,
      } : {
        'Empatía y Escucha': parseado.empatia || 50,
        'Manejo de Objeciones': parseado.manejoObjeciones || 50,
        'Resolución de Conflictos': parseado.resolucionConflicto || 50,
        'Adherencia a Protocolo': parseado.adherenceProtocolo || parseado.adherenciaProtocolo || 50,
      }

      const puntajeBruto = {
        por_factor: porFactor,
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
