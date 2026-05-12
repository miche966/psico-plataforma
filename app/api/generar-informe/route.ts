import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    console.log('[DEBUG] Recibiendo petición para generar informe...');
    const payload = await req.json();
    const { candidato, proceso, sesiones } = payload;

    if (!candidato || !sesiones) {
        console.error('[ERROR] Datos insuficientes en el payload');
        return NextResponse.json({ error: 'Faltan datos del candidato o sesiones.' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('[ERROR] GEMINI_API_KEY no configurada');
      return NextResponse.json({ error: 'Configuración de API incompleta.' }, { status: 500 });
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

    console.log('[DEBUG] Calculando score matemático...');
    let scoreMatematico = 0;
    const reqs = proceso?.competencias_requeridas || [];
    
    if (reqs.length > 0) {
      const pcts: number[] = [];
      reqs.forEach((r: any) => {
        let valCand = 2.5;
        const mapping = COMPETENCIAS_MAPPING[r.competencia];
        sesiones.forEach((s: any) => {
          const d = s.puntaje_bruto?.por_factor || s.puntaje_bruto || {};
          const k = r.competencia?.toLowerCase()?.trim();
          if (d[k]) valCand = d[k];
          else if (mapping) {
             Object.entries(mapping).forEach(([mk, mv]) => { if (d[mk]) valCand = d[mk]; });
          }
        });
        pcts.push(Math.min(100, Math.round((valCand / (r.nivel || 3)) * 100)));
      });
      scoreMatematico = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    }
    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico;

    console.log('[DEBUG] Estimando MBTI...');
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

    console.log('[DEBUG] Llamando a Gemini...');
    const prompt = `Contexto: ${candidato.nombre} - Score: ${scoreSeguro}% - MBTI: ${mbtiCalculadoFinal}. 
    Resultados: ${JSON.stringify(sesiones.map(s => ({ id: s.test_id, p: s.puntaje_bruto })))}
    Genera un informe psicométrico en JSON con: resumenEjecutivo, fortalezas(3-5), oportunidadesMejora(2-4), ajusteCargo{score, analisis}, recomendacion, fundamentacion, mbtiType, ajusteMbti, interpretacionPorFactor, metaCompetencias.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log('[DEBUG] Respuesta de IA recibida, parseando...');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const resultado = JSON.parse(jsonStr);

    console.log('[DEBUG] Informe generado con éxito');
    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('[FATAL ERROR] Error en route.ts:', error.message);
    console.error(error.stack);
    return NextResponse.json({ 
        error: 'Error interno en el motor de IA.', 
        detalle: error.message 
    }, { status: 500 });
  }
}
