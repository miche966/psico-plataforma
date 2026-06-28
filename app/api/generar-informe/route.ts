import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { candidato, proceso, sesiones, actual, videos } = payload;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta llave de API.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 1. SINCRONIZACIÓN DE SCORE Y MBTI
    let scoreFinal = actual?.ajusteCargo?.score || 0;
    const mbtiType = actual?.mbtiType || 'N/A';
    
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

    // 3. COMPILACIÓN DE TRANSCRIPCIONES DE VIDEO-ENTREVISTAS
    let discursoVideos = '';
    const tieneVideos = videos && Array.isArray(videos) && videos.length > 0;
    if (tieneVideos) {
      videos.forEach((v: any, index: number) => {
        const preg = v.preguntas_video?.pregunta || `Pregunta ${index + 1}`;
        const trans = v.transcripcion || '';
        const act = v.analisis_ia ? (typeof v.analisis_ia === 'string' ? v.analisis_ia : JSON.stringify(v.analisis_ia)) : '';
        if (trans.trim()) {
          discursoVideos += `PREGUNTA: ${preg}\nTRANSCRIPCIÓN RESPUESTA DEL CANDIDATO: "${trans}"\nACTITUD OBSERVADA: ${act}\n\n`;
        }
      });
    }

    const prompt = `
Eres un Consultor Senior en Desarrollo Humano y Psicólogo Organizacional. Tu misión es redactar un informe ejecutivo de alta gama que sea profundamente humano pero estrictamente profesional.

REGLAS DE ORO DE REDACCIÓN:
1. TONO: Cercano, empático y profesional. Habla de comportamientos y situaciones, NO de puntajes.
2. SIN TECNICISMOS NI JERGAS: Prohibido usar términos como "neuroticismo", "resiliencia", "alineamiento operativo", "ritmo de procesamiento", "brechas cognitivas", "sinergia" o nombres de tests. Traduce esto a lenguaje cotidiano profesional (ej: "estilo de trabajo", "forma de realizar las tareas", "atención frecuente").
3. SIN MAXIMALISMOS: Evita palabras absolutas como "clara", "genuina", "total", "esencial", "óptima", "necesaria" o "crítica". Usa un lenguaje moderado y equilibrado (ej: "se aprecia una tendencia a", "se siente más cómodo en", "encontraría mayor facilidad").
4. ANONIMATO: No utilices el nombre del candidato en ninguna parte del análisis. Refiérete a él/ella como "el perfil", "la persona evaluada" o mediante estructuras impersonales.
5. COHERENCIA CON EL DICTAMEN: La "fundamentacion" debe ser honesta respecto al ajuste (${scoreFinal}%). Si el puntaje es bajo, explica de forma humana por qué el estilo del candidato difiere de las demandas del puesto (ej: ritmos, necesidades de guía, autonomía), sin usar etiquetas negativas ni juicios de valor.
6. ESTRUCTURA DE ANÁLISIS: Cada punto debe explicar qué se observa, cómo actúa la persona y qué impacto tiene esto en el trabajo diario.
7. SIN META-LENGUAJE: No escribas "Basado en los datos...", "El informe indica...". Escribe el análisis directo.

CONTEXTO DEL PUESTO: ${proceso?.cargo || 'N/A'}
AJUSTE ESTIMADO: ${scoreFinal}%
PERFIL CONDUCTUAL (MBTI): ${mbtiType}

DATOS PARA ANÁLISIS (FACTORES PSICOMÉTRICOS):
${JSON.stringify(factoresCrudos)}

${discursoVideos ? `TRANSCRIPCIONES Y DISCURSO DE LA VIDEO-ENTREVISTA CONDUCTUAL:\n${discursoVideos}` : ''}

INSTRUCCIÓN ESPECIAL PARA VIDEO-ENTREVISTA:
Si las transcripciones de la video-entrevista están provistas arriba, realiza un análisis clínico integrado y redacta 5 párrafos cualitativos detallados que formarán el "Perfil de Entrevista Laboral Integrada", mapeando el comportamiento del candidato en las 5 dimensiones clave. Si no hay transcripciones provistas, devuelve null en esa propiedad.

Devuelve UNICAMENTE un objeto JSON con esta estructura:
{
  "resumenEjecutivo": "Análisis integrador de la persona frente al desafío laboral (Mínimo 3 párrafos).",
  "fortalezas": [{"tendencia": "Comportamiento observado", "mecanismo": "Forma de actuar", "impacto_organizacional": "Valor para la empresa"}],
  "oportunidadesMejora": [{"tendencia": "Punto de atención", "mecanismo": "Situación de riesgo", "impacto_organizacional": "Consecuencia operativa"}],
  "ajusteCargo": { "score": ${scoreFinal}, "analisis": "Explicación humana de por qué el perfil encaja o no con las demandas del puesto." },
  "ajusteMbti": "Análisis descriptivo y humano de cómo el perfil ${mbtiType} se adapta específicamente a las tareas y desafíos de la posición de ${proceso?.cargo || 'N/A'}.",
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
  },
  "analisisEntrevista": ${tieneVideos ? `{
    "trayectoriaMotivacion": "Un párrafo sobre trayectoria, estabilidad y motivación laboral del perfil.",
    "estiloTrabajoAutoridad": "Un párrafo sobre estilo de trabajo y relación de subordinación con la autoridad.",
    "gestionConflictos": "Un párrafo sobre su capacidad en front-office y gestión de situaciones conflictivas.",
    "resilienciaFrustracion": "Un párrafo sobre sus mecanismos de resiliencia y tolerancia a la frustración.",
    "autoconceptoMetas": "Un párrafo sobre su autoconcepto, madurez y proyección profesional de cara al puesto."
  }` : 'null'}
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
