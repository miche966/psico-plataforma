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

    // 1. LÓGICA DE CÁLCULO TÉCNICO (Sincronizada)
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
      scoreMatematico = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }
    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico;

    // 2. ESTIMACIÓN OCEAN/MBTI
    let ocean = { e: 2.5, c: 2.5, a: 2.5, o: 2.5, n: 2.5 };
    sesiones.forEach((s: any) => {
      const d = s.puntaje_bruto || {};
      if (d.extraversion) ocean.e = d.extraversion;
      if (d.responsabilidad) ocean.c = d.responsabilidad;
      if (d.amabilidad) ocean.a = d.amabilidad;
      if (d.apertura) ocean.o = d.apertura;
      if (d.neuroticismo) ocean.n = d.neuroticismo;
    });

    const mbtiFinalCalculado = [
      ocean.e >= 2.7 ? 'E' : 'I',
      ocean.o >= 2.7 ? 'N' : 'S',
      ocean.a >= 2.7 ? 'F' : 'T',
      ocean.c >= 2.7 ? 'J' : 'P'
    ].join('');

    const dictamenFinal = scoreSeguro >= 85 ? 'recomendado' : scoreSeguro >= 70 ? 'con_reservas' : 'no_recomendado';
    const dictamenHumano = dictamenFinal === 'recomendado' ? 'RECOMENDADO' : dictamenFinal === 'con_reservas' ? 'RECOMENDADO CON RESERVAS' : 'NO RECOMENDADO';

    // 3. PROMPT ESTRATÉGICO FINAL
    const prompt = `
Contexto de Evaluación:
Candidato: ${candidato.nombre} ${candidato.apellido}
Puesto: ${proceso?.cargo || 'N/A'} - Descripción: ${proceso?.descripcion_cargo || 'Perfil profesional estándar'}
Resultados Crudos: ${JSON.stringify(sesiones.map(s => ({ t: s.test_id, d: s.puntaje_bruto })))}

Parámetros de Referencia:
- Ajuste al Puesto: ${scoreSeguro}%
- Perfil MBTI: ${mbtiFinalCalculado}
- Recomendación: ${dictamenHumano}

Instrucciones de Redacción (PROTOCOL AGENTE HUMAN-CENTRIC):
Eres el consultor senior encargado del cierre de este proceso. Tu objetivo es generar un informe de nivel ejecutivo.
1. TONO: Profesional, sobrio y humano. No uses lenguaje maximalista (evita: excepcional, extraordinario, perfecto). Prefiere: notable, consistente, sólido.
2. ANÁLISIS DE IMPACTO: Cada punto debe explicar: 1) Tendencia observada, 2) Cómo se ejecuta en el día a día y 3) Qué valor aporta a la organización.
3. DINAMISMO: Identifica 3 a 5 fortalezas y 2 a 4 áreas de mejora basadas REALMENTE en los datos. No rellenes por rellenar.
4. SILENCIO TÉCNICO: PROHIBIDO mencionar etiquetas como "NaN", "PUNTAJE DE AJUSTE" o cualquier residuo de código.

Formato JSON de salida:
{
  "resumenEjecutivo": "Dos párrafos de síntesis estratégica.",
  "fortalezas": ["...", "..."],
  "oportunidadesMejora": ["...", "..."],
  "ajusteCargo": { "score": ${scoreSeguro}, "analisis": "Análisis cualitativo del ajuste vs el cargo." },
  "recomendacion": "${dictamenFinal}",
  "fundamentacion": "Argumentos técnicos de la recomendación.",
  "mbtiType": "${mbtiFinalCalculado}",
  "ajusteMbti": "Análisis de su tipo de personalidad en el rol.",
  "interpretacionPorFactor": { "perfil": "Análisis narrativo de su arquitectura conductual." },
  "metaCompetencias": { "liderazgo": 75, "adaptabilidad": 80, "resiliencia": 70, "colaboracion": 85, "comunicacion": 80 }
}
`;

    // 4. EJECUCIÓN CON MODELO OFICIAL
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
