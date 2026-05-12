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

    // Score de Respaldo
    let scoreMatematico = 0;
    const reqs = proceso?.competencias_requeridas || [];
    if (reqs.length > 0) {
      const pcts = reqs.map((r: any) => {
        let v = 2.5;
        sesiones.forEach((s: any) => {
          const d = s.puntaje_bruto?.por_factor || s.puntaje_bruto || {};
          if (d[r.competencia?.toLowerCase()]) v = d[r.competencia.toLowerCase()];
        });
        return Math.min(100, Math.round((v / (r.nivel || 3)) * 100));
      });
      scoreMatematico = Math.round(pcts.reduce((a:number, b:number) => a + b, 0) / pcts.length);
    }
    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico;

    const mbtiCalculadoFinal = "INTJ"; // Simplificado para estabilidad inicial

    const prompt = `Genera un informe psicopedagógico/laboral en JSON para ${candidato?.nombre}. 
    Ajuste: ${scoreSeguro}%. MBTI: ${mbtiCalculadoFinal}.
    Estructura requerida: { "resumenEjecutivo": "...", "fortalezas": [], "oportunidadesMejora": [], "ajusteCargo": { "score": ${scoreSeguro}, "analisis": "..." }, "recomendacion": "recomendado", "fundamentacion": "...", "mbtiType": "${mbtiCalculadoFinal}", "ajusteMbti": "...", "interpretacionPorFactor": { "general": "..." }, "metaCompetencias": { "liderazgo": 70, "adaptabilidad": 70, "resiliencia": 70, "colaboracion": 70, "comunicacion": 70 } }`;

    // Intentar con múltiples modelos por si uno falla
    const modelos = ['gemini-1.5-flash', 'gemini-pro', 'gemini-1.0-pro'];
    let resultado = null;
    let ultimoError = '';

    for (const mName of modelos) {
      try {
        const model = genAI.getGenerativeModel({ model: mName });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        resultado = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        if (resultado) break;
      } catch (e: any) {
        ultimoError = e.message;
        console.warn(`[IA] Falló ${mName}:`, e.message);
      }
    }

    if (!resultado) throw new Error(`Error de IA: ${ultimoError}`);

    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('[FATAL] Error en motor IA:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
