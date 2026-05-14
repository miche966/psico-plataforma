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
Eres un Consultor Senior en Desarrollo Humano. Tu misión es redactar un informe ejecutivo de alta gama que sea profundamente humano pero estrictamente profesional.

REGLAS DE ORO DE REDACCIÓN:
1. TONO: Cercano, empático y profesional. Habla de comportamientos y situaciones, NO de puntajes.
2. SIN TECNICISMOS: Prohibido usar términos como "neuroticismo", "amabilidad", "extroversión", "resiliencia adaptativa" o nombres de tests. Traduce esto a lenguaje de negocios claro (ej: "manejo de la presión", "trato con los demás", "enfoque en resultados").
3. ANONIMATO: No utilices el nombre del candidato en ninguna parte del análisis. Refiérete a él/ella como "el perfil", "la persona evaluada" o mediante estructuras impersonales.
4. ESTRUCTURA DE ANÁLISIS: Cada punto debe explicar qué se observa, cómo actúa la persona y qué impacto tiene esto en el trabajo diario.
5. SIN META-LENGUAJE: No escribas "Basado en los datos...", "El informe indica...". Escribe el análisis directo.

CONTEXTO DEL PUESTO: ${proceso?.cargo || 'N/A'}
AJUSTE ESTIMADO: ${scoreFinal}%

DATOS PARA ANÁLISIS (FACTORES):
${JSON.stringify(factoresCrudos)}

Devuelve UNICAMENTE un objeto JSON con esta estructura:
{
  "resumenEjecutivo": "Análisis integrador de la persona frente al desafío laboral (Mínimo 3 párrafos).",
  "fortalezas": [{"tendencia": "Comportamiento observado", "mecanismo": "Forma de actuar", "impacto_organizacional": "Valor para la empresa"}],
  "oportunidadesMejora": [{"tendencia": "Punto de atención", "mecanismo": "Situación de riesgo", "impacto_organizacional": "Consecuencia operativa"}],
  "ajusteCargo": { "score": ${scoreFinal}, "analisis": "Explicación humana de por qué el perfil encaja o no con las demandas del puesto." },
  "fundamentacion": "Argumento final para la toma de decisiones. Debe ser honesto y profesional.",
  "interpretacionPorFactor": {
     "relaciones": "Cómo se vincula con los demás...",
     "claridad_rol": "Cómo entiende sus tareas...",
     "burnout": "Cómo maneja el agotamiento...",
     "equilibrio": "Relación trabajo y bienestar...",
     "extraversion": "Nivel de interacción...",
     "amabilidad": "Calidez y trato...",
     "responsabilidad": "Compromiso y orden...",
     "neuroticismo": "Estabilidad ante la presión...",
     "apertura": "Disposición al cambio..."
  },
  "recomendacion": "...",
  "metaCompetencias": { 
    "liderazgo": 0, 
    "adaptabilidad": 0, 
    "resiliencia": 0, 
    "colaboracion": 0, 
    "comunicacion": 0 
  }
}
*Nota: En metaCompetencias, sustituye los 0 por números enteros del 1 al 100 estimados según el perfil.*
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
