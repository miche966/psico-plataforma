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

    // 1. SINCRONIZACIÓN DE SCORE
    let scoreFinal = actual?.ajusteCargo?.score || 0;
    
    // 2. NORMALIZACIÓN Y EXTRACCIÓN DE FACTORES (EL "BUZÓN" UNIFICADO)
    const factoresCrudos: Record<string, number> = {};
    const NORMALIZACION_MAP: Record<string, string> = {
        'relaciones': 'relaciones',
        'relaciones interpersonales': 'relaciones',
        'relaciones interpersonales y clima': 'relaciones',
        'claridad_rol': 'claridad_rol',
        'claridad de rol': 'claridad_rol',
        'percepción de claridad de rol': 'claridad_rol',
        'burnout': 'burnout',
        'riesgo de agotamiento': 'burnout',
        'equilibrio': 'equilibrio',
        'balance vida-trabajo': 'equilibrio',
        'extraversion': 'extraversion',
        'amabilidad': 'amabilidad',
        'responsabilidad': 'responsabilidad',
        'neuroticismo': 'neuroticismo',
        'apertura': 'apertura'
    };

    sesiones.forEach((s: any) => {
        const scan = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.entries(obj).forEach(([k, v]) => {
                const rawKey = k.toLowerCase().trim();
                const cleanKey = NORMALIZACION_MAP[rawKey] || rawKey;
                if (typeof v === 'number') factoresCrudos[cleanKey] = v;
                if (typeof v === 'object') scan(v);
            });
        };
        scan(s.puntaje_bruto);
    });

    const prompt = `
Eres un Consultor Senior en Psicodiagnóstico. Genera un informe PREMIUM para:
Candidato: ${candidato.nombre} ${candidato.apellido}
Puesto: ${proceso?.cargo || 'N/A'}
Ajuste: ${scoreFinal}%

DATOS PSICOMÉTRICOS (FACTORES):
${JSON.stringify(factoresCrudos)}

INSTRUCCIONES DE REDACCIÓN (HUMAN-CENTRIC PREMIUM):
1. TONO: Profesional, humano, sin maximalismos (evita: excepcional, extraordinario, excelente).
2. DESCRIPCIONES: Genera un análisis de alta gama (Tendencia, Mecanismo e Impacto) para cada factor encontrado.
3. LLAVES OBLIGATORIAS: Debes usar EXACTAMENTE estas llaves en el objeto "interpretacionPorFactor":
   - "relaciones" (para Relaciones Interpersonales)
   - "claridad_rol" (para Claridad de Rol)
   - "burnout" (para Riesgo de Agotamiento)
   - "equilibrio" (para Equilibrio Vida-Trabajo)
   - "extraversion", "amabilidad", "responsabilidad", "neuroticismo", "apertura".

Devuelve JSON:
{
  "resumenEjecutivo": "...",
  "fortalezas": [{"tendencia": "...", "mecanismo": "...", "impacto_organizacional": "..."}],
  "oportunidadesMejora": [{"tendencia": "...", "mecanismo": "...", "impacto_organizacional": "..."}],
  "ajusteCargo": { "score": ${scoreFinal}, "analisis": "..." },
  "fundamentacion": "...",
  "interpretacionPorFactor": {
     "relaciones": "Análisis profundo...",
     "claridad_rol": "Análisis profundo...",
     "burnout": "Análisis profundo...",
     "equilibrio": "Análisis profundo...",
     "extraversion": "...",
     "amabilidad": "...",
     "responsabilidad": "...",
     "neuroticismo": "...",
     "apertura": "..."
  },
  "recomendacion": "...",
  "metaCompetencias": { "liderazgo": 80, "adaptabilidad": 80, "resiliencia": 80, "colaboracion": 80, "comunicacion": 80 }
}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const resultado = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    resultado.ajusteCargo.score = scoreFinal;
    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('[FATAL ERROR]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
