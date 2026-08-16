import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { estimarMBTIDesdeSesiones } from '@/lib/baremos'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { calcularMetaCompetencias } from '@/lib/metaCompetencias'
import { detectarRedundanciaNarrativa, detectarFrasesTematicamenteRedundantes } from '@/lib/informeConsistencia'
import { construirFactoresCrudos } from '@/lib/informeFactores'

// Con Fluid Compute (activo por defecto en el proyecto, confirmado en el dashboard: Function Max
// Duration = 300s) el plan Hobby ya no está limitado a 60s reales — ese límite quedó obsoleto y
// era el propio código el que se lo autoimponía. Se deja margen (280 de 300) por si la latencia
// de red/plataforma agrega unos segundos por fuera de las 3 llamadas a Gemini.
export const maxDuration = 280;

// Llama a Gemini con reintentos ante error de red/API (backoff exponencial, hasta 3 intentos) y,
// una vez obtenida una respuesta, reintenta una vez más si el JSON viene incompleto o inválido.
// Extraído para poder correr dos secciones del informe en paralelo (ver Llamada 1A/1B en POST)
// sin duplicar esta lógica de reintentos dos veces.
async function generarSeccionConReintentos(
  genAI: GoogleGenerativeAI,
  prompt: string,
  maxOutputTokens: number,
  etiqueta: string
): Promise<any> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { maxOutputTokens, responseMimeType: 'application/json' }
  });

  let result: any = null;
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[INFO] [GENERAR INFORME] ${etiqueta}: llamando a Gemini (intento ${attempts}/${maxAttempts})...`);
      const callStart = Date.now();
      result = await model.generateContent(prompt);
      const callDuration = ((Date.now() - callStart) / 1000).toFixed(2);
      console.log(`[INFO] [GENERAR INFORME] ${etiqueta}: intento ${attempts} exitoso en ${callDuration}s.`);
      break;
    } catch (err: any) {
      console.error(`[WARNING] [GENERAR INFORME] ${etiqueta}: error en intento ${attempts}:`, err.message || err);
      if (attempts >= maxAttempts) throw err;
      const delay = Math.pow(2, attempts) * 1000;
      console.log(`[INFO] [GENERAR INFORME] ${etiqueta}: reintentando en ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  if (!result) {
    throw new Error(`${etiqueta}: fallo la llamada a la API de Gemini tras superar los reintentos máximos.`);
  }

  let resultado: any;
  let ultimoError: Error | null = null;
  for (let parseAttempt = 1; parseAttempt <= 2; parseAttempt++) {
    const response = await result.response;
    const finishReason = response.candidates?.[0]?.finishReason;
    const text = response.text();
    try {
      if (finishReason === 'MAX_TOKENS') {
        throw new Error('La respuesta del modelo fue truncada por alcanzar el límite de salida.');
      }
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      const rawJson = firstBrace >= 0 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text.trim();
      resultado = JSON.parse(rawJson);
      break;
    } catch (parseError: any) {
      ultimoError = parseError instanceof Error ? parseError : new Error(String(parseError));
      console.warn(`[WARNING] [GENERAR INFORME] ${etiqueta}: JSON inválido (intento ${parseAttempt}/2):`, ultimoError.message);
      if (parseAttempt === 2) break;
      result = await model.generateContent(`${prompt}

REINTENTO OBLIGATORIO: la respuesta anterior no fue un JSON completo. Devuelve nuevamente el objeto completo, válido y cerrado. No uses Markdown, no agregues explicaciones y no cortes ninguna cadena.`);
    }
  }
  if (!resultado) {
    throw new Error(`${etiqueta}: estructura JSON inválida devuelta por el modelo: ${ultimoError?.message || 'respuesta vacía'}`);
  }
  return resultado;
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response

    const payload = await req.json();
    const { candidato, proceso, sesiones, actual, videos } = payload;
    if (!payload || JSON.stringify(payload).length > 500000) {
      return NextResponse.json({ error: 'El informe supera el tamaño permitido' }, { status: 413 });
    }
    if (!Array.isArray(sesiones) || sesiones.length > 500 || (videos !== undefined && (!Array.isArray(videos) || videos.length > 200))) {
      return NextResponse.json({ error: 'La estructura del informe no es válida' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Falta llave de API.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 1. SINCRONIZACIÓN DE SCORE Y MBTI
    let scoreFinal = actual?.ajusteCargo?.score || 0;
    const mbtiType = actual?.mbtiType || estimarMBTIDesdeSesiones(sesiones) || 'N/A';

    // 2. NORMALIZACIÓN Y EXTRACCIÓN DE FACTORES (EL "BUZÓN" UNIFICADO)
    const factoresCrudos = construirFactoresCrudos(sesiones);

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

    // 3.7 COMPILACIÓN DE DATOS DE SIMULACIÓN Y ROLE PLAY (COBRANZAS / ATENCIÓN)
    let analisisRolePlay = '';
    const sesionesRolePlay = sesiones.filter((s: any) =>
      s.puntaje_bruto && (
        s.puntaje_bruto.transcripcion ||
        s.puntaje_bruto.retroalimentacion ||
        s.puntaje_bruto.acuerdo_alcanzado !== undefined ||
        s.test_id === 'd8e9f0a1-b2c3-4567-defa-777777777777' ||
        s.test_id === 'c9d8e7f0-a1b2-3456-7890-123456789012'
      )
    );

    if (sesionesRolePlay.length > 0) {
      analisisRolePlay = 'ANÁLISIS CUALITATIVO DE LA DINÁMICA DE SIMULACIÓN Y ROLE PLAY (INTERACCIÓN EN TIEMPO REAL):\n';
      sesionesRolePlay.forEach((s: any, idx: number) => {
        const pb = s.puntaje_bruto;
        const retro = pb.retroalimentacion || 'N/A';
        const acuerdo = pb.acuerdo_alcanzado !== undefined ? (pb.acuerdo_alcanzado ? 'Acuerdo Viable Alcanzado' : 'No se cerró acuerdo') : 'N/A';

        let transcripTexto = '';
        if (Array.isArray(pb.transcripcion)) {
          transcripTexto = pb.transcripcion.map((m: any) => `${m.role === 'user' ? 'Candidato' : 'Interlocutor/Cliente'}: ${m.content}`).join('\n');
        } else if (typeof pb.transcripcion === 'string') {
          transcripTexto = pb.transcripcion;
        }

        analisisRolePlay += `SIMULACIÓN ${idx + 1}:\n- Resultado / Cierre: ${acuerdo}\n- Retroalimentación cualitativa del caso: ${retro}\n`;
        if (transcripTexto) {
          analisisRolePlay += `- Transcripción relevante del diálogo:\n${transcripTexto.slice(0, 1500)}\n`;
        }
        analisisRolePlay += '\n';
      });
    }

    // GUÍA DE INTERPRETACIÓN DE FACTORES: compartida por ambas llamadas (1A y 1B) porque las dos
    // necesitan saber, para cada factor, si un puntaje bajo es la señal de alerta o si lo es uno alto.
    const guiaInterpretacion = `GUÍA DE INTERPRETACIÓN DE FACTORES (MUY IMPORTANTE PARA EVITAR CONTRADICCIONES):
- Factores de Protección (Mayor puntaje es SALUDABLE/ÓPTIMO, menor puntaje [ej: < 2.5] es CRÍTICO/DESFAVORABLE):
  * "equilibrio" (Balance Vida-Trabajo): 5.0 es balance excelente. Puntajes bajos (ej: 1.0 - 2.0) representan un desbalance severo e invasión de la vida personal por lo laboral. Redacta un análisis de conflicto/agobio.
  * "relaciones" (Relaciones Interpersonales): 5.0 es clima de gran confianza y sociabilidad. Puntajes bajos (ej: 1.0 - 2.0) representan aislamiento, dificultades relacionales o tensión en el clima. Redacta un análisis de aislamiento/distancia.
  * "claridad_rol" (Claridad de funciones): 5.0 es conocimiento pleno del rol. Puntajes bajos (ej: 1.0 - 2.0) indican alta ambigüedad de funciones e inseguridad que requiere de guías estructuradas externas.
  * "autonomia": 5.0 es alta autogestión e independencia. Puntajes bajos (ej: 1.0 - 2.0) indican dependencia y necesidad de supervisión constante.
  * "expectativas" (Alineación con el rol): 5.0 es alta motivación. Puntajes bajos indican brecha y desmotivación con la propuesta de valor.
  * "resiliencia": 5.0 es adaptabilidad soberbia a la crisis. Puntajes bajos indican vulnerabilidad emocional y necesidad de validación externa.
  * "autoesteem" / "autoestima": 5.0 es alta seguridad. Puntajes bajos representan inseguridad técnica y temor marcado a cometer errores.

- Factores de Riesgo (Mayor puntaje es favorable; menor puntaje indica una situacion que conviene revisar):
  * "estabilidad_emocional" (Manejo de la presion): 5.0 indica estabilidad y buen manejo de la presion. Puntajes bajos indican mayor sensibilidad ante la presion y necesidad de apoyo.
  * "burnout" (Agotamiento crónico): 5.0 indica buen nivel de energía y bajo desgaste. Puntajes bajos indican mayor cansancio y señales de agotamiento que conviene atender.
  * "nivel_estres" / "estres" (Tensión operativa): 5.0 indica calma y buen manejo de la presión. Puntajes bajos indican mayor tensión y agobio ante la demanda.
  * "carga_laboral" (Saturación de tareas): 5.0 indica una carga de trabajo manejable. Puntajes bajos indican percepción de sobrecarga o dificultad para organizar la demanda.

- Factores Estándar (Mayor puntaje es directamente favorable, sin necesidad de inversión de escala):
  * "logro" (Orientación al logro): 5.0 indica alta motivación para fijarse y cumplir metas exigentes. Puntajes bajos (ej: 1.0 - 2.0) indican menor motivación de logro, se beneficia de objetivos concretos y seguimiento cercano.
  * "dinamismo" (Nivel de energía y ritmo de trabajo): 5.0 indica alta energía, capacidad de sostener varios frentes a la vez y reacción rápida. Puntajes bajos indican un estilo más pausado y reflexivo, que rinde mejor con tiempo para planificar.
  * "documentos", "comparacion", "concentracion", "errores_texto", "errores_numeros" (precisión y atención al detalle en tareas de oficina/soporte): 5.0 indica un desempeño prácticamente sin errores en ese tipo de tarea puntual. Puntajes bajos (ej: 0.0 - 1.5) indican una tasa de error alta y consistente en ese tipo de tarea específica — no un desliz aislado.
  * "series", "matrices", "rotacion" (razonamiento lógico/abstracto): 5.0 indica un desempeño sólido en ese tipo de problema. Puntajes bajos indican mayor dificultad puntual con ese formato de razonamiento.
  * "verbal_general", "numerico_general", "icar_general", "atencion_detalle_general" (desempeño global de la prueba cognitiva correspondiente, cuando no hay desglose más específico disponible): mismo criterio, 5.0 es un desempeño sólido, puntajes bajos indican mayor dificultad en ese tipo de tarea.

PROPORCIONALIDAD DEL LENGUAJE (REGLA CRÍTICA PARA "oportunidadesMejora" Y PARA LA DESCRIPCIÓN POR FACTOR — TIENE PRIORIDAD SOBRE LA REGLA DE ORO 3 CUANDO ENTRAN EN CONFLICTO):
La intensidad de la redacción debe reflejar la magnitud real del dato, dentro siempre de un tono profesional y nunca alarmista:
- Puntajes extremos (ej: 0.0 - 1.0 de 5, o un factor de riesgo con esa misma lectura desfavorable) representan una tasa de error o una dificultad consistente y frecuente en esa tarea puntual, no un desliz ocasional. Redacta con claridad que es un punto de atención genuino y con peso real. Evita en estos casos expresiones que minimizan la frecuencia o el impacto ("en momentos puntuales", "ocasionalmente", "alguna vez"): son coherentes solo para brechas moderadas (aprox. 2.5 - 3.5), no para un extremo.
- SI DOS FACTORES RELACIONADOS TIENEN PUNTAJES MUY DISTINTOS (ej: un 0.0 en uno y un 2.5 en otro, ambos del mismo tipo de tarea), NO los fusiones en una sola observación redactada al nivel del más leve de los dos — eso diluye la señal más grave. Trátalos por separado, o si van en el mismo ítem, que la redacción refleje primero y con más peso el extremo más bajo.
- No presentes como "oportunidad de mejora" un factor cuyo puntaje ya es alto (4.0 o más) solo para completar la cantidad de ítems esperada. Si los datos disponibles no muestran una brecha real, es preferible listar una sola oportunidad de mejora (o enmarcarla como un matiz dentro de una fortaleza ya sólida) antes que inventar una debilidad que el propio dato contradice.`;

    const datosFactores = `DATOS PARA ANÁLISIS (FACTORES PSICOMÉTRICOS):\n${JSON.stringify(factoresCrudos)}`;

    // LLAMADA 1A: fortalezas / oportunidadesMejora / ajusteCargo / recomendacion — la parte que combina
    // varios factores en observaciones de comportamiento integradas.
    const promptA = `
Eres un Consultor Senior en Desarrollo Humano y Psicólogo Organizacional. Tu misión es redactar la sección de fortalezas, áreas de desarrollo y ajuste al puesto de un informe ejecutivo de alta gama que sea profundamente humano, sumamente asertivo y strictly profesional.

REGLAS DE ORO DE REDACCIÓN (OBLIGATORIAS E INFLEXIBLES):
1. TONO: Cercano, empático, equilibrado y corporativo. Habla de comportamientos y situaciones, NO de puntajes ni números.
2. SIN TECNICISMOS NI JERGAS: Está strictly prohibido usar nombres de rasgos técnicos de personalidad (tales como "Extraversión", "Consciencia", "Amabilidad", "Neuroticismo", "Apertura"), siglas de pruebas ("Big Five", "DASS-21", "Sacks", "SJT"), o términos acartonados (como "resiliencia", "asertividad", "coherencia y fluidez", "riqueza de vocabulario", "seguridad al expresarse", "estructurar ideas complejas", "brechas cognitivas", "alineamiento operativo"). Traduce todo a un lenguaje cotidiano, fluido e inteligente (ej: en lugar de "Consciencia" di "capacidad para organizar el trabajo y hacer seguimiento"; en lugar de "Extraversión" di "facilidad para entablar diálogos y relacionarse"; en lugar de "Neuroticismo" di "estabilidad ante situaciones de presión"; en lugar de "seguridad al expresarse" di "estilo comunicativo directo y pausado").
3. SIN MAXIMALISMOS: Prohibido usar adjetivos absolutos o grandilocuentes como "idealmente", "meticulosamente", "crucial", "esencial", "vital", "clave", "excelente", "soberbia", "perfectamente", "clara", "genuina", "total", "óptima", "necesaria" o "crítica". Utiliza una redacción atenuada, equilibrada y profesional (ej: "tiende a", "muestra propensión a", "encuentra facilidad en", "es valorable su disposición para", "se siente más cómodo en"). EXCEPCIÓN OBLIGATORIA: esta atenuación aplica a puntajes moderados. Ante un puntaje extremo (0.0 - 1.0 de 5), la regla de PROPORCIONALIDAD DEL LENGUAJE de más abajo tiene prioridad sobre esta regla — no atenúes ni diluyas ese punto mezclándolo de forma genérica con un factor relacionado de puntaje distinto.
4. ANONIMATO ABSOLUTO: No utilices el nombre del candidato en ninguna parte del análisis. Refiérete a él/ella únicamente como "el perfil", "la persona evaluada", "el postulante" o mediante estructuras impersonales.
5. ESTRUCTURA DE ANÁLISIS: Cada punto debe explicar qué se observa, cómo actúa la persona y qué impacto tiene esto en el trabajo diario.
6. SIN META-LENGUAJE NI EXCUSAS DE DATOS FALTANTES: No escribas "Basado en los datos...", "El informe indica...". Tampoco redactes advertencias sobre que la información está "incompleta", "ausente", "insuficiente". Si ciertos datos no están presentes, simplemente redacta analizando los disponibles, sin mención ni disculpa por lo que falta.
7. INTEGRACIÓN DE FRASES INCOMPLETAS (SI APLICA): Si se provee la sección de datos de Frases Incompletas Sacks abajo, integra y fusiona dichos hallazgos cualitativos (temor al error en autoconcepto, respeto o inhibición ante la autoridad, tendencia a la cordialidad para evitar la confrontación interpersonal) de forma sumamente orgánica y atenuada dentro de las Fortalezas y las Oportunidades de Mejora. No utilices jergas psicológicas ni menciones el test por su nombre.
8. SIN REFERENCIAS AL SOPORTE TECNOLÓGICO: Está estrictamente prohibido usar palabras como "video", "cámara", "grabación", "audio", "plataforma", "videoentrevista". Describe lo observado como "interacción directa", "comunicación discursiva", "estilo verbal", "comportamiento no verbal" o "presencia interactiva".
9. INTEGRACIÓN INVISIBLE DE APORTES CUALITATIVOS Y SIMULACIONES (SI APLICA): Si se proveen datos de simulación, role play o transcripciones abajo, utilízalos EXCLUSIVAMENTE para enriquecer y matizar las conclusiones del perfil (estilo de persuasión, tolerancia ante la presión, búsqueda de consensos, escucha activa, manejo de objeciones). Queda ESTRICTAMENTE PROHIBIDO mencionar que se realizó o se observó una prueba, simulación o interacción, ni usar frases meta-referenciales ("como se observó en...", "durante una interacción directa...", "en el diálogo con..."). Redacta como una conclusión analítica consolidada y directa.
10. CERO REDUNDANCIA ENTRE CAMPOS (REGLA CRÍTICA): "ajusteCargo.analisis", "fortalezas" y "oportunidadesMejora" parten de los mismos datos, pero cada uno cumple un rol distinto y NO debe repetir lo que ya dice otro campo. Antes de escribir cada uno, revisa mentalmente qué ya dijiste en los anteriores y evita reformular la misma idea con otras palabras. Roles:
   - "ajusteCargo.analisis": 2-3 frases, ÚNICAMENTE sobre el encaje entre el perfil y las demandas concretas del puesto (${proceso?.cargo || 'N/A'}). No listes fortalezas ni menciones el bienestar.
   - "fortalezas" / "oportunidadesMejora": cada ítem debe combinar DOS O MÁS factores de los DATOS PARA ANÁLISIS de abajo (según la guía de interpretación) en una sola observación de comportamiento integrada (ej: responsabilidad alta + energía baja → "sostiene el cumplimiento incluso cuando el desgaste podría hacerle bajar el ritmo"). Prohibido describir un solo factor de forma aislada.

ESTILO DE REDACCIÓN OBLIGATORIO:
- Utiliza un lenguaje claro, directo y profesional, pensado para responsables de selección y supervisores que no tienen formación en psicología.
- Escribe frases naturales y relativamente breves. Evita palabras rebuscadas, explicaciones académicas y expresiones propias de informes técnicos.
- Describe conductas concretas y su posible efecto en el trabajo. No presentes los resultados como diagnósticos ni como verdades absolutas.
- Prefiere expresiones como "puede ayudar", "tiende a", "sería conveniente acompañar" y "podría beneficiarse de".
- Evita, salvo que sean imprescindibles, términos como "alineación conductual", "adherencia", "autogestión", "autoconcepto", "resiliencia", "inteligencia emocional", "metacognición", "brechas", "idoneidad", "proctoring", "percentil" y "psicológico". Reemplázalos por expresiones cotidianas.
- En fortalezas y oportunidades, utiliza este enfoque: título breve; qué se observa; qué puede significar en el trabajo.
- No repitas la misma idea en distintas secciones. No exageres las cualidades ni presentes las oportunidades de mejora como defectos permanentes.
- Ejemplo de tono correcto: "Puede mantener la calma frente a reclamos y buscar una solución sin aumentar la tensión de la conversación."
- Ejemplo de tono a evitar: "Presenta una elevada competencia de regulación emocional y una sólida alineación conductual con el rol."
- El resultado debe sonar humano, equilibrado y útil para tomar una decisión laboral.

CONTEXTO DEL PUESTO: ${proceso?.cargo || 'N/A'}
AJUSTE ESTIMADO: ${scoreFinal}%

${datosFactores}

${analisisFrasesIncompletas ? `DATOS CUALITATIVOS ADICIONALES (TEST DE FRASES INCOMPLETAS SACKS):\n${analisisFrasesIncompletas}\n` : ''}
${analisisRolePlay ? `DATOS DE LA DINÁMICA DE ROLE PLAY Y SIMULACIÓN EN VIVO:\n${analisisRolePlay}\n` : ''}

${guiaInterpretacion}

Devuelve UNICAMENTE un objeto JSON con esta estructura:
{
  "fortalezas": [{"tendencia": "Comportamiento observado combinando 2+ factores, no uno aislado", "mecanismo": "Forma de actuar", "impacto_organizacional": "Valor para la empresa"}],
  "oportunidadesMejora": [{"tendencia": "Punto de atención combinando 2+ factores, no uno aislado", "mecanismo": "Situación de riesgo", "impacto_organizacional": "Consecuencia operativa"}],
  "ajusteCargo": { "score": ${scoreFinal}, "analisis": "2-3 frases, solo sobre el encaje con las demandas concretas del puesto (${proceso?.cargo || 'N/A'}). No listes fortalezas ni menciones el bienestar." },
  "recomendacion": "..."
}
`;

    // LLAMADA 1B: interpretacionPorFactor / ajusteMbti / analisisEntrevista — la parte descriptiva
    // por factor y el análisis tipológico/de entrevista, independiente de 1A.
    const promptB = `
Eres el mismo Consultor Senior en Desarrollo Humano y Psicólogo Organizacional, redactando ahora la sección descriptiva por factor y el análisis tipológico/de entrevista del mismo informe ejecutivo.

REGLAS DE ORO DE REDACCIÓN (OBLIGATORIAS E INFLEXIBLES):
1. TONO: Cercano, empático, equilibrado y corporativo. Habla de comportamientos y situaciones, NO de puntajes ni números.
2. SIN TECNICISMOS NI JERGAS: Está strictly prohibido usar nombres de rasgos técnicos de personalidad (tales como "Extraversión", "Consciencia", "Amabilidad", "Neuroticismo", "Apertura"), siglas de pruebas ("Big Five", "DASS-21", "Sacks", "SJT"), o términos acartonados. Traduce todo a un lenguaje cotidiano, fluido e inteligente (ej: en lugar de "Consciencia" di "capacidad para organizar el trabajo y hacer seguimiento"; en lugar de "Extraversión" di "facilidad para entablar diálogos y relacionarse"; en lugar de "Neuroticismo" di "estabilidad ante situaciones de presión").
3. SIN MAXIMALISMOS: Prohibido usar adjetivos absolutos o grandilocuentes como "idealmente", "meticulosamente", "crucial", "esencial", "vital", "clave", "excelente", "perfectamente", "clara", "genuina", "total", "óptima", "necesaria" o "crítica". Utiliza una redacción atenuada (ej: "tiende a", "muestra propensión a", "encuentra facilidad en").
4. ANONIMATO ABSOLUTO: No utilices el nombre del candidato en ninguna parte del análisis. Refiérete a él/ella únicamente como "el perfil", "la persona evaluada", "el postulante" o mediante estructuras impersonales.
5. SIN META-LENGUAJE NI EXCUSAS DE DATOS FALTANTES: No escribas "Basado en los datos...", "El informe indica...". Si ciertos datos no están presentes, simplemente redacta analizando los disponibles, sin mención ni disculpa por lo que falta.
6. SIN REFERENCIAS AL SOPORTE TECNOLÓGICO: Está estrictamente prohibido usar palabras como "video", "cámara", "grabación", "audio", "plataforma", "videoentrevista". Describe lo observado como "interacción directa", "comunicación discursiva", "estilo verbal", "comportamiento no verbal" o "presencia interactiva".
7. Cada descripción de factor debe usar la GUÍA DE INTERPRETACIÓN de abajo para saber si, PARA ESE FACTOR PUNTUAL, un puntaje bajo es la señal de alerta o lo es uno alto — no asumas que "puntaje bajo" siempre significa algo negativo ni que siempre significa algo positivo, depende de cada factor.

CONTEXTO DEL PUESTO: ${proceso?.cargo || 'N/A'}
PERFIL CONDUCTUAL (MBTI): ${mbtiType}

${datosFactores}

${guiaInterpretacion}

${discursoVideos ? `TRANSCRIPCIONES Y DISCURSO DE LA VIDEO-ENTREVISTA CONDUCTUAL:\n${discursoVideos}` : ''}

INSTRUCCIÓN ESPECIAL PARA ENTREVISTA LABORAL INTEGRADA:
Si las transcripciones de la entrevista están provistas arriba, realiza un análisis clínico integrado y redacta 5 párrafos cualitativos detallados que formarán el "Perfil de Entrevista Laboral Integrada", mapeando el comportamiento del candidato en las 5 dimensiones clave. Respeta estrictamente la Regla de Oro número 6: no menciones en ningún momento el medio de grabación. Si no hay transcripciones provistas, devuelve null en esa propiedad.

Devuelve UNICAMENTE un objeto JSON con esta estructura:
{
  "ajusteMbti": "Análisis descriptivo y humano de cómo el perfil ${mbtiType} se adapta específicamente a las tareas y desafíos de la posición de ${proceso?.cargo || 'N/A'}.",
  "interpretacionPorFactor": {
     "relaciones": "Cómo se vincula con los demás...",
     "claridad_rol": "Cómo entiende sus tareas...",
     "burnout": "Cómo maneja el agotamiento...",
     "equilibrio": "Relación trabajo y bienestar...",
     "extraversion": "Nivel de interacción...",
     "amabilidad": "Calidez y trato...",
     "responsabilidad": "Compromiso y orden...",
     "estabilidad_emocional": "Estabilidad ante la presión...",
     "apertura": "Disposición al cambio...",
     "logro": "Orientación al logro y motivación de éxito (solo si hay datos disponibles)...",
     "dinamismo": "Nivel de energía y ritmo de trabajo (solo si hay datos disponibles)..."
  },
  "analisisEntrevista": ${tieneVideos ? `{
    "trayectoriaMotivacion": "Un párrafo sobre trayectoria, estabilidad y motivación laboral del perfil.",
    "estiloTrabajoAutoridad": "Un párrafo sobre estilo de trabajo y relación de subordinación con la autoridad.",
    "gestionConflictos": "Un párrafo sobre su capacidad en front-office y gestión de situaciones conflictivas.",
    "resilienciaFrustracion": "Un párrafo sobre sus mecanismos de resiliencia y tolerancia a la frustración.",
    "autoconceptoMetas": "Un párrafo sobre su autoconcepto, madurez y proyección profesional de cara al puesto."
  }` : 'null'}
}
`;

    const apiCallStartTime = Date.now();
    console.log(`[INFO] [GENERAR INFORME] Iniciando generación de informe para candidato: ${candidato?.nombre || 'N/A'} ${candidato?.apellido || ''}`);

    // Llamada 1A y 1B corren en paralelo (antes eran una sola llamada secuencial que tardaba 36-50s
    // por sí sola): el tiempo de esta etapa pasa a ser el de la más lenta de las dos, no la suma.
    const [resultadoA, resultadoB] = await Promise.all([
      generarSeccionConReintentos(genAI, promptA, 8000, 'Llamada 1A (fortalezas/ajuste)'),
      generarSeccionConReintentos(genAI, promptB, 8000, 'Llamada 1B (factores/mbti/entrevista)'),
    ]);

    const resultado: any = { ...resultadoA, ...resultadoB };

    resultado.ajusteCargo.score = scoreFinal;

    // "Habilidades para el Trabajo" (metaCompetencias) ya NO se le pide a la IA que las estime libremente:
    // se calculan acá mismo a partir de los mismos factores psicométricos crudos que ya usa el resto del
    // informe, para que esta sección no pueda contradecir a las demás (ver lib/metaCompetencias.ts).
    resultado.metaCompetencias = calcularMetaCompetencias(factoresCrudos);

    // SEGUNDA LLAMADA (proactiva, no reactiva): el resumenEjecutivo y la fundamentación ya NO se piden
    // en la misma llamada que fortalezas/oportunidadesMejora. Se generan acá, DESPUÉS, dándole a la IA
    // el texto ya escrito como contexto fijo y prohibiéndole repetirlo. Esto reemplaza al mecanismo
    // anterior (detectar redundancia y recién ahí reintentar) por uno que evita la redundancia desde el
    // origen, en vez de corregirla después de que ya ocurrió.
    const fallbackResumen = 'Los hallazgos de fortalezas y áreas de desarrollo detallados en este informe describen de forma completa el perfil evaluado para el puesto.';
    const fallbackFundamentacion = `El ajuste estimado de ${scoreFinal}% respecto a las demandas del puesto de ${proceso?.cargo || 'la posición evaluada'} sostiene esta recomendación.`;
    resultado.resumenEjecutivo = fallbackResumen;
    resultado.fundamentacion = fallbackFundamentacion;

    // Con maxDuration en 280s (ver arriba), hay mucho más margen real que antes — estos umbrales ya
    // no necesitan ser distintos entre Vercel y `next dev` local, pero se deja la distinción por si
    // algún entorno de Vercel llegara a correr sin Fluid Compute (quedaría igual de protegido).
    const enVercel = !!process.env.VERCEL;
    const limiteSintesisMs = enVercel ? 200000 : 120000;
    const tiempoTranscurridoMs = Date.now() - apiCallStartTime;
    const hayMargenParaSintesis = tiempoTranscurridoMs < limiteSintesisMs;

    if (!hayMargenParaSintesis) {
      console.warn(`[WARNING] [GENERAR INFORME] Sin margen de tiempo para la síntesis final (${Math.round(tiempoTranscurridoMs / 1000)}s transcurridos); se entrega con el texto de respaldo.`);
    } else {
      try {
        const promptSintesis = `Eres el mismo consultor que ya redactó las secciones de abajo para este informe. NO se van a modificar — tu única tarea es escribir DOS campos nuevos que se leerán DESPUÉS de estas, conectándolas sin repetirlas.

REGLAS DE ESTILO (las mismas que ya se usaron abajo, síguelas igual):
- Tono cercano, empático, atenuado y profesional. Sin tecnicismos de personalidad ni siglas de pruebas. Sin nombrar al candidato (usa "el perfil" o "la persona evaluada"). Sin adjetivos absolutos ("crucial", "excelente", "perfecta", "esencial", etc.).
- No menciones videos, cámaras, plataformas ni ningún soporte tecnológico.

TEXTOS YA ESCRITOS PARA ESTE INFORME (no los repitas, no los reformules con sinónimos, no vuelvas a describir lo mismo):
- Encaje con el puesto: "${resultado.ajusteCargo?.analisis || ''}"
- Fortalezas: ${JSON.stringify((resultado.fortalezas || []).map((f: any) => ({ tendencia: f?.tendencia, mecanismo: f?.mecanismo })))}
- Áreas de desarrollo: ${JSON.stringify((resultado.oportunidadesMejora || []).map((f: any) => ({ tendencia: f?.tendencia, mecanismo: f?.mecanismo })))}
${resultado.analisisEntrevista ? `- Análisis de entrevista ya escrito: ${JSON.stringify(resultado.analisisEntrevista)}` : ''}

CONTEXTO: puesto "${proceso?.cargo || 'N/A'}", ajuste estimado ${scoreFinal}%.

Escribe:
1. "resumenEjecutivo": mínimo 3 párrafos que CONECTEN al menos dos de los puntos ya escritos entre sí (ej. cómo una fortaleza compensa o se ve tensionada por un área de desarrollo), aportando una lectura nueva sobre cómo interactúan — no una lista ni un resumen de lo ya dicho arriba.
2. "fundamentacion": 2-4 frases que justifiquen puntualmente el dictamen según el ${scoreFinal}% de ajuste (por qué recomendado / con reservas / no recomendado). No es un resumen del perfil, es el argumento de la decisión.

Ninguno de los dos campos puede reutilizar frases textuales de los textos ya escritos arriba.

Devuelve ÚNICAMENTE este JSON: { "resumenEjecutivo": "...", "fundamentacion": "..." }`;

        const modelSintesis = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          // 1500 no alcanzaba: la respuesta se cortaba a mitad de una cadena JSON
          // ("Unterminated string in JSON") antes de terminar los 3+ párrafos pedidos.
          generationConfig: { maxOutputTokens: 4000, responseMimeType: 'application/json' }
        });

        let resultadoSintesis: any = null;
        let intentosSintesis = 0;
        const maxIntentosSintesis = 2;
        while (intentosSintesis < maxIntentosSintesis) {
          intentosSintesis++;
          try {
            const respuestaSintesis = await modelSintesis.generateContent(promptSintesis);
            const textoSintesis = respuestaSintesis.response.text();
            const primerLlave = textoSintesis.indexOf('{');
            const ultimaLlave = textoSintesis.lastIndexOf('}');
            const jsonSintesis = primerLlave >= 0 && ultimaLlave > primerLlave ? textoSintesis.slice(primerLlave, ultimaLlave + 1) : textoSintesis.trim();
            resultadoSintesis = JSON.parse(jsonSintesis);
            break;
          } catch (errorIntento: any) {
            console.warn(`[WARNING] [GENERAR INFORME] Síntesis final, intento ${intentosSintesis}/${maxIntentosSintesis} falló:`, errorIntento?.message || errorIntento);
          }
        }

        if (resultadoSintesis?.resumenEjecutivo) resultado.resumenEjecutivo = resultadoSintesis.resumenEjecutivo;
        if (resultadoSintesis?.fundamentacion) resultado.fundamentacion = resultadoSintesis.fundamentacion;

        // Verificación en dos capas: la literal (palabras repetidas) ya existía; la temática detecta
        // el mismo tema aunque esté parafraseado con sinónimos (ej. "afinidad notable" vs "alineación
        // profunda"), que es el patrón que seguía pasando incluso con la síntesis en dos llamadas.
        const textosPrevios = [
          resultado.ajusteCargo?.analisis || '',
          ...(resultado.fortalezas || []).map((f: any) => [f?.tendencia, f?.mecanismo].filter(Boolean).join('. ')),
          ...(resultado.oportunidadesMejora || []).map((f: any) => [f?.tendencia, f?.mecanismo].filter(Boolean).join('. ')),
        ].filter(Boolean);

        const paresLiterales = detectarRedundanciaNarrativa(resultado);
        const frasesResumen = detectarFrasesTematicamenteRedundantes(resultado.resumenEjecutivo, textosPrevios);
        const frasesFundamentacion = detectarFrasesTematicamenteRedundantes(resultado.fundamentacion, textosPrevios);
        const hayRedundancia = paresLiterales.length > 0 || frasesResumen.length > 0 || frasesFundamentacion.length > 0;

        if (hayRedundancia) {
          console.warn(`[WARNING] [GENERAR INFORME] Redundancia detectada tras la síntesis (literal: ${paresLiterales.length}, temática resumen: ${frasesResumen.length}, temática fundamentación: ${frasesFundamentacion.length}).`);
        }

        const limitePulidoMs = enVercel ? 240000 : 130000;
        const tiempoTranscurridoMs2 = Date.now() - apiCallStartTime;
        const hayMargenParaPulido = tiempoTranscurridoMs2 < limitePulidoMs;

        if (hayRedundancia && hayMargenParaPulido) {
          try {
            const detalleFrases = [
              ...frasesResumen.map(f => `- En el resumen ejecutivo: "${f.frase}" (repite, sin aportar nada nuevo, el mismo tema [${f.temas}] de un texto ya escrito arriba)`),
              ...frasesFundamentacion.map(f => `- En la fundamentación: "${f.frase}" (repite, sin aportar nada nuevo, el mismo tema [${f.temas}] de un texto ya escrito arriba)`),
            ].join('\n');

            const promptPulido = `Revisa este resumen ejecutivo y esta fundamentación que ya escribiste:
- resumenEjecutivo: "${resultado.resumenEjecutivo}"
- fundamentacion: "${resultado.fundamentacion}"

${detalleFrases ? `Se detectaron frases puntuales que repiten, sin aportar nada nuevo, un tema ya cubierto en otra parte del informe:\n${detalleFrases}\n` : ''}${paresLiterales.length > 0 ? `También hay frases casi idénticas a otro campo del informe (similitud literal alta).\n` : ''}
Reescribe SOLO las frases problemáticas (podés dejar el resto igual si ya está bien): o bien elimínalas, o bien dales un ángulo que conecte ese tema con otro distinto en vez de solo restablecerlo. Mantené el resto del contenido y el tono ya usado (cercano, atenuado, sin nombrar al candidato, sin tecnicismos).

Devuelve ÚNICAMENTE este JSON: { "resumenEjecutivo": "...", "fundamentacion": "..." }`;

            const modelPulido = genAI.getGenerativeModel({
              model: 'gemini-2.5-flash',
              generationConfig: { maxOutputTokens: 8000, responseMimeType: 'application/json' }
            });
            const respuestaPulido = await modelPulido.generateContent(promptPulido);
            const textoPulido = respuestaPulido.response.text();
            const primerLlavePulido = textoPulido.indexOf('{');
            const ultimaLlavePulido = textoPulido.lastIndexOf('}');
            const jsonPulido = primerLlavePulido >= 0 && ultimaLlavePulido > primerLlavePulido ? textoPulido.slice(primerLlavePulido, ultimaLlavePulido + 1) : textoPulido.trim();
            const resultadoPulido = JSON.parse(jsonPulido);

            if (resultadoPulido?.resumenEjecutivo) resultado.resumenEjecutivo = resultadoPulido.resumenEjecutivo;
            if (resultadoPulido?.fundamentacion) resultado.fundamentacion = resultadoPulido.fundamentacion;
            console.log(`[INFO] [GENERAR INFORME] Pulido por redundancia aplicado.`);
          } catch (errorPulido: any) {
            // Best-effort: si el pulido falla, se conserva el texto de la síntesis original (ya válido,
            // solo con la redundancia detectada) en vez de bloquear la generación por este paso extra.
            console.warn(`[WARNING] [GENERAR INFORME] No se pudo aplicar el pulido por redundancia, se conserva el texto de la síntesis:`, errorPulido?.message || errorPulido);
          }
        } else if (hayRedundancia && !hayMargenParaPulido) {
          console.warn(`[WARNING] [GENERAR INFORME] Redundancia detectada pero sin margen de tiempo para pulir (${Math.round(tiempoTranscurridoMs2 / 1000)}s transcurridos); se entrega tal cual.`);
        }
      } catch (errorSintesis: any) {
        // Best-effort: si la síntesis final falla por completo, se entrega el informe con el
        // texto de respaldo en vez de bloquear toda la generación por este paso adicional.
        console.warn(`[WARNING] [GENERAR INFORME] No se pudo generar la síntesis final, se usa texto de respaldo:`, errorSintesis?.message || errorSintesis);
      }
    }

    const totalDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2);
    console.log(`[INFO] [GENERAR INFORME] Informe generado exitosamente en ${totalDuration}s.`);
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
