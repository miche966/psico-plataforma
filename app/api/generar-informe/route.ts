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
    

    // Preparar el prompt con toda la información disponible
    let datosCandidato = `Candidato: ${candidato.nombre} ${candidato.apellido}\n`
    if (proceso) {
      datosCandidato += `Proceso al que postula: ${proceso.nombre}\n`
      datosCandidato += `Cargo: ${proceso.cargo}\n`
      if (proceso.descripcion_cargo) {
        datosCandidato += `Descripción del cargo: ${proceso.descripcion_cargo}\n`
      }
    }

    let resultados = '--- RESULTADOS DETALLADOS DE EVALUACIÓN ---\n'
    sesiones.forEach((s: any, idx: number) => {
      // Incluimos la sesión siempre que tenga algún dato de puntaje, sin importar el estado
      const data = (s.puntaje_bruto?.por_factor as Record<string, any>) || s.puntaje_bruto || {};
      if (Object.keys(data).length === 0 && !s.transcripcion) return;

      resultados += `\n[PRUEBA]: ${s.test_id?.toUpperCase() || 'EVALUACIÓN'}\n`
      Object.entries(data).forEach(([key, val]) => {
        if (['total', 'porcentaje', 'nivel_maximo', 'metricas_fraude', 'por_factor', 'por_subtipo'].includes(key?.toLowerCase())) return;
        if (typeof val === 'number') {
          resultados += `- ${key}: ${val}/5\n`
        } else if (typeof val === 'object' && val !== null && 'correctas' in val) {
          resultados += `- ${key}: ${val.correctas}/${val.total || 5}\n`
        }
      })
      if (s.transcripcion) {
        resultados += `COMENTARIOS/ENTREVISTA: "${s.transcripcion.slice(0, 800)}"\n`
      }
    })

    // --- LÓGICA DE BLINDAJE MATEMÁTICO (Sincronización con el UI) ---
    const DOMINIOS_PROF = ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad', 'honestidad', 'normas', 'promedio_general', 'etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion', 'comunicacion', 'liderazgo', 'trabajo_equipo', 'adaptabilidad', 'resolucion_problemas', 'correctas', 'score', 'documentos', 'comparacion', 'concentracion', 'errores_texto', 'errores_numeros'];
    
    let scoreMatematico = 0;
    const reqs = proceso?.competencias_requeridas || [];
    
    const COMPETENCIAS_MAPPING: Record<string, Partial<Record<string, number>>> = {
      'Orientación al cliente': { amabilidad: 4.5, responsabilidad: 4 },
      'Orientación a resultados': { responsabilidad: 5, extraversion: 4 },
      'Trabajo en equipo': { amabilidad: 5, extraversion: 4 },
      'Adaptabilidad al cambio': { apertura: 5, neuroticismo: 1.5 },
      'Integridad': { responsabilidad: 5, amabilidad: 4 },
      'Iniciativa': { extraversion: 4.5, apertura: 4, responsabilidad: 4 },
      'Liderazgo': { extraversion: 5, responsabilidad: 4.5, neuroticismo: 1.5 },
      'Comunicación': { extraversion: 5, amabilidad: 4 },
      'Negociación': { extraversion: 4.5, amabilidad: 3.5, responsabilidad: 4 },
      'Planificación y organización': { responsabilidad: 5, apertura: 3.5 },
      'Tolerancia a la presión': { neuroticismo: 1, responsabilidad: 4.5 },
      'Pensamiento analítico': { apertura: 4.5, responsabilidad: 4 },
      'Creatividad e innovación': { apertura: 5, extraversion: 4 },
      'Autocontrol': { neuroticismo: 1, amabilidad: 4 },
      'Responsabilidad': { responsabilidad: 5 }
    };

    // Lista de factores válidos para el promedio de respaldo
    const FACTORES_VALIDOS = ['amabilidad', 'responsabilidad', 'extraversion', 'apertura', 'neuroticismo', 'etica', 'negociacion', 'empatia', 'comunicacion'];

    if (reqs.length === 0 || (reqs.length === 1 && !reqs[0]?.competencia)) {
      console.log("[IA] No hay requerimientos (o vacíos), calculando promedio general omnisciente depurado...");
      const factores: number[] = [];
      const CLAVES_IGNORAR = ['total', 'correctas', 'porcentaje', 'id', 'created_at', 'proceso_id', 'candidato_id', 'finalizada_en', 'iniciada_en', 'nivel_maximo'];
      
      sesiones.forEach((s: any) => {
        const scan = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          Object.entries(obj).forEach(([k, v]) => {
            const key = k.toLowerCase().trim();
            if (CLAVES_IGNORAR.includes(key)) return;

            const valNum = parseFloat(String(v));
            if (!isNaN(valNum)) {
              let val = valNum;
              if (val > 5 && val <= 20) val = (val / 20) * 5;
              else if (val > 20 && val <= 100) val = (val / 100) * 5;
              
              if (val > 0 && val <= 5) factores.push(val);
            } 
            else if (typeof v === 'object' && v !== null && 'correctas' in v) {
              const score = (Number((v as any).correctas) / (Number((v as any).total) || 1)) * 5;
              factores.push(score);
            }
            if (typeof v === 'object') scan(v);
          });
        };
        scan(s.puntaje_bruto);
      });
      if (factores.length > 0) {
        const avg = factores.reduce((a, b) => a + b, 0) / factores.length;
        scoreMatematico = Math.round((avg / 5) * 100);
      }
    } else {
      console.log(`[IA] Calculando ajuste para ${reqs.length} competencias...`);
      const pcts: number[] = [];
      reqs.forEach((r: any) => {
        let valCand = 0;
        const mapping = COMPETENCIAS_MAPPING[r.competencia];
        
        sesiones.forEach((s: any) => {
          const buscar = (obj: any) => {
            if (!obj || typeof obj !== 'object' || valCand !== 0) return;
            Object.entries(obj).forEach(([f, v]: any) => {
              if (valCand !== 0) return;
              const keyNormalizada = f?.toLowerCase()?.trim();
              
              if (keyNormalizada === r.competencia?.toLowerCase()?.trim()) {
                valCand = (v?.correctas ? (v.correctas/v.total)*5 : (typeof v === 'number' ? v : 0)) || 0;
              } else if (mapping && (mapping as any)[keyNormalizada]) {
                let val = (v?.correctas ? (v.correctas/v.total)*5 : (typeof v === 'number' ? v : 0)) || 0;
                if (keyNormalizada === 'neuroticismo' && ((mapping as any)[keyNormalizada] || 0) < 3) val = 6 - val;
                valCand = val;
              }
              if (typeof v === 'object' && v !== null) buscar(v);
            });
          };
          buscar(s.puntaje_bruto);
        });
        const p = Math.min(100, Math.round((valCand / (r.nivel || 3)) * 100));
        pcts.push(p);
      });
      scoreMatematico = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    }

    const dictamenFinal = scoreMatematico >= 85 ? 'recomendado' : scoreMatematico >= 70 ? 'con_reservas' : 'no_recomendado';
    const dictamenHumano = dictamenFinal === 'recomendado' ? 'RECOMENDADO' : dictamenFinal === 'con_reservas' ? 'RECOMENDADO CON RESERVAS' : 'NO RECOMENDADO';

    // Motor de Estimación MBTI (Big Five Correlation)
    let ocean: Record<string, number> = { o: 2.5, c: 2.5, e: 2.5, a: 2.5, n: 2.5 };
    if (candidato.sesiones) {
      candidato.sesiones.forEach((s: any) => {
        const buscarOcean = (obj: any) => {
          if (!obj) return;
          Object.entries(obj).forEach(([f, v]) => {
            const k = f.toLowerCase().trim();
            const val = (v?.correctas ? (v.correctas/v.total)*5 : (typeof v === 'number' ? v : 0)) || 0;
            if (k.includes('extraver')) ocean.e = val;
            if (k.includes('responsab')) ocean.c = val;
            if (k.includes('amabilid')) ocean.a = val;
            if (k.includes('apertura')) ocean.o = val;
            if (k.includes('neurotic')) ocean.n = val;
            if (typeof v === 'object') buscarOcean(v);
          });
        };
        buscarOcean(s.puntaje_bruto);
      });
    }

    // BLINDAJE ANTI-NaN: Aseguramos que el score sea siempre un número válido antes de enviarlo a la IA
    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico;

    const mbtiCalculado = [
      ocean.e >= 2.7 ? 'E' : 'I',
      ocean.o >= 2.7 ? 'N' : 'S',
      ocean.a >= 2.7 ? 'F' : 'T',
      ocean.c >= 2.7 ? 'J' : 'P'
    ].join('');


    const prompt = `
Contexto de Evaluación:
${datosCandidato}

Resultados de Pruebas:
${resultados}

Datos Técnicos de Referencia (CONFIDENCIAL - NO MENCIONAR):
- NIVEL DE AJUSTE: ${scoreSeguro}/100
- DICTAMEN: ${dictamenHumano}
- PERFIL MBTI: ${mbtiCalculado}

Instrucciones de Redacción (Protocolo AGENTE DE ANÁLISIS HUMAN-CENTRIC):
Eres un Agente de Diagnóstico Psicodiagnóstico de alta gama. Tu redacción debe ser:
1. PROFESIONAL Y HUMANA: Usa un tono ejecutivo pero cercano. No reduzcas al candidato a números; describe su "Arquitectura Conductual".
2. SILENCIO TÉCNICO: PROHIBIDO mencionar etiquetas internas como "PUNTAJE DE AJUSTE", "NaN", "SCORE" o nombres de variables. Traduce los datos técnicos a lenguaje narrativo.
3. NO-MAXIMALISTA (CRÍTICO): Prohibido usar: "excepcional", "sobresaliente", "inquebrantable", "excelente", "maravilloso", "perfecto", "agudo". 
   - Reemplaza por: "destacado", "notable", "consistente", "sólido", "adecuado", "claro".
3. RIQUEZA INFORMATIVA: Evita obviedades. Explica el IMPACTO organizacional de cada rasgo.
4. SIN TECNICISMOS: No menciones nombres de tests (DASS-21, Big Five, etc.). Habla de "equilibrio emocional" o "tendencias de personalidad".

Estructura de Contenido:
1. "resumenEjecutivo": Síntesis estratégica. Explica el VALOR del candidato y su proyección en el cargo en 2 párrafos técnicos.
2. "fortalezas": Lista de entre 3 y 5 competencias críticas que representen una ventaja competitiva real según los datos.
3. "oportunidadesMejora": Lista de entre 2 y 4 áreas de desarrollo identificadas, descritas de forma profesional.
4. "ajusteCargo": { 
      "score": ${scoreMatematico}, 
      "analisis": "Análisis profundo de idoneidad. Compara el perfil contra los desafíos de '${proceso?.cargo || 'la posición'}'. Identifica sintonía profesional y posibles brechas operativas." 
   }
5. "fundamentacion": Argumentación técnica que justifica la recomendación basada en la probabilidad de éxito.
6. "ajusteMbti": Cómo su perfil conductual influye en su desempeño diario en este cargo específico.
7. "metaCompetencias": { "liderazgo": 0-100, "adaptabilidad": 0-100, "resiliencia": 0-100, "colaboracion": 0-100, "comunicacion": 0-100 }
8. "interpretacionPorFactor": Análisis cualitativo INDIVIDUAL para cada factor evaluado (Personalidad, Competencias y Bienestar). 

CRITERIO DE REDACCIÓN (CONSULTORÍA ESTRATÉGICA):
- Profundidad Analítica: Cada factor debe tener entre 3 y 4 oraciones. No te limites a describir, analiza el IMPACTO de la conducta en el cargo.
- Estructura de Párrafo: 1) Tendencia observada, 2) Mecanismo de ejecución, 3) Impacto/Valor para la organización.
- TONO HUMAN-CENTRIC: PROHIBIDO usar jerga técnica deshumanizante como "arquitectura conductual", "eficiencia cognitiva" o referirse al candidato como "recurso". Usa "enfoque profesional", "efectividad operativa" y "perfil".
- PROHIBIDO usar el nombre del candidato. Usa "El perfil", "El evaluado" o "El candidato".
- Tono de Auditoría: Redacción en tercera persona, objetiva y basada en evidencia.
- Prohibido maximalismos: No uses "excepcional", "profunda", "inquebrantable", "sobresaliente".
- Evita lo genérico: El análisis debe ser específico para el cargo (Jurídico/Recupero), pero sin sonar informal.
- FORMATO LIMPIO: PROHIBIDO usar negritas (**), cursivas o cualquier marca de formato Markdown. Entrega solo texto plano profesional.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura exacta:
{
  "resumenEjecutivo": "...",
  "fortalezas": ["punto 1", "punto 2", "..."],
  "oportunidadesMejora": ["punto 1", "punto 2", "..."],
  "ajusteCargo": { "score": ${scoreMatematico}, "analisis": "..." },
  "recomendacion": "${dictamenFinal}",
  "fundamentacion": "...",
  "mbtiType": "${mbtiCalculado}",
  "ajusteMbti": "...",
  "interpretacionPorFactor": { 
     "etica": "...", 
     "negociacion": "...", 
     "manejo_emocional": "...", 
     "tolerancia_frustracion": "...", 
     "comunicacion": "...",
     "extraversion": "...",
     "amabilidad": "...",
     "responsabilidad": "...",
     "neuroticismo": "...",
     "apertura": "...",
     "nivel_estres": "...",
     "carga_laboral": "..."
  },
  "metaCompetencias": { "liderazgo": 0, "adaptabilidad": 0, "resiliencia": 0, "colaboracion": 0, "comunicacion": 0 }
}
`

    console.log(`[AUDITORÍA IA] Iniciando generación para: ${candidato.nombre} ${candidato.apellido}`)
    console.log(`[AUDITORÍA IA] Factores enviados:`, sesiones.map((s: any) => Object.keys(s.puntaje_bruto?.por_factor || s.puntaje_bruto || {})).flat())

    let resultado: any;
    let errorFinal: any = null;

    // --- ARNES DE SEGURIDAD PARA MODELOS EXPERIMENTALES ---
    const modelosAProbar = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
    
    for (const modelName of modelosAProbar) {
      try {
        console.log(`[IA] Intentando con modelo experimental: ${modelName}...`);
        const modelInstance = genAI.getGenerativeModel({ model: modelName });
        const result = await modelInstance.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        console.log(`[IA] ÉXITO con ${modelName} (${text.length} caracteres)`);

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        resultado = JSON.parse(jsonStr);
        
        if (resultado) {
          errorFinal = null;
          break; 
        }
      } catch (error: any) {
        console.warn(`[IA] Falló ${modelName}:`, error.message);
        errorFinal = error;
        continue; 
      }
    }

    if (!resultado && errorFinal) {
      throw new Error(`Ningún modelo de IA respondió correctamente: ${errorFinal.message}`);
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
