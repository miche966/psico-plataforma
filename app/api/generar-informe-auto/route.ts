import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 60; // Evitar timeouts

// Diccionario de factores psicométricos humanizados
const ETQ: Record<string, string> = {
  // Personalidad (Big Five)
  extraversion: 'Nivel de Interacción y Sociabilidad',
  amabilidad: 'Calidez y Trato Interpersonal',
  responsabilidad: 'Compromiso, Orden y Autogestión',
  neuroticismo: 'Estabilidad Emocional ante la Presión',
  apertura: 'Disposición al Cambio y Aprendizaje',
  honestidad_humildad: 'Honestidad y Humildad',
  honestidad: 'Sinceridad y Franqueza',
  normas: 'Apego a Normas y Ética',
  promedio_general: 'Índice de Integridad Personal',
  
  // Cognitivo y Atención
  correctas: 'Efectividad Cognitiva',
  percentil: 'Rango Comparativo (Percentil)',
  score: 'Puntuación Global',
  documentos: 'Gestión Documental',
  comparacion: 'Velocidad de Procesamiento',
  concentracion: 'Nivel de Foco y Concentración',
  errores_texto: 'Precisión en Datos de Texto',
  errores_numeros: 'Precisión en Datos Numéricos',
  metricas_fraude: 'Índice de Sinceridad Laboral',

  // Competencias Profesionales (SJT)
  etica: 'Ética y Valores Profesionales',
  negociacion: 'Capacidad de Negociación',
  manejo_emocional: 'Inteligencia Emocional',
  tolerancia_frustracion: 'Tolerancia a la Presión',
  comunicacion: 'Comunicación Efectiva',
  liderazgo: 'Liderazgo Estratégico',
  trabajo_equipo: 'Trabajo en Equipo y Sinergia',
  adaptabilidad: 'Adaptabilidad al Cambio',
  resolucion_problemas: 'Resolución de Problemas Complejos',
  
  // Salud y Bienestar Laboral
  burnout: 'Nivel de Bienestar y Energía',
  equilibrio: 'Balance Vida-Trabajo',
  relaciones: 'Relaciones Interpersonales y Clima',
  claridad_rol: 'Claridad de Funciones y Rol',
  nivel_estres: 'Indicador de Calma Operativa',
  carga_laboral: 'Gestión de la Demanda de Trabajo',
  autonomia: 'Autonomía y Control de Procesos',
  expectativas: 'Alineamiento de Expectativas',
  resiliencia: 'Capacidad de Resiliencia',
  manejo_estres: 'Gestión Situacional de Estrés',
  autoestima: 'Confianza y Autoestima Profesional',
  inteligencia_emocional: 'Inteligencia Emocional (IE)',
};

const SYSTEM_PROMPT = `
Eres un Consultor Senior en Desarrollo Humano y Psicólogo Organizacional. Tu misión es redactar un informe ejecutivo de alta gama que sea profundamente humano pero estrictamente profesional.

REGLAS DE ORO DE REDACCIÓN:
1. TONO: Cercano, empático y profesional. Habla de comportamientos y situaciones, NO de puntajes.
2. SIN TECNICISMOS NI JERGAS: Prohibido usar términos como "neuroticismo", "resiliencia", "alineamiento operativo", "ritmo de procesamiento", "brechas cognitivas", "sinergia" o nombres de tests. Traduce esto a lenguaje cotidiano profesional (ej: "estilo de trabajo", "forma de realizar las tareas", "atención frecuente").
3. SIN MAXIMALISMOS: Evita palabras absolutas como "clara", "genuina", "total", "esencial", "óptima", "necesaria" o "crítica". Usa un lenguaje moderado y equilibrado (ej: "se aprecia una tendencia a", "se siente más cómodo en", "encontraría mayor facilidad").
4. ANONIMATO: No utilices el nombre del candidato en ninguna parte del análisis. Refiérete a él/ella como "el perfil", "la persona evaluada" o mediante estructuras impersonales.
5. COHERENCIA CON EL DICTAMEN: La "fundamentacion" debe ser honesta respecto al ajuste. Si el puntaje es bajo, explica de forma humana por qué el estilo del candidato difiere de las demandas del puesto (ej: ritmos, necesidades de guía, autonomía), sin usar etiquetas negativas ni juicios de valor.
6. ESTRUCTURA DE ANÁLISIS: Cada punto debe explicar qué se observa, cómo actúa la persona y qué impacto tiene esto en el trabajo diario.
7. SIN META-LENGUAJE: No escribas "Basado en los datos...", "El informe indica...". Escribe el análisis directo.
8. INTEGRACIÓN DE FRASES INCOMPLETAS (SI APLICA): Si se provee la sección de datos de Frases Incompletas Sacks abajo, debes integrar y fusionar dichos hallazgos cualitativos de forma sumamente orgánica y atenuada dentro del Resumen Ejecutivo, las Fortalezas, las Oportunidades de Mejora y las Recomendaciones de gestión. No utilices jergas psicológicas ni menciones el test por su nombre.
9. SIN REFERENCIAS AL SOPORTE TECNOLÓGICO: Está estrictamente prohibido usar palabras como "video", "cámara", "grabación", "audio", "plataforma", "videoentrevista" o cualquier término que mencione la interfaz de software en los textos generados. Cuando analices las respuestas o el comportamiento observado en la entrevista, debes describirlo de forma implícita e integrada como "interacción directa", "comunicación discursiva", "estilo verbal", "comportamiento no verbal" o "presencia interactiva".
`;

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const { candidatoId, procesoId } = payload

    if (!candidatoId || !procesoId) {
      return NextResponse.json({ error: 'Faltan parámetros candidatoId y procesoId.' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta la llave de API de Gemini.' }, { status: 500 })
    }

    // Inicializar Supabase Admin
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // 1. Verificar si ya existe el informe generado en la base de datos
    const { data: informeExistente } = await supabaseAdmin
      .from('informes_psicometricos')
      .select('id')
      .eq('candidato_id', candidatoId)
      .single()

    if (informeExistente) {
      return NextResponse.json({ success: true, message: 'El informe ya existía en la base de datos.' })
    }

    // 2. Traer información del candidato
    const { data: candidato, error: errCand } = await supabaseAdmin
      .from('candidatos')
      .select('*')
      .eq('id', candidatoId)
      .single()

    if (errCand || !candidato) {
      return NextResponse.json({ error: 'Candidato no encontrado en la base de datos.' }, { status: 404 })
    }

    // 3. Traer información del proceso
    const { data: proceso, error: errProc } = await supabaseAdmin
      .from('procesos')
      .select('*')
      .eq('id', procesoId)
      .single()

    if (errProc || !proceso) {
      return NextResponse.json({ error: 'Proceso no encontrado en la base de datos.' }, { status: 404 })
    }

    // 4. Traer todas las sesiones del candidato
    const { data: sesiones, error: errSes } = await supabaseAdmin
      .from('sesiones')
      .select('*')
      .eq('candidato_id', candidatoId)
      .eq('proceso_id', procesoId)

    if (errSes || !sesiones || sesiones.length === 0) {
      return NextResponse.json({ error: 'No se encontraron sesiones de evaluación.' }, { status: 404 })
    }

    // 5. Traer las respuestas de videoentrevistas
    const { data: videos } = await supabaseAdmin
      .from('respuestas_video')
      .select('*, preguntas_video(*)')
      .eq('candidato_id', candidatoId)
      .eq('proceso_id', procesoId)

    // 6. Calcular el ajuste en base a los pesos del proceso
    let matchScore = 0
    let countMatch = 0
    sesiones.forEach(s => {
      if (s.estado === 'finalizado' && s.puntaje_bruto) {
        let testScore = 0
        if (s.puntaje_bruto.score != null) {
          testScore = Number(s.puntaje_bruto.score)
        } else if (s.puntaje_bruto.promedio_general != null) {
          testScore = Number(s.puntaje_bruto.promedio_general) * 20
        } else if (s.puntaje_bruto.por_factor) {
          const values = Object.values(s.puntaje_bruto.por_factor) as number[]
          if (values.length > 0) {
            testScore = (values.reduce((a, b) => a + b, 0) / values.length) * 20
          }
        }
        if (testScore > 0) {
          matchScore += testScore
          countMatch++
        }
      }
    })
    const scoreFinal = countMatch > 0 ? Math.round(matchScore / countMatch) : 60

    // Estimar tipo MBTI
    const sesionBigFive = sesiones.find(s => s.test_id === 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    let mbtiType = 'ENFJ' // Default
    if (sesionBigFive?.puntaje_bruto) {
      const pb = sesionBigFive.puntaje_bruto
      const findVal = (key: string) => {
        let found = 2.5
        const searchVal = (obj: any) => {
          Object.entries(obj).forEach(([f, v]) => {
            if (f.toLowerCase().includes(key)) {
              found = ((v as any)?.correctas ? ((v as any).correctas / ((v as any).total || 1)) * 5 : (typeof v === 'number' ? v : 0)) || 2.5
            } else if (typeof v === 'object' && v !== null) {
              searchVal(v)
            }
          })
        }
        searchVal(pb)
        return found
      }
      const E = findVal('extraver') >= 2.7 ? 'E' : 'I'
      const S = findVal('apertura') < 2.7 ? 'S' : 'N'
      const T = findVal('amabilid') < 2.7 ? 'T' : 'F'
      const J = findVal('responsab') >= 2.7 ? 'J' : 'P'
      mbtiType = `${E}${S}${T}${J}`
    }

    // 7. Compilar factores relacionales
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

    // Compilar transcripciones de video
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

    // Compilar Frases Incompletas
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

    // Generar prompt
    const prompt = `
${SYSTEM_PROMPT}

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
  * "claridad_rol" (Claridad de funciones): 5.0 es conocimiento preliminar. Puntajes bajos (ej: 1.0 - 2.0) indican alta ambigüedad de funciones e inseguridad que requiere de guías estructuradas.
  * "autonomia": 5.0 es alta autogestión e independencia. Puntajes bajos (ej: 1.0 - 2.0) indican dependencia y necesidad de supervisión constante.
  * "expectativas" (Alineación con el rol): 5.0 es alta motivación. Puntajes bajos indican brecha y desmotivación con la propuesta de valor.
  * "resiliencia": 5.0 es adaptabilidad soberbia a la crisis. Puntajes bajos indican vulnerabilidad emocional y necesidad de validación externa.
  * "autoesteem" / "autoestima": 5.0 es alta seguridad. Puntajes bajos representan inseguridad técnica y temor marcado a cometer errores.

- Factores de Riesgo (Menor puntaje es SALUDABLE/ÓPTIMO, mayor puntaje [ej: > 3.0] es CRÍTICO/DESFAVORABLE):
  * "burnout" (Agotamiento crónico): 1.0 es vitalidad and energía excelente. Puntajes altos (ej: 4.0 - 5.0) indican un desgaste emocional y físico severo que pone en riesgo la operativa.
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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = (await result.response).text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const rawRes = JSON.parse(jsonMatch ? jsonMatch[0] : text)

    rawRes.ajusteCargo.score = scoreFinal

    // 8. Humanizador y filtro de estilo (Replicado de la visualización)
    const humanizar = (t: string) => {
      if (!t || typeof t !== 'string') return t
      let limpio = t.replace(/\*\*/g, '')

      if (candidato?.nombre) {
        const nombreEscaped = candidato.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regexNombre = new RegExp(nombreEscaped, 'gi')
        limpio = limpio.replace(regexNombre, 'El candidato')
      }

      Object.entries(ETQ).forEach(([key, label]) => {
        const variant = key.replace(/_/g, '[\\s\\-_]')
        const regex = new RegExp(`\\b${variant}\\b`, 'gi')
        limpio = limpio.replace(regex, label.toLowerCase())
      })

      const prohibidas: Record<string, string> = {
        'arquitectura conductual': 'estilo de trabajo',
        'arquitectura mental': 'estilo de pensamiento',
        'arquitectura': 'estilo de comportamiento',
        'eficiencia cognitiva': 'efectividad operativa',
        'recurso': 'profesional',
        'un recurso': 'un perfil',
        'como recurso': 'como profesional',
        'profunda adherencia': 'adherencia consistente',
        'manejo excepcional': 'manejo efectivo',
        'inteligencia emocional': 'estabilidad emocional',
        'IE aplicada': 'gestión de emociones',
        'apego a normas y ética': 'sentido ético',
        'solvencia': 'adecuación',
        'destacada': 'notable',
        'consistente': 'clara',
        'excepcional': 'destacada',
        'sobresaliente': 'notable',
        'superior': 'destacado',
        'dominio superior': 'manejo adecuado',
        'capacidad superior': 'capacidad clara',
        'resiliencia excepcional': 'resiliencia consistente',
        'adherencia inquebrantable': 'adherencia consistente',
        'decisiones objetiva': 'decisiones objetivas',
        'DASS-21': 'bienestar emocional',
        'DASS21': 'bienestar emocional',
        'MBTI': 'perfil conductual',
        'ICAR': 'capacidad cognitiva',
        'SJT': 'juicio situacional',
        'discurso inferido': 'comunicación observada',
        'magnífico': 'adecuado',
        'maravilloso': 'positivo',
        'increíble': 'relevante',
        'proclive': 'tiende a',
        'deficitario': 'con áreas de mejora',
        'óptimo': 'adecuado',
        'máximo': 'alto'
      }
      
      Object.entries(prohibidas).forEach(([mal, bien]) => {
        const regex = new RegExp(`\\b${mal}\\b`, 'gi')
        limpio = limpio.replace(regex, bien)
      })

      limpio = limpio
        .replace(/NaN/g, 'adecuado')
        .replace(/PUNTAJE DE AJUSTE/gi, 'nivel de adecuación')
        .trim()

      limpio = limpio.replace(/(^\s*\w|[\.\!\?]\s+\w)/g, c => c.toUpperCase())
      return limpio
    }

    const nuevoInforme = {
      ...rawRes,
      fundamentacion: humanizar(rawRes.fundamentacion),
      fortalezas: (rawRes.fortalezas || []).map((f: any) => {
        if (typeof f === 'string') return humanizar(f)
        return {
          tendencia: humanizar(f.tendencia || ''),
          mecanismo: humanizar(f.mecanismo || ''),
          impacto_organizacional: humanizar(f.impacto_organizacional || '')
        }
      }),
      oportunidadesMejora: (rawRes.oportunidadesMejora || rawRes.areasDesarrollo || []).map((f: any) => {
        if (typeof f === 'string') return humanizar(f)
        return {
          tendencia: humanizar(f.tendencia || ''),
          mecanismo: humanizar(f.mecanismo || ''),
          impacto_organizacional: humanizar(f.impacto_organizacional || '')
        }
      }),
      interpretacionPorFactor: Object.fromEntries(
        Object.entries(rawRes.interpretacionPorFactor || {}).map(([k, v]) => [k, humanizar(v as string)])
      ),
      ajusteCargo: {
        score: scoreFinal, 
        analisis: humanizar(rawRes.ajusteCargo?.analisis || rawRes.fundamentacion || '')
      },
      ajusteMbti: humanizar(rawRes.ajusteMbti || ''),
      recomendacion: scoreFinal >= 85 ? 'recomendado' : scoreFinal >= 70 ? 'con_reservas' : 'no_recomendado',
      liderazgo: rawRes.metaCompetencias?.liderazgo || 50,
      adaptabilidad: rawRes.metaCompetencias?.adaptabilidad || 50,
      resiliencia: rawRes.metaCompetencias?.resiliencia || 50,
      colaboracion: rawRes.metaCompetencias?.colaboracion || 50,
      comunicacion: rawRes.metaCompetencias?.comunicacion || 50,
      analisisEntrevista: rawRes.analisisEntrevista ? {
        trayectoriaMotivacion: humanizar(rawRes.analisisEntrevista.trayectoriaMotivacion),
        estiloTrabajoAutoridad: humanizar(rawRes.analisisEntrevista.estiloTrabajoAutoridad),
        gestionConflictos: humanizar(rawRes.analisisEntrevista.gestionConflictos),
        resilienciaFrustracion: humanizar(rawRes.analisisEntrevista.resilienciaFrustracion),
        autoconceptoMetas: humanizar(rawRes.analisisEntrevista.autoconceptoMetas)
      } : null
    }

    // 9. Guardar directamente en informes_psicometricos
    const { error: errUpsert } = await supabaseAdmin
      .from('informes_psicometricos')
      .upsert({
        candidato_id: candidatoId,
        contenido: nuevoInforme,
        actualizado_en: new Date().toISOString()
      }, { onConflict: 'candidato_id' })

    if (errUpsert) throw errUpsert

    // 10. Actualizar recomendación del candidato directamente
    await supabaseAdmin
      .from('candidatos')
      .update({ recomendacion: nuevoInforme.recomendacion })
      .eq('id', candidatoId)

    return NextResponse.json({ success: true, message: 'Informe generado e integrado de forma automática en background.' })

  } catch (error: any) {
    console.error('[AUTO GENERATE ERROR]:', error.message)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}
