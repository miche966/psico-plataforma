import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const { candidato, proceso, sesiones } = await req.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'La llave de API de Gemini no está configurada.' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // 1. Re-mapeo de competencias para el cálculo
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
             Object.entries(mapping).forEach(([mk, mv]) => {
                if (d[mk]) valCand = d[mk];
             });
          }
        });
        pcts.push(Math.min(100, Math.round((valCand / (r.nivel || 3)) * 100)));
      });
      scoreMatematico = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }

    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico;

    // 3. Estimación MBTI
    let ocean = { e: 2.5, c: 2.5, a: 2.5, o: 2.5, n: 2.5 };
    sesiones.forEach((s: any) => {
      const d = s.puntaje_bruto || {};
      if (d.extraversion) ocean.e = d.extraversion;
      if (d.responsabilidad) ocean.c = d.responsabilidad;
      if (d.amabilidad) ocean.a = d.amabilidad;
      if (d.apertura) ocean.o = d.apertura;
      if (d.neuroticismo) ocean.n = d.neuroticismo;
    });

    const mbtiCalculadoFinal = [
      ocean.e >= 2.7 ? 'E' : 'I',
      ocean.o >= 2.7 ? 'N' : 'S',
      ocean.a >= 2.7 ? 'F' : 'T',
      ocean.c >= 2.7 ? 'J' : 'P'
    ].join('');

    // 4. Preparación del Prompt
    const prompt = `
Contexto: ${candidato.nombre} ${candidato.apellido} - Cargo: ${proceso?.cargo || 'N/A'}
Resultados: ${JSON.stringify(sesiones.map(s => ({ test: s.test_id, data: s.puntaje_bruto })))}
Referencia Técnica: Ajuste ${scoreSeguro}%, MBTI: ${mbtiCalculadoFinal}

Instrucciones:
- Tono ejecutivo. PROHIBIDO mencionar etiquetas técnicas como "PUNTAJE" o "NaN".
- Fortalezas: 3-5 puntos relevantes.
- Oportunidades de Mejora: 2-4 puntos identificados.

Devuelve JSON exacto:
{
  "resumenEjecutivo": "...",
  "fortalezas": ["..."],
  "oportunidadesMejora": ["..."],
  "ajusteCargo": { "score": ${scoreSeguro}, "analisis": "..." },
  "recomendacion": "recomendado | con_reservas | no_recomendado",
  "fundamentacion": "...",
  "mbtiType": "${mbtiCalculadoFinal}",
  "ajusteMbti": "...",
  "interpretacionPorFactor": { "perfil": "Análisis cualitativo del evaluado" },
  "metaCompetencias": { "liderazgo": 80, "adaptabilidad": 70, "resiliencia": 75, "colaboracion": 85, "comunicacion": 80 }
}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const resultado = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('Error en Generación:', error.message);
    return NextResponse.json({ error: 'Error al procesar el informe.', detalle: error.message }, { status: 500 });
  }
}
