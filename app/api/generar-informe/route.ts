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
    
    // 2. ESCÁNER ULTRA-ROBUSTO DE FACTORES (FOCO EN BIENESTAR)
    const factoresCrudos: Record<string, number> = {};
    const NORMALIZACION_MAP: Record<string, string> = {
        'relaciones': 'relaciones',
        'relaciones interpersonales': 'relaciones',
        'clima': 'relaciones',
        'claridad_rol': 'claridad_rol',
        'claridad de rol': 'claridad_rol',
        'percepción de claridad de rol': 'claridad_rol',
        'burnout': 'burnout',
        'agotamiento': 'burnout',
        'equilibrio': 'equilibrio',
        'balance vida-trabajo': 'equilibrio',
        'nivel_estres': 'nivel_estres'
    };

    sesiones.forEach((s: any) => {
        const scan = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            Object.entries(obj).forEach(([k, v]) => {
                const rawKey = k.toLowerCase().trim();
                
                // Mapeo inteligente
                let targetKey = null;
                for (const [pattern, target] of Object.entries(NORMALIZACION_MAP)) {
                    if (rawKey.includes(pattern)) {
                        targetKey = target;
                        break;
                    }
                }
                const finalKey = targetKey || rawKey;

                if (typeof v === 'number') {
                    // Normalización a escala 0-5 si viene en 0-100 o 0-1
                    let val = v;
                    if (val > 5 && val <= 100) val = (val / 100) * 5;
                    factoresCrudos[finalKey] = val;
                }
                
                if (typeof v === 'object') scan(v);
            });
        };
        scan(s.puntaje_bruto || s.puntuacion || s.puntaje || {});
    });

    const prompt = `
Eres un Consultor Senior. Genera un informe PREMIUM.
Candidato: ${candidato.nombre} ${candidato.apellido}
Ajuste: ${scoreFinal}%

DATOS DETECTADOS:
${JSON.stringify(factoresCrudos)}

INSTRUCCIONES CRÍTICAS:
1. NARRATIVA POR FACTOR: Debes generar descripciones cualitativas (Tendencia, Mecanismo e Impacto) para:
   - "relaciones"
   - "claridad_rol"
   - "burnout"
   - "equilibrio"
   - Factores OCEAN (si existen)
2. ESTILO: Profesional, humano, sin maximalismos.
3. FORMATO: Devuelve JSON con la llave "interpretacionPorFactor" usando exactamente esas llaves.

Devuelve JSON:
{
  "resumenEjecutivo": "...",
  "fortalezas": [{"tendencia": "...", "mecanismo": "...", "impacto_organizacional": "..."}],
  "oportunidadesMejora": [{"tendencia": "...", "mecanismo": "...", "impacto_organizacional": "..."}],
  "ajusteCargo": { "score": ${scoreFinal}, "analisis": "..." },
  "interpretacionPorFactor": {
     "relaciones": "Análisis profundo...",
     "claridad_rol": "Análisis profundo...",
     "burnout": "...",
     "equilibrio": "...",
     "extraversion": "...",
     "amabilidad": "...",
     "responsabilidad": "...",
     "neuroticismo": "...",
     "apertura": "..."
  }
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
    console.error('[ERROR]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
