import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { candidato, proceso, sesiones, actual } = payload;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta llave de API.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 1. SINCRONIZACIÓN DE SCORE (Priorizamos el dato real del frontend)
    let scoreFinal = actual?.ajusteCargo?.score || 0;
    
    // Si el frontend no envió el score, intentamos el cálculo de respaldo (backup)
    if (scoreFinal === 0) {
        const COMPETENCIAS_MAPPING: Record<string, any> = {
            'Orientación al cliente': { amabilidad: 4.5, responsabilidad: 4 },
            'Liderazgo': { extraversion: 5, responsabilidad: 4.5, neuroticismo: 1.5 },
            'Responsabilidad': { responsabilidad: 5 }
        };
        let pcts: number[] = [];
        (proceso?.competencias_requeridas || []).forEach((r: any) => {
            let valCand = 2.5;
            sesiones.forEach((s: any) => {
                const d = s.puntaje_bruto?.por_factor || s.puntaje_bruto || {};
                if (d[r.competencia?.toLowerCase()]) valCand = d[r.competencia.toLowerCase()];
            });
            pcts.push(Math.min(100, Math.round((valCand / (r.nivel || 3)) * 100)));
        });
        if (pcts.length > 0) scoreFinal = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }

    // 2. EXTRACCIÓN DE FACTORES PARA LA IA (OCEAN + BIENESTAR)
    const factoresEncontrados: Record<string, number> = {};
    sesiones.forEach((s: any) => {
        const scan = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.entries(obj).forEach(([k, v]) => {
                const key = k.toLowerCase().trim();
                if (typeof v === 'number') factoresEncontrados[key] = v;
                if (typeof v === 'object') scan(v);
            });
        };
        scan(s.puntaje_bruto);
    });

    // 3. PROMPT DE ALTA GAMA CON FOCO EN NARRATIVAS INDIVIDUALES
    const prompt = `
Eres un Consultor Senior en Psicodiagnóstico Laboral. Tu tarea es generar un informe PREMIUM para:
Candidato: ${candidato.nombre} ${candidato.apellido}
Cargo: ${proceso?.cargo || 'N/A'}
Ajuste Calculado: ${scoreFinal}%

DATOS TÉCNICOS DETECTADOS:
${JSON.stringify(factoresEncontrados)}

INSTRUCCIONES DE REDACCIÓN (PROTOCOLO HUMAN-CENTRIC):
1. TONO: Profesional, ejecutivo y humano. PROHIBIDO usar palabras como "excepcional", "perfecto" o "sobresaliente". Usa "notable", "adecuado", "consistente".
2. SILENCIO TÉCNICO: No menciones puntajes numéricos dentro de los textos. Describe conductas.
3. NARRATIVA POR FACTOR: Debes generar una descripción cualitativa única para CADA uno de estos factores si están presentes en los datos:
   - Relaciones interpersonales
   - Claridad de rol
   - Equilibrio vida-trabajo
   - Riesgo de agotamiento
   - Factores OCEAN (Extraversión, Amabilidad, etc.)
   Cada descripción debe explicar: 1) Tendencia, 2) Mecanismo diario y 3) Impacto organizacional.

Devuelve EXCLUSIVAMENTE este JSON:
{
  "resumenEjecutivo": "...",
  "fortalezas": [{"tendencia": "...", "mecanismo": "...", "impacto_organizacional": "..."}],
  "oportunidadesMejora": [{"tendencia": "...", "mecanismo": "...", "impacto_organizacional": "..."}],
  "ajusteCargo": { "score": ${scoreFinal}, "analisis": "Análisis profundo del ajuste." },
  "fundamentacion": "...",
  "interpretacionPorFactor": {
     "relaciones": "Análisis premium...",
     "claridad_rol": "Análisis premium...",
     "burnout": "Análisis premium...",
     "equilibrio": "Análisis premium...",
     "extraversion": "...",
     "amabilidad": "...",
     "responsabilidad": "...",
     "neuroticismo": "...",
     "apertura": "..."
  },
  "recomendacion": "recomendado | con_reservas | no_recomendado",
  "metaCompetencias": { "liderazgo": 80, "adaptabilidad": 80, "resiliencia": 80, "colaboracion": 80, "comunicacion": 80 }
}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const resultado = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    // Aseguramos que el score de ajuste sea el que enviamos, no uno inventado por la IA
    resultado.ajusteCargo.score = scoreFinal;

    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('[FATAL ERROR]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
