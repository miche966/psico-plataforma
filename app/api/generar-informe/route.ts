import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { candidato, proceso, sesiones } = payload;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta llave de API.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 1. LÓGICA DE CÁLCULO TÉCNICO (SCORE)
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

    let scoreMatematico = 0;
    const reqs = proceso?.competencias_requeridas || [];
    
    if (reqs.length > 0) {
      const pcts: number[] = [];
      reqs.forEach((r: any) => {
        let valCand = 2.5;
        const mapping = COMPETENCIAS_MAPPING[r.competencia];
        sesiones.forEach((s: any) => {
          const d = s.puntaje_bruto?.por_factor || s.puntaje_bruto || {};
          const keyNormalizada = r.competencia?.toLowerCase()?.trim();
          if (d[keyNormalizada]) valCand = d[keyNormalizada];
          else if (mapping) {
             Object.entries(mapping).forEach(([mk, mv]) => { if (d[mk]) valCand = d[mk]; });
          }
        });
        pcts.push(Math.min(100, Math.round((valCand / (r.nivel || 3)) * 100)));
      });
      scoreMatematico = Math.round(pcts.reduce((a:number, b:number) => a + b, 0) / pcts.length);
    }
    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico;

    // 2. REPARACIÓN DEL TERMÓMETRO MBTI (Búsqueda Profunda de OCEAN)
    let ocean = { e: 2.5, c: 2.5, a: 2.5, o: 2.5, n: 2.5 };
    
    sesiones.forEach((s: any) => {
      const scan = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        Object.entries(obj).forEach(([k, v]) => {
          const key = k.toLowerCase().trim();
          const val = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : null);
          
          if (val !== null && !isNaN(val)) {
            // Normalización de escalas (si vienen en 0-100 o 0-20, convertir a 0-5)
            let normVal = val;
            if (normVal > 5 && normVal <= 20) normVal = (normVal / 20) * 5;
            else if (normVal > 20 && normVal <= 100) normVal = (normVal / 100) * 5;

            if (key.includes('extraver')) ocean.e = normVal;
            if (key.includes('responsab') || key === 'c') ocean.c = normVal;
            if (key.includes('amabilid') || key === 'a') ocean.a = normVal;
            if (key.includes('apertura') || key === 'o') ocean.o = normVal;
            if (key.includes('neurotic') || key === 'n') ocean.n = normVal;
          }
          if (typeof v === 'object') scan(v); // Búsqueda recursiva
        });
      };
      scan(s.puntaje_bruto);
    });

    const mbtiFinalCalculado = [
      ocean.e >= 2.7 ? 'E' : 'I',
      ocean.o >= 2.7 ? 'N' : 'S',
      ocean.a >= 2.7 ? 'F' : 'T',
      ocean.c >= 2.7 ? 'J' : 'P'
    ].join('');

    const dictamenFinal = scoreSeguro >= 85 ? 'recomendado' : scoreSeguro >= 70 ? 'con_reservas' : 'no_recomendado';
    const dictamenHumano = dictamenFinal === 'recomendado' ? 'RECOMENDADO' : dictamenFinal === 'con_reservas' ? 'RECOMENDADO CON RESERVAS' : 'NO RECOMENDADO';

    // 3. PROMPT ESTRATÉGICO (Se mantiene el estilo Human-Centric)
    const prompt = `
Contexto Candidato: ${candidato.nombre} ${candidato.apellido}
Puesto: ${proceso?.cargo || 'N/A'}
Resultados: ${JSON.stringify(sesiones.map(s => ({ t: s.test_id, d: s.puntaje_bruto })))}

Parámetros:
- Ajuste al Puesto: ${scoreSeguro}%
- Perfil MBTI: ${mbtiFinalCalculado}
- Recomendación: ${dictamenHumano}

Instrucciones (Protocolo HUMAN-CENTRIC PREMIUM):
Genera un diagnóstico de alta gama. 
1. TONO: Profesional y sobrio. Prohibido maximalismos (excepcional, excelente, etc.).
2. IMPACTO: Explica Tendencia, Mecanismo e Impacto organizacional.
3. DINAMISMO: 3-5 fortalezas y 2-4 áreas de desarrollo.
4. SILENCIO TÉCNICO: Cero menciones a etiquetas internas o código.

JSON de salida:
{
  "resumenEjecutivo": "...",
  "fortalezas": [],
  "oportunidadesMejora": [],
  "ajusteCargo": { "score": ${scoreSeguro}, "analisis": "..." },
  "recomendacion": "${dictamenFinal}",
  "fundamentacion": "...",
  "mbtiType": "${mbtiFinalCalculado}",
  "ajusteMbti": "...",
  "interpretacionPorFactor": { "perfil": "..." },
  "metaCompetencias": { "liderazgo": 80, "adaptabilidad": 80, "resiliencia": 80, "colaboracion": 80, "comunicacion": 80 }
}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const resultado = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('[FATAL ERROR]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
