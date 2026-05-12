import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { candidato, proceso, sesiones } = payload;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta GEMINI_API_KEY' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 1. Re-mapeo de competencias
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

    // 2. Cálculo de Score Matemático
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

    // 3. Estimación MBTI (OCEAN)
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

    // 4. Prompt Ejecutivo
    const prompt = `
Contexto Candidato: ${candidato.nombre} ${candidato.apellido}
Cargo: ${proceso?.cargo || 'N/A'}
Resultados de Tests: ${JSON.stringify(sesiones.map(s => ({ id: s.test_id, p: s.puntaje_bruto })))}
Métricas de Ajuste: ${scoreSeguro}% - MBTI: ${mbtiFinalCalculado}

Instrucciones:
- Genera un diagnóstico psicométrico profundo y profesional.
- SILENCIO TÉCNICO: PROHIBIDO usar etiquetas como "PUNTAJE", "NaN", "SCORE" o nombres de variables en el texto.
- DINAMISMO: Identifica entre 3-5 fortalezas y 2-4 áreas de desarrollo basadas en la evidencia.

Devuelve EXCLUSIVAMENTE un JSON válido:
{
  "resumenEjecutivo": "...",
  "fortalezas": ["...", "..."],
  "oportunidadesMejora": ["...", "..."],
  "ajusteCargo": { "score": ${scoreSeguro}, "analisis": "..." },
  "recomendacion": "recomendado | con_reservas | no_recomendado",
  "fundamentacion": "...",
  "mbtiType": "${mbtiFinalCalculado}",
  "ajusteMbti": "...",
  "interpretacionPorFactor": { "perfil": "Analisis narrativo" },
  "metaCompetencias": { "liderazgo": 0, "adaptabilidad": 0, "resiliencia": 0, "colaboracion": 0, "comunicacion": 0 }
}
`;

    // 5. LLAMADA AL MODELO HABILITADO (GEMINI-PRO)
    const model = genAI.getGenerativeModel({ model: 'gemini-pro-latest' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const resultado = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('[FATAL] Error en motor IA:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
