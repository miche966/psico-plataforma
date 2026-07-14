import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60; // 60 segundos para evitar timeouts en plan Hobby de Vercel

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

    // 3.5 COMPILACIÓN DE DATOS DEL TEST DE FRASES INCOMPLETAS (SACKS)
    let analisisFrasesIncompletas = '';
    const frasesTestId = 'f7a8b9c0-d1e2-4356-abcd-888888888888';
    const sesionFrases = sesiones.find((s: any) => s.test_id === frasesTestId);
    if (sesionFrases && sesionFrases.puntaje_bruto) {
      const pb = sesionFrases.puntaje_bruto;
      analisisFrasesIncompletas = `
ANÁLISIS CUALITATIVO DE LA TÉCNICA DE FRASES INCOMPLETAS (SACKS/ROTTER):
- Dinámica Laboral & Toma de Decisiones: ${pb.analisisClinico?.dinamicaLaboral || 'N/A'}
- Relaciones Interpersonales & Autoridad: ${pb.analisisClinico?.interpersonal || 'N/A'}
- Estabilidad Emocional & Tolerancia a Frustración: ${pb.analisisClinico?.emocional || 'N/A'}
- Autoconcepto & Escala de Valores: ${pb.analisisClinico?.autoconcepto || 'N/A'}
- Fortalezas detectadas: ${Array.isArray(pb.conclusion?.fortalezas) ? pb.conclusion.fortalezas.join(', ') : 'N/A'}
- Áreas de atención: ${Array.isArray(pb.conclusion?.areasAtencion) ? pb.conclusion.areasAtencion.join(', ') : 'N/A'}
- Recomendación de gestión sugerida por esta técnica: ${pb.conclusion?.recomendacionGestion || 'N/A'}
`;
    }

    const prompt = `
Eres un Consultor Senior en Desarrollo Humano y Psicólogo Organizacional. Tu misión es redactar un informe ejecutivo de alta gama que sea profundamente humano, sumamente asertivo y estrictamente profesional.

REGLAS DE ORO DE REDACCIÓN (OBLIGATORIAS E INFLEXIBLES):
1. TONO: Cercano, empático, equilibrado y corporativo. Habla de comportamientos y situaciones, NO de puntajes ni números.
2. SIN TECNICISMOS NI JERGAS: Está estrictamente prohibido usar nombres de rasgos técnicos de personalidad (tales como "Extraversión", "Consciencia", "Amabilidad", "Neuroticismo", "Apertura"), siglas de pruebas ("Big Five", "DASS-21", "Sacks", "SJT"), o términos acartonados (como "resiliencia", "asertividad", "coherencia y fluidez", "riqueza de vocabulario", "seguridad al expresarse", "estructurar ideas complejas", "brechas cognitivas", "alineamiento operativo"). Traduce todo a un lenguaje cotidiano, fluido e inteligente (ej: en lugar de "Consciencia" di "capacidad para organizar el trabajo y hacer seguimiento"; en lugar de "Extraversión" di "facilidad para entablar diálogos y relacionarse"; en lugar de "Neuroticismo" di "estabilidad ante situaciones de presión"; en lugar de "seguridad al expresarse" di "estilo comunicativo directo y pausado").
3. SIN MAXIMALISMOS: Prohibido usar adjetivos absolutos o grandilocuentes como "idealmente", "meticulosamente", "crucial", "esencial", "vital", "clave", "excelente", "soberbia", "perfectamente", "clara", "genuina", "total", "óptima", "necesaria" o "crítica". Utiliza una redacción atenuada, equilibrada y profesional (ej: "tiende a", "muestra propensión a", "encuentra facilidad en", "es valorable su disposición para", "se siente más cómodo en").
4. ANONIMATO ABSOLUTO: No utilices el nombre del candidato en ninguna parte del análisis (tampoco en títulos como "Análisis de Candidato: [Nombre]"). Refiérete a él/ella únicamente como "el perfil", "la persona evaluada", "el postulante" o mediante estructuras impersonales.
5. COHERENCIA CON EL DICTAMEN: La "fundamentacion" debe ser honesta respecto al ajuste (${scoreFinal}%). Si el puntaje es bajo, explica de forma humana por qué el estilo del candidato difiere de las demandas del puesto (ej: ritmos, necesidades de guía, autonomía), sin usar etiquetas negativas ni juicios de valor.
6. ESTRUCTURA DE ANÁLISIS: Cada punto debe explicar qué se observa, cómo actúa la persona y qué impacto tiene esto en el trabajo diario.
7. SIN META-LENGUAJE NI EXCUSAS DE DATOS FALTANTES: No escribas "Basado en los datos...", "El informe indica...". Tampoco redactes advertencias sobre que la información está "incompleta", "ausente", "insuficiente", o que haces "inferencias de cómo se abordarían si estuvieran disponibles". Si ciertos tests o datos no están presentes (ej: si no hay Big Five o transcripciones), simplemente redacta el informe analizando los datos disponibles (como el porcentaje de coincidencia o las simulaciones completadas) con fluidez natural, sin hacer ninguna mención o disculpa por lo que falta.
8. INTEGRACIÓN DE FRASES INCOMPLETAS (SI APLICA): Si se provee la sección de datos de Frases Incompletas Sacks abajo, debes integrar y fusionar dichos hallazgos cualitativos (por ejemplo, su temor al error en autoconcepto, el respeto o inhibición ante la autoridad, y su tendencia a la cordialidad para evitar la confrontación interpersonal) de forma sumamente orgánica y atenuada dentro del Resumen Ejecutivo, las Fortalezas, las Oportunidades de Mejora y las Recomendaciones de gestión. No utilices jergas psicológicas ni menciones el test por su nombre.
9. SIN REFERENCIAS AL SOPORTE TECNOLÓGICO: Está estrictamente prohibido usar palabras como "video", "cámara", "grabación", "audio", "plataforma", "videoentrevista" o cualquier término que mencione la interfaz de software en los textos generados. Cuando analices las respuestas o el comportamiento observado en la entrevista, debes describirlo de forma implícita e integrada como "interacción directa", "comunicación discursiva", "estilo verbal", "comportamiento no verbal" o "presencia interactiva".

CONTEXTO DEL PUESTO: ${proceso?.cargo || 'N/A'}
AJUSTE ESTIMADO: ${scoreFinal}%
PERFIL CONDUCTUAL (MBTI): ${mbtiType}

DATOS PARA ANÁLISIS (FACTORES PSICOMÉTRICOS):
${JSON.stringify(factoresCrudos)}

${analisisFrasesIncompletas ? `DATOS CUALITATIVOS ADICIONALES (TEST DE FRASES INCOMPLETAS SACKS):\n${analisisFrasesIncompletas}\n` : ''}

GUÍA DE INTERPRETACIÓN DE FACTORES (MUY IMPORTANTE PARA EVITAR CONTRADICCIONES):
- Factores de Protección (Mayor puntaje es SALUDABLE/ÓPTIMO, menor puntaje [ej: < 2.5] es CRÍTICO/DESFAVORABLE):
  * "equilibrio" (Balance Vida-Trabajo): 5.0 es balance excelente. Puntajes bajos (ej: 1.0 - 2.0) representan un desbalance severo e invasión de la vida personal por lo laboral. Redacta un análisis de conflicto/agobio.
  * "relaciones" (Relaciones Interpersonales): 5.0 es clima de gran confianza y sociabilidad. Puntajes bajos (ej: 1.0 - 2.0) representan aislamiento, dificultades relacionales o tensión en el clima. Redacta un análisis de aislamiento/distancia.
  * "claridad_rol" (Claridad de funciones): 5.0 es conocimiento pleno del rol. Puntajes bajos (ej: 1.0 - 2.0) indican alta ambigüedad de funciones e inseguridad que requiere de guías estructuradas externas.
  * "autonomia": 5.0 es alta autogestión e independencia. Puntajes bajos (ej: 1.0 - 2.0) indican dependencia y necesidad de supervisión constante.
  * "expectativas" (Alineación con el rol): 5.0 es alta motivación. Puntajes bajos indican brecha y desmotivación con la propuesta de valor.
  * "resiliencia": 5.0 es adaptabilidad soberbia a la crisis. Puntajes bajos indican vulnerabilidad emocional y necesidad de validación externa.
  * "autoesteem" / "autoestima": 5.0 es alta seguridad. Puntajes bajos representan inseguridad técnica y temor marcado a cometer errores.

- Factores de Riesgo (Menor puntaje es SALUDABLE/ÓPTIMO, mayor puntaje [ej: > 3.0] es CRÍTICO/DESFAVORABLE):
  * "burnout" (Agotamiento crónico): 1.0 es vitalidad y energía excelente. Puntajes altos (ej: 4.0 - 5.0) indican un desgaste emocional y físico severo que pone en riesgo la operativa.
  * "nivel_estres" / "estres" (Tensión operativa): 1.0 es calma operativa óptima. Puntajes altos indican un estado de tensión y agobio severo bajo demanda.
  * "carga_laboral" (Saturación de tareas): 1.0 es volumen de trabajo cómodo y manejable. Puntajes altos indican sobrecarga, saturación and desorganización operativa.

${discursoVideos ? `TRANSCRIPCIONES Y DISCURSO DE LA VIDEO-ENTREVISTA CONDUCTUAL:\n${discursoVideos}` : ''}

INSTRUCCIÓN ESPECIAL PARA ENTREVISTA LABORAL INTEGRADA:
Si las transcripciones de la entrevista están provistas arriba, realiza un análisis clínico integrado y redacta 5 párrafos cualitativos detallados que formarán el "Perfil de Entrevista Laboral Integrada", mapeando el comportamiento del candidato en las 5 dimensiones clave. Respeta estrictamente la Regla de Oro número 9: no menciones en ningún momento el medio de grabación (video, cámara, micrófono, etc.). Si no hay transcripciones provistas, devuelve null en esa propiedad.

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

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    
    let resultado: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const rawJson = jsonMatch ? jsonMatch[0] : text;
      resultado = JSON.parse(rawJson);
    } catch (parseError: any) {
      console.warn("Fallo el parseo inicial del informe, saneando caracteres...", parseError.message);
      try {
        // Sanitizar barras invertidas que no formen escapes válidos y caracteres de control
        const saneado = text
          .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
          .replace(/[\n\r]/g, ' ');
        const jsonMatch = saneado.match(/\{[\s\S]*\}/);
        resultado = JSON.parse(jsonMatch ? jsonMatch[0] : saneado);
      } catch (secondError: any) {
        throw new Error(`Estructura JSON inválida devuelta por el modelo: ${secondError.message}`);
      }
    }

    resultado.ajusteCargo.score = scoreFinal;
    return NextResponse.json(resultado);

  } catch (error: any) {
    console.error('[FATAL ERROR]:', error.message);
    let errorMsg = error.message || 'Error desconocido';
    if (errorMsg.includes('dunning') || errorMsg.includes('billing') || errorMsg.includes('403')) {
      errorMsg = 'La clave de Gemini API está temporalmente inhabilitada por Google Cloud debido a un problema de facturación del proyecto (tarjeta rechazada o saldo pendiente). Por favor, verifique la facturación en su consola de Google Cloud.';
    } else if (errorMsg.includes('credits') || errorMsg.includes('depleted') || errorMsg.includes('429')) {
      errorMsg = 'Los créditos prepagos de tu cuenta de Gemini API se han agotado por completo (Prepayment credits are depleted). Por favor, ingresa a tu consola de Google AI Studio (https://aistudio.google.com/) o de Google Cloud y recarga saldo en tu cuenta de facturación.';
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
