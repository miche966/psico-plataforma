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

    // --- LÓGICA DE BLINDAJE MATEMÁTICO ---
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

    if (reqs.length === 0 || (reqs.length === 1 && !reqs[0]?.competencia)) {
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

    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico;
    const mbtiFinal = [
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

Datos Técnicos de Referencia (CONFIDENCIAL):
- NIVEL DE AJUSTE: ${scoreSeguro}/100
- DICTAMEN: ${dictamenHumano}
- PERFIL MBTI: ${mbtiFinal}

Instrucciones:
1. PROFESIONAL Y HUMANA: Tono ejecutivo. 
2. SILENCIO TÉCNICO: PROHIBIDO mencionar etiquetas como "PUNTAJE DE AJUSTE", "NaN", "SCORE".
3. DINAMISMO: Identifica entre 3-5 fortalezas y 2-4 áreas de mejora.

Devuelve EXCLUSIVAMENTE un JSON:
{
  "resumenEjecutivo": "...",
  "fortalezas": ["..."],
  "oportunidadesMejora": ["..."],
  "ajusteCargo": { "score": ${scoreMatematico}, "analisis": "..." },
  "recomendacion": "${dictamenFinal}",
  "fundamentacion": "...",
  "mbtiType": "${mbtiFinal}",
  "ajusteMbti": "...",
  "interpretacionPorFactor": { "etica": "...", "comunicacion": "...", "extraversion": "...", "amabilidad": "...", "responsabilidad": "...", "neuroticismo": "...", "apertura": "...", "nivel_estres": "..." },
  "metaCompetencias": { "liderazgo": 0, "adaptabilidad": 0, "resiliencia": 0, "colaboracion": 0, "comunicacion": 0 }
}
`

    const modelosAProbar = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
    let resultado: any;
    let errorFinal: any = null;

    for (const modelName of modelosAProbar) {
      try {
        const modelInstance = genAI.getGenerativeModel({ model: modelName });
        const result = await modelInstance.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        resultado = JSON.parse(jsonStr);
        if (resultado) { errorFinal = null; break; }
      } catch (error: any) {
        errorFinal = error;
        continue;
      }
    }

    if (!resultado && errorFinal) throw new Error(errorFinal.message);
    return NextResponse.json(resultado)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
