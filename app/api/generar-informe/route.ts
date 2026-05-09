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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite-001' })

    // Preparar el prompt con toda la información disponible
    let datosCandidato = `Candidato: ${candidato.nombre} ${candidato.apellido}\n`
    if (proceso) {
      datosCandidato += `Proceso al que postula: ${proceso.nombre}\n`
      datosCandidato += `Cargo: ${proceso.cargo}\n`
      if (proceso.descripcion_cargo) {
        datosCandidato += `Descripción del cargo: ${proceso.descripcion_cargo}\n`
      }
    }

    let resultados = '--- RESULTADOS CLAVE ---\n'
    sesiones.forEach((s: any, idx: number) => {
      if (s.estado !== 'finalizado') return;
      resultados += `\nPrueba: ${s.test_id?.split('-')[0] || 'Aptitud'}\n`
      const data = (s.puntaje_bruto?.por_factor as Record<string, any>) || s.puntaje_bruto || {};
      Object.entries(data).forEach(([key, val]) => {
        // Solo enviamos lo importante para ahorrar tiempo de procesamiento
        if (['total', 'porcentaje', 'nivel_maximo', 'metricas_fraude'].includes(key?.toLowerCase())) return;
        if (typeof val === 'number') {
          resultados += `- ${key}: ${val}/5\n`
        } else if (typeof val === 'object' && val !== null && 'correctas' in val) {
          resultados += `- ${key}: ${val.correctas}/${val.total || 5}\n`
        }
      })
      if (s.transcripcion) {
        resultados += `Discurso: "${s.transcripcion.slice(0, 500)}..."\n` // Recortar si es muy larga
      }
    })

    // --- LÓGICA DE BLINDAJE MATEMÁTICO (Sincronización con el UI) ---
    const DOMINIOS_PROF = ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad', 'honestidad', 'normas', 'promedio_general', 'etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion', 'comunicacion', 'liderazgo', 'trabajo_equipo', 'adaptabilidad', 'resolucion_problemas', 'correctas', 'score', 'documentos', 'comparacion', 'concentracion', 'errores_texto', 'errores_numeros'];
    
    let scoreMatematico = 0;
    const reqs = proceso?.competencias_requeridas || [];
    
    if (reqs.length === 0) {
      const factores: number[] = [];
      sesiones.forEach((s: any) => {
        const scan = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          Object.entries(obj).forEach(([k, v]) => {
            const key = k?.toLowerCase() || '';
            if (DOMINIOS_PROF.includes(key)) {
              let val = 0;
              if (typeof v === 'object' && v !== null && 'correctas' in v) val = (v.correctas / (v.total || 1)) * 5;
              else if (typeof v === 'number') val = v;
              if (val > 5) val = (val <= 100) ? (val / 100) * 5 : 5;
              factores.push(val);
            }
            if (key === 'por_factor') scan(v);
          });
        };
        scan(s.puntaje_bruto);
      });
      if (factores.length > 0) {
        const avg = factores.reduce((a, b) => a + b, 0) / factores.length;
        scoreMatematico = Math.round((avg / 5) * 100);
      }
    } else {
      const pcts: number[] = [];
      reqs.forEach((r: any) => {
        let valCand = 0;
        sesiones.forEach((s: any) => {
          const buscar = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.entries(obj).forEach(([f, v]: any) => {
              if (f?.toLowerCase() === r.competencia?.toLowerCase()) valCand = (v?.correctas ? (v.correctas/v.total)*5 : v) || 0;
              if (f === 'por_factor') buscar(v);
            });
          };
          buscar(s.puntaje_bruto);
        });
        pcts.push(Math.min(100, Math.round((valCand / r.nivel) * 100)));
      });
      scoreMatematico = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }

    const dictamenFinal = scoreMatematico >= 85 ? 'recomendado' : scoreMatematico >= 70 ? 'con_reservas' : 'no_recommended';
    const dictamenHumano = dictamenFinal === 'recomendado' ? 'RECOMENDADO' : dictamenFinal === 'con_reservas' ? 'RECOMENDADO CON RESERVAS' : 'NO RECOMENDADO';

    const prompt = `
Actúa como un Líder de Talento con mucha experiencia, alguien que sabe leer a las personas y lo explica de forma sencilla, cercana y humana.
Tu tarea es analizar los resultados de las evaluaciones y las transcripciones de video de un candidato.

${datosCandidato}
${resultados}

DIRECTIVA CRÍTICA DE CONSISTENCIA:
El sistema matemático ya ha calculado el Dictamen Final basándose en los baremos de la empresa:
- PUNTAJE DE AJUSTE: ${scoreMatematico}/100
- DICTAMEN OBLIGATORIO: ${dictamenHumano}

Debes redactar todo el informe de forma que sea COHERENTE con este dictamen de "${dictamenHumano}". No puedes contradecir esta decisión en tu argumentación. Si el dictamen es "${dictamenHumano}", tu fundamentación y resumen deben explicar por qué se llegó a esa conclusión de forma positiva y profesional.

Instrucciones de Redacción:
1. TONO HUMANO Y CERCANO: Escribe de forma natural, como si me estuvieras contando sobre el candidato en un café.
2. SIN TERMINOLOGÍA TÉCNICA: No uses palabras técnicas. Traduce todo a lenguaje común.
3. CERO MAXIMALISMOS: Usa términos realistas y matizados.
4. ESTRUCTURA:
   - "resumenEjecutivo": 2 párrafos que sustenten el dictamen de "${dictamenHumano}".
   - "fortalezas": 3 puntos claros.
   - "oportunidadesMejora": 2 puntos explicados con realismo.
   - "ajusteCargo": { "score": ${scoreMatematico}, "analisis": "Breve explicación de por qué es ${dictamenHumano}" }
   - "recomendacion": "${dictamenFinal}"
   - "fundamentacion": Argumentación final que REFUERCE el dictamen de "${dictamenHumano}".
   - "interpretacionPorFactor": Una frase sencilla para cada factor.
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

    let resultado: any;
    try {
      console.log(`[IA] Enviando prompt (${prompt.length} caracteres)...`)
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      console.log(`[IA] Respuesta recibida (${text.length} caracteres)`)

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const jsonStr = jsonMatch ? jsonMatch[0] : text
      resultado = JSON.parse(jsonStr)
    } catch (error: any) {
      console.error('[IA] Error en llamada a la API o parseo:', error)
      throw new Error(`Error en la generación por IA: ${error.message}`)
    }

    // Validación de Integridad: ¿Están todos los factores?
    const factoresEnviados = sesiones.flatMap((s: any) => Object.keys(s.puntaje_bruto?.por_factor || s.puntaje_bruto || {}))
      .filter(f => f !== 'total' && f !== 'porcentaje' && f !== 'por_factor')
    
    const factoresRecibidos = Object.keys(resultado.interpretacionPorFactor || {})
    const faltantes = factoresEnviados.filter(f => !factoresRecibidos.includes(f?.toLowerCase() || ''))

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
