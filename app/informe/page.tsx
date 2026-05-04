'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { obtenerPercentilCognitivo, interpretarPercentil, obtenerPercentilBigFive } from '@/lib/baremos'
import { Sparkles, AlertCircle } from 'lucide-react'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Candidato {
  id: string; nombre: string; apellido: string; email: string; documento: string
}

interface Proceso { 
  nombre: string; 
  cargo: string;
  descripcion_cargo?: string;
  competencias_requeridas?: { nombre: string; nivel: string }[];
}

interface Sesion {
  id: string
  puntaje_bruto: Record<string, unknown>
  finalizada_en: string
}

type Rec = 'recomendado' | 'con_reservas' | 'no_recomendado'

interface InformeState {
  resumenEjecutivo: string
  comentarioPersonalidad: string
  interpretacionPorFactor: Record<string, string>
  comentarioCognitivo: string
  comentarioCompetencias: string
  recomendacion: Rec
  fundamentacion: string
  ajusteMbti: string
  nombreEvaluador: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const BF_KEYS = ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura']

const ETQ: Record<string, string> = {
  // Personalidad
  extraversion: 'Extraversión', amabilidad: 'Amabilidad', responsabilidad: 'Responsabilidad',
  neuroticismo: 'Estabilidad Emocional', apertura: 'Apertura a la Experiencia',
  honestidad_humildad: 'Honestidad y Humildad',
  
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
  manejo_emocional: 'Inteligencia Emocional Aplicada',
  tolerancia_frustracion: 'Tolerancia a la Presión',
  comunicacion: 'Comunicación Efectiva',
  
  // Salud y Bienestar Laboral
  burnout: 'Nivel de Riesgo (Burnout)',
  equilibrio: 'Balance Vida-Trabajo',
  relaciones: 'Relaciones Interpersonales y Clima',
  claridad_rol: 'Percepción de Claridad de Rol',
  nivel_estres: 'Indicador de Tensión Psicológica',
  carga_laboral: 'Gestión de la Demanda de Trabajo',
}

const DOMINIOS = {
  PERSONALIDAD: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad'],
  COGNITIVO: ['correctas', 'percentil', 'score', 'documentos', 'comparacion', 'concentracion', 'errores_texto', 'errores_numeros', 'metricas_fraude'],
  COMPETENCIAS: ['etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion', 'comunicacion'],
  BIENESTAR: ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'nivel_estres', 'carga_laboral']
}

const CLR: Record<string, string> = {
  extraversion: '#2563eb', amabilidad: '#16a34a', responsabilidad: '#9333ea',
  neuroticismo: '#dc2626', apertura: '#ea580c',
}

const CLR_RGB: Record<string, [number, number, number]> = {
  extraversion: [37, 99, 235], amabilidad: [22, 163, 74], responsabilidad: [147, 51, 234],
  neuroticismo: [220, 38, 38], apertura: [234, 88, 12],
}

const INTERP: Record<string, Record<string, string>> = {
  extraversion: {
    Alto: 'Refleja a una persona altamente sociable, enérgica y orientada hacia el mundo externo. En el contexto laboral, destaca por su facilidad para establecer redes de contacto, comunicarse fluidamente y prosperar en entornos dinámicos. Suelen ser excelentes para el trabajo en equipo y roles que requieren interacción constante. Sin embargo, como área de desarrollo, podrían necesitar mejorar su capacidad de escucha activa o encontrar equilibrio en entornos que requieren alta concentración individual y silencio prolongado.',
    Moderado: 'Demuestra un equilibrio saludable entre sociabilidad y necesidad de espacio personal. Se adapta fluidamente tanto a trabajos en equipo como a tareas individuales que requieren concentración. En el día a día, puede participar activamente en reuniones cuando es necesario, pero también retirarse a trabajar de forma autónoma sin sentir desgaste. Este nivel permite una gran flexibilidad para desempeñarse adecuadamente en la mayoría de los roles laborales, sin mostrar los extremos de extroversión o introversión.',
    Bajo: 'Indica a una persona más reservada, reflexiva y orientada hacia su mundo interno. En el trabajo, prefieren entornos tranquilos, estructurados y con bajo nivel de interrupciones. Destacan en roles de análisis, desarrollo técnico o tareas independientes de alta concentración, donde suelen mostrar una profunda capacidad de enfoque. Como área de desarrollo, pueden necesitar esfuerzo consciente para construir redes profesionales, promover sus ideas en público o liderar equipos muy dinámicos.',
  },
  amabilidad: {
    Alto: 'Muestra una alta orientación hacia los demás, siendo muy cooperativa, empática y conciliadora. En el entorno de trabajo, facilita el clima laboral positivo, apoya a sus compañeros y resuelve conflictos a través del consenso. Es ideal para roles de servicio al cliente, recursos humanos o cuidados. Un área de desarrollo puede ser la asertividad: podrían tener dificultades para dar feedback negativo, negociar de forma competitiva o tomar decisiones impopulares que afecten a otros.',
    Moderado: 'Indica un equilibrio adecuado entre la cooperación y la asertividad propia. En el entorno laboral, esta persona trabaja bien con otros, es colaborativa, pero no pierde su independencia de criterio ni teme expresar desacuerdos constructivos. Es un nivel muy funcional que permite negociar, defender ideas y, a la vez, mantener buenas relaciones interpersonales, adaptándose a la mayoría de las posiciones organizacionales que requieren trabajo en equipo y pensamiento crítico.',
    Bajo: 'Refleja un perfil directo, pragmático y fuertemente orientado a resultados más que a las relaciones. En el trabajo, priorizan la eficiencia y los objetivos, siendo muy asertivos y, a veces, competitivos. Destacan en roles donde se requieren decisiones difíciles, negociaciones duras o auditorías sin involucrarse emocionalmente. Su principal área de desarrollo radica en las habilidades blandas: necesitan cuidar el tacto, la empatía y la diplomacia para no generar fricciones innecesarias en sus equipos.',
  },
  responsabilidad: {
    Alto: 'Refleja un nivel excepcional de organización, autodisciplina y orientación al logro. Esta persona planifica meticulosamente, cumple rigurosamente sus compromisos y mantiene altos estándares de calidad. Es un perfil altamente confiable, ideal para roles de gestión, finanzas o control de calidad. No obstante, en posiciones que requieren improvisación constante, su área de desarrollo puede ser la flexibilidad ante cambios de último momento o el perfeccionismo excesivo que podría retrasar las entregas.',
    Moderado: 'Muestra un nivel adecuado de organización y compromiso, equilibrando la planificación con la adaptabilidad. Cumple con los objetivos laborales esperados, se organiza razonablemente bien y no se paraliza si las reglas o la estructura cambian repent পশ্চantes. En el día a día, esto se traduce en una persona que saca adelante el trabajo sin caer en el perfeccionismo paralizante ni en la desidia, ajustándose bien a entornos con niveles de supervisión normales.',
    Bajo: 'Indica un estilo de trabajo muy flexible, espontáneo y, a menudo, desestructurado. En el entorno laboral, esta persona puede tener dificultades con tareas que requieren alta planificación, atención al detalle prolongada o cumplimiento estricto de horarios. Sin embargo, suelen ser buenos improvisando o apagando "incendios". Su gran área de desarrollo es la gestión del tiempo, el seguimiento de procesos a largo plazo y la creación de hábitos organizativos que aseguren la entrega consistente de resultados.',
  },
  neuroticismo: {
    Alto: 'Indica una mayor sensibilidad emocional y tendencia a experimentar tensión o preocupación ante la presión. En el contexto laboral, son personas que pueden anticipar riesgos y problemas potenciales debido a su nivel de alerta constante. Sin embargo, su desempeño puede verse mermado en entornos altamente volátiles o críticos. Requieren ambientes de trabajo psicológicamente seguros, estables y con expectativas claras. Su área de desarrollo clave es la gestión del estrés y la resiliencia emocional.',
    Moderado: 'Muestra una respuesta emocional equilibrada ante las demandas del trabajo. La persona es capaz de manejar bien la mayoría de las situaciones laborales típicas, sintiendo estrés solo ante desafíos genuinamente grandes o prolongados. En el día a día, mantienen la compostura, se recuperan de los reveses con relativa facilidad y aportan estabilidad al equipo, logrando un balance saludable entre estar alerta a los problemas y mantener la serenidad para resolverlos.',
    Bajo: 'Refleja una alta estabilidad emocional, tranquilidad y notable resiliencia. En el trabajo, esta persona maneja la presión de forma excepcional, manteniendo la calma en crisis y tomando decisiones objetivas cuando otros entran en pánico. Son perfiles ideales para roles de alta exigencia o liderazgo en tiempos de incertidumbre. Como posible punto ciego, podrían subestimar el nivel de estrés que experimentan los demás en su equipo, necesitando desarrollar empatía hacia compañeros más sensibles.',
  },
  apertura: {
    Alto: 'Revela una alta curiosidad intelectual, imaginación y disposición al cambio. En el trabajo, esta persona es innovadora, cuestiona el "status quo" y disfruta aprendiendo nuevas habilidades o explorando enfoques creativos. Destaca enormemente en roles de diseño, estrategia, I+D o consultoría estratégica. Su área de desarrollo puede ser la tolerancia hacia tareas muy repetítulos, administrativas o estructuradas, donde podrían desmotivarse rápidamente o perder el foco en la ejecución de la rutina.',
    Moderado: 'Representa un equilibrio práctico entre la creatividad y el pragmatismo tradicional. Esta persona está abierta a nuevas ideas cuando demuestran ser útiles, pero no busca el cambio solo por cambiar. Se adapta bien tanto a entornos donde se requiere cierta innovación como a aquellos que demandan seguimiento de metodologías probadas. Es un perfil muy versátil que en el día a día apoya la mejora continua sin descuidar el mantenimiento de las operaciones actuales.',
    Bajo: 'Indica una clara preferencia por los métodos conocidos, la tradición y los entornos predecibles. En el trabajo, son personas sumamente prácticas que confían en procesos establecidos y soluciones concretas y probadas. Sobresalen en roles operativos, de cumplimiento normativo o administrativos, donde seguir las reglas y mantener la consistencia es vital. Su principal área de desarrollo radica en la adaptabilidad ante transformaciones drásticas en la empresa o la adopción de tecnologías disruptivas.',
  },
  honestidad_humildad: {
    Alto: 'Refleja a una persona sincera, modesta y justa. En el entorno laboral, se caracterizan por su ética intachable, su rechazo a manipular a otros para beneficio personal y su falta de pretensiones desmedidas. Fomentan la confianza genuina y el trabajo en equipo transparente. Como posible área de mejora, pueden ser demasiado modestos a la hora de visibilizar sus propios logros frente a la dirección, lo que a veces retrasa su reconocimiento o promoción en culturas corporativas competitivas.',
    Moderado: 'Demuestra un balance entre la sinceridad y el sentido práctico de la autopromoción. En el trabajo, esta persona es generalmente honesta y justa con sus compañeros, pero también es capaz de negociar a su favor y asegurar que sus contribuciones sean notadas por sus superiores. Entienden y navegan las dinámicas políticas de la oficina sin caer en la manipulación malintencionada, adaptándose de forma saludable al ecosistema corporativo estándar.',
    Bajo: 'Muestra una tendencia hacia el beneficio propio, la persuasión interesada y un alto sentido de importancia personal. En el trabajo, estas personas pueden ser muy astutas para la autopromoción y la negociación agresiva, lo que a corto plazo puede generar logros individuales notables. Sin embargo, su gran área de desarrollo es la ética colectiva: pueden generar desconfianza en sus equipos, tener problemas de integridad a largo plazo y dañar el clima laboral al poner siempre sus intereses primero.',
  },
  emocionalidad: {
    Alto: 'Equivale a una alta empatía combinada con susceptibilidad emocional. En el contexto laboral, son personas que generan lazos profundos y comprenden excepcionalmente bien las necesidades emocionales de clientes y compañeros. Sin embargo, pueden requerir apoyo constante, validación y pueden verse abrumados por críticas duras o situaciones de alta fricción. Su desarrollo debe enfocarse en la objetividad y en no tomar el feedback profesional como un ataque personal.',
    Moderado: 'Indica un punto medio de sensibilidad y conexión emocional. En el día a día, la persona puede conectar con las preocupaciones del equipo y mostrar empatía genuina, manteniendo al mismo tiempo un nivel suficiente de desapego para tomar decisiones racionales. Logran manejar críticas constructivas y situaciones de estrés con una resiliencia adecuada, siendo muy efectivos en roles de supervisión intermedia o servicio al cliente.',
    Bajo: 'Refleja una persona con gran independencia emocional, dureza y bajo nivel de ansiedad o empatía sentimental. En el trabajo, son resilientes ante la presión extrema, no necesitan mucha validación externa y pueden tomar decisiones difíciles (como despidos o recortes) sin inmutarse. El área de desarrollo más crítica es la conexión humana: pueden parecer fríos, distantes o carentes de apoyo emocional hacia sus colaboradores, lo que puede desmotivar a sus equipos.',
  },
  // Sección IV: Competencias Profesionales (SJT)
  etica: {
    Alto: 'Demuestra una integridad inquebrantable y un compromiso profundo con los estándares éticos. Actúa como referente de probidad y transparencia en la organización.',
    Moderado: 'Muestra un comportamiento ético sólido y alineado con las normas corporativas, resolviendo dilemas morales de forma equilibrada y razonable.',
    Bajo: 'Presenta dificultades para priorizar principios éticos ante presiones externas o metas personales; requiere supervisión en la toma de decisiones críticas.'
  },
  negociacion: {
    Alto: 'Estratega hábil capaz de cerrar acuerdos complejos maximizando el beneficio mutuo. Domina la comunicación persuasiva y la gestión de intereses contrapuestos.',
    Moderado: 'Posee habilidades funcionales para la negociación; logra acuerdos satisfactorios en situaciones estándar y mantiene una postura constructiva.',
    Bajo: 'Tiende a ceder excesivamente ante la presión o adopta posturas rígidas que dificultan el consenso. Requiere formación en técnicas de persuasión.'
  },
  manejo_emocional: {
    Alto: 'Elevado autocontrol y madurez emocional. Gestiona situaciones de alta tensión con serenidad, evitando que las emociones interfieran en el juicio profesional.',
    Moderado: 'Regula sus emociones de forma adecuada en el día a día laboral, aunque puede mostrar reactividad ante crisis o niveles de estrés sostenidos.',
    Bajo: 'Vulnerabilidad ante la presión emocional; sus estados de ánimo impactan visiblemente en su desempeño y en la relación con sus colaboradores.'
  },
  tolerancia_frustracion: {
    Alto: 'Resiliencia excepcional. Transforma los obstáculos en oportunidades de aprendizaje y mantiene la motivación intacta ante los reveses operativos.',
    Moderado: 'Acepta los contratiempos con una actitud profesional, logrando recuperarse tras un periodo razonable de ajuste ante el fracaso.',
    Bajo: 'Baja tolerancia a los imprevistos; los errores o retrasos le generan desmotivación inmediata y pueden paralizar su capacidad de respuesta.'
  },
  comunicacion: {
    Alto: 'Comunicador de impacto. Transmite ideas complejas con claridad absoluta, adaptando su discurso a distintos niveles jerárquicos y asegurando la escucha activa.',
    Moderado: 'Se comunica de forma efectiva y clara en contextos conocidos, cumpliendo con los requerimientos de intercambio de información del puesto.',
    Bajo: 'Dificultades para estructurar mensajes o falta de asertividad; se producen malentendidos frecuentes o falta de fluidez en la transmisión de objetivos.'
  },
  // Sección V: Salud y Bienestar Laboral
  burnout: {
    Bajo: 'Nivel óptimo de energía y compromiso. No se detectan indicadores de agotamiento crónico; el evaluado mantiene una alta reserva vital para el desempeño.',
    Moderado: 'Muestra fatiga puntual asociada a las demandas del rol. Es necesario vigilar las pausas y la desconexión para evitar que el cansancio se vuelva crónico.',
    Alto: 'Riesgo elevado de agotamiento. Se observan síntomas de desgaste emocional y despersonalización que requieren intervención inmediata en la gestión del rol.'
  },
  equilibrio: {
    Alto: 'Logra una integración saludable entre sus responsabilidades laborales y su vida personal, lo que favorece una sostenibilidad de desempeño a largo plazo.',
    Moderado: 'Mantiene un balance aceptable, aunque en picos de demanda el trabajo tiende a desplazar sus actividades personales de forma recurrente.',
    Bajo: 'Desequilibrio marcado. Existe una invasión del ámbito laboral sobre el personal, lo que genera un riesgo latente de estrés y desmotivación.'
  },
  relaciones: {
    Alto: 'Fomenta un clima de colaboración y confianza. Se integra con facilidad y aporta activamente al bienestar psicológico del equipo y sus pares.',
    Moderado: 'Mantiene relaciones funcionales y cordiales en el entorno laboral, sin involucrarse profundamente en las dinámicas sociales del equipo.',
    Bajo: 'Aislamiento o tendencia al conflicto. Su estilo de interacción puede generar fricciones o falta de cohesión en el grupo de trabajo.'
  },
  claridad_rol: {
    Alto: 'Comprende perfectamente sus objetivos y el impacto de su trabajo. Opera con autonomía y seguridad al saber exactamente qué se espera de su desempeño.',
    Moderado: 'Conoce sus funciones principales, aunque en tareas nuevas o cambios de estructura puede experimentar incertidumbre sobre sus alcances.',
    Bajo: 'Confusión sobre las expectativas. La falta de definición de tareas le genera inseguridad operativa y dependencia constante de supervisión.'
  },
  nivel_estres: {
    Bajo: 'Manejo sobresaliente de la tensión. No se percibe el entorno como amenazante, operando con calma incluso en situaciones de demanda exigente.',
    Moderado: 'Experimenta niveles de tensión normales ante los desafíos del puesto, logrando autorregularse sin que esto afecte su salud o productividad.',
    Alto: 'Tensión psicológica elevada. El evaluado se siente sobrepasado por las demandas, lo que puede derivar en problemas de salud y errores operativos.'
  },
  carga_laboral: {
    Bajo: 'Percibe la demanda de trabajo como cómoda o incluso reducida. Tiene capacidad ociosa que podría ser aprovechada para nuevas responsabilidades.',
    Moderado: 'La carga de trabajo se percibe como justa y equilibrada con respecto a su tiempo y capacidades, permitiendo un flujo de trabajo constante.',
    Alto: 'Sobrecarga de tareas percibida. El volumen de trabajo supera su capacidad de respuesta en el tiempo disponible, comprometiendo la calidad.'
  }
}

const REC_LABELS: Record<Rec, string> = {
  recomendado: 'Recomendado',
  con_reservas: 'Recomendado con reservas',
  no_recomendado: 'No recomendado',
}
const REC_COLOR: Record<Rec, string> = {
  recomendado: '#16a34a', con_reservas: '#ea580c', no_recomendado: '#dc2626',
}
const REC_RGB: Record<Rec, [number, number, number]> = {
  recomendado: [22, 163, 74], con_reservas: [234, 88, 12], no_recomendado: [220, 38, 38],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numEntries(pb: Record<string, unknown>): [string, any][] {
  if (!pb) return [];
  const data = (pb.por_factor as Record<string, any>) || pb;
  
  return Object.entries(data).filter(([k]) => k !== 'total' && k !== 'porcentaje' && k !== 'por_factor');
}

function avgOf(pb: Record<string, unknown>): number {
  const vs = numEntries(pb).map(([, v]) => {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') return Number(v.correctas || v.score || 0);
    return parseFloat(v) || 0;
  });
  if (!vs.length) return 0
  return Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10
}

function isBF(pb: Record<string, unknown> | null | undefined) { 
  if (!pb) return false
  const data = (pb.por_factor as Record<string, any>) || pb
  const keys = Object.keys(data).map(k => k.toLowerCase())
  return BF_KEYS.some(k => keys.includes(k)) 
}
function isHX(pb: Record<string, unknown> | null | undefined) { 
  if (!pb) return false
  const data = (pb.por_factor as Record<string, any>) || pb
  const keys = Object.keys(data).map(k => k.toLowerCase())
  return keys.includes('honestidad_humildad') || keys.includes('honestidad') || keys.includes('sinceridad')
}
function isPersonalidad(pb: Record<string, unknown> | null | undefined) { return isBF(pb) || isHX(pb) }
function isCog(pb: Record<string, unknown> | null | undefined) { 
  if (!pb) return false
  const data = (pb.por_factor as Record<string, any>) || pb
  const keys = Object.keys(data).map(k => k.toLowerCase())
  const hasSubfactors = keys.includes('etica') || keys.includes('negociacion')
  if (hasSubfactors) return false 
  return (keys.includes('correctas') && keys.includes('total')) || keys.includes('score') || keys.includes('percentil')
}

function nivelPercentil(p: number) {
  if (p >= 85) return 'Muy Superior'
  if (p >= 70) return 'Superior'
  if (p >= 40) return 'Promedio'
  if (p >= 20) return 'Bajo'
  return 'Muy Bajo (Área de Mejora)'
}

function estimarMBTI(pb: Record<string, unknown> | null | undefined): string | null {
  if (!pb) return null;
  const data = (pb.por_factor as Record<string, any>) || pb;
  
  const getV = (key: string) => {
    const k = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase());
    if (!k) return null;
    const v = data[k];
    return typeof v === 'number' ? v : parseFloat(v as string);
  };

  const eVal = getV('extraversion');
  const nVal = getV('apertura');
  const fVal = getV('amabilidad');
  const jVal = getV('responsabilidad');

  if (eVal === null || nVal === null || fVal === null || jVal === null) return null;

  const e = eVal >= 3.5 ? 'E' : 'I';
  const n = nVal >= 3.5 ? 'N' : 'S';
  const f = fVal >= 3.5 ? 'F' : 'T';
  const j = jVal >= 3.5 ? 'J' : 'P';
  return `${e}${n}${f}${j}`;
}

const MBTI_DESC: Record<string, string> = {
  ENFJ: 'El Protagonista: Líderes carismáticos e inspiradores, con gran empatía.',
  ENFP: 'El Activista: Espíritus libres entusiastas, creativos y sociales.',
  ENTJ: 'El Comandante: Líderes audaces, imaginativos y de voluntad fuerte.',
  ENTP: 'El Innovador: Pensadores inteligentes y curiosos que disfrutan los retos intelectuales.',
  ESFJ: 'El Cónsul: Personas colaborativas, sociables y atentas a las necesidades de otros.',
  ESFP: 'El Animador: Espontáneos, enérgicos y entusiastas; adaptables a entornos sociales.',
  ESTJ: 'El Ejecutivo: Excelentes administradores del orden, procesos y personas.',
  ESTP: 'El Emprendedor: Perceptivos, orientados a la acción y a resolver problemas de forma práctica.',
  INFJ: 'El Abogado: Idealistas tranquilos, estratégicos e inspiradores.',
  INFP: 'El Mediador: Altruistas, amables y guiados por sus valores profundos.',
  INTJ: 'El Arquitecto: Pensadores imaginativos y estratégicos, con un plan para todo.',
  INTP: 'El Lógico: Pensadores analíticos e innovadores con gran sed de conocimiento.',
  ISFJ: 'El Defensor: Protectores cálidos y dedicados, sumamente confiables.',
  ISFP: 'El Aventurero: Flexibles, encantadores y listos para explorar enfoques prácticos.',
  ISTJ: 'El Logista: Prácticos, enfocados en los hechos y altamente responsables.',
  ISTP: 'El Virtuoso: Audaces, prácticos y maestros en la ejecución y uso de herramientas.'
};

function cogData(pb: Record<string, unknown>) {
  const data = (pb.por_factor as Record<string, any>) || pb
  const c = Number(data.correctas || pb.correctas) || 0
  const t = Number(data.total || pb.total) || 16 // ICAR suele ser 16
  const pct = Math.round((c / t) * 100)
  const percentil = obtenerPercentilCognitivo(c, t)
  return { correctas: c, total: t, pct, percentil }
}

function lvl(v: any) {
  const val = typeof v === 'object' ? v.correctas || v.score || 0 : v;
  const max = (v && typeof v === 'object' && 'total' in v) ? Number(v.total) : 5;
  const p = (val / max) * 100
  return p >= 70 ? 'Alto' : p >= 50 ? 'Moderado' : 'Bajo'
}

function clrOf(v: any) {
  const val = typeof v === 'object' ? v.correctas || v.score || 0 : v;
  const max = (v && typeof v === 'object' && 'total' in v) ? Number(v.total) : 5;
  const p = (val / max) * 100
  return p >= 70 ? '#16a34a' : p >= 50 ? '#ea580c' : '#dc2626'
}

function rgbOf(v: number, max = 5): [number, number, number] {
  const p = (v / max) * 100
  return p >= 70 ? [22, 163, 74] : p >= 50 ? [234, 88, 12] : [220, 38, 38]
}

function testNombre(pb: Record<string, unknown>, testId?: string): string {
  if (testId?.includes('bigfive')) return 'Big Five'
  if (testId?.includes('hexaco')) return 'HEXACO'
  if (testId === 'numerico') return 'Razonamiento Numérico'
  if (testId === 'verbal') return 'Razonamiento Verbal'
  if (testId === 'icar') return 'Capacidad Cognitiva (ICAR)'
  
  const data = (pb?.por_factor as Record<string, any>) || pb || {}
  const k = Object.keys(data).join(' ').toLowerCase()

  if (isBF(pb)) return 'Big Five'
  if (isHX(pb)) return 'HEXACO'
  if (k.includes('correctas') && k.includes('total')) return 'Test Cognitivo'
  
  if (k.includes('integridad')) return 'Integridad'
  if (k.includes('frustrac') || k.includes('toleran')) return 'Tolerancia a la frustración'
  if (k.includes('cobranza')) return 'SJT Cobranzas'
  if (k.includes('cliente') || k.includes('atencion')) return 'SJT Atención al cliente'
  if (k.includes('documentos') || k.includes('comparacion') || k.includes('concentracion')) return 'Atención al Detalle y Precisión'
  if (k.includes('burnout') || k.includes('estres') || k.includes('carga laboral')) return 'Bienestar y Salud Laboral'
  if (k.includes('etica') || k.includes('negociacion') || k.includes('manejo emocional')) return 'Competencias Profesionales (SJT)'

  // Mapeo específico de UUIDs técnicos (como respaldo)
  const UUID_MAP: Record<string, string> = {
    'd0e1f2a3-b4c5-6789-defa-000000000001': 'Competencias Profesionales (SJT)',
    'b8c9d0e1-f2a3-4567-bcde-888888888888': 'Bienestar y Salud Laboral',
    'f3a4b5c6-d7e8-4950-a1b2-999999999999': 'Atención al Detalle y Precisión'
  }
  if (testId && UUID_MAP[testId]) return UUID_MAP[testId]

  return testId || 'Evaluación'
}

function fmtFecha(f: string) {
  return new Date(f).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function hoy() {
  return new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const COMP_MAP: Record<string, string[]> = {
  'Integridad': ['Integridad'],
  'Tolerancia a la presión': ['Tolerancia a la frustración', 'Estrés laboral'],
  'Orientación al cliente': ['SJT Atención al cliente', 'SJT Ventas', 'Competencias comerciales'],
  'Pensamiento analítico': ['Resolución de problemas', 'Test cognitivo'],
  'Creatividad e innovación': ['Creatividad'],
  'Negociación': ['SJT Ventas', 'SJT Cobranzas', 'SJT Comercial'],
  'Autocontrol': ['Tolerancia a la frustración', 'Estrés laboral'],
  'Ética profesional': ['Integridad', 'SJT Legal']
}

function calcAjuste(req: { nombre: string, nivel: string }[], sesiones: Sesion[]) {
  if (!req || req.length === 0) return null;
  let totalPct = 0;
  let count = 0;
  const detalles: { nombre: string, nivelReq: string, puntaje: number | null, pct: number | null }[] = [];

  req.filter(r => r.nivel !== 'D').forEach(r => {
    let score: number | null = null;
    const tests = COMP_MAP[r.nombre] || [];
    for (const s of sesiones) {
      if (!s.puntaje_bruto || isPersonalidad(s.puntaje_bruto) || isCog(s.puntaje_bruto)) continue;
      const tn = testNombre(s.puntaje_bruto);
      if (tests.includes(tn)) {
        score = avgOf(s.puntaje_bruto);
        break;
      }
    }
    // Also check for cognitive
    if (score === null && r.nombre === 'Pensamiento analítico') {
      const cog = sesiones.find(s => s.puntaje_bruto && isCog(s.puntaje_bruto));
      if (cog) {
        const cData = cogData(cog.puntaje_bruto);
        // Normalize 1-100 to 1-5 scale roughly
        score = (cData.pct / 100) * 5;
      }
    }

    if (score !== null) {
      const target = r.nivel === 'A' ? 4.5 : r.nivel === 'B' ? 3.5 : 2.5;
      const pct = score >= target ? 100 : Math.max(0, Math.round(100 - ((target - score) * 30)));
      detalles.push({ nombre: r.nombre, nivelReq: r.nivel, puntaje: score, pct });
      totalPct += pct;
      count++;
    } else {
      detalles.push({ nombre: r.nombre, nivelReq: r.nivel, puntaje: null, pct: null });
    }
  });

  const general = count > 0 ? Math.round(totalPct / count) : null;
  return { general, detalles };
}

// ─── Sub-componente: fila de dato ─────────────────────────────────────────────

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: '#1e293b' }}>{value}</span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function InformePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')

  const [candidato, setCandidato] = useState<Candidato | null>(null)
  const [proceso, setProceso] = useState<Proceso | null>(null)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [generandoIA, setGenerandoIA] = useState(false)

  const [inf, setInf] = useState<InformeState>({
    resumenEjecutivo: '',
    comentarioPersonalidad: '',
    interpretacionPorFactor: {},
    comentarioCognitivo: '',
    comentarioCompetencias: '',
    recomendacion: 'recomendado',
    fundamentacion: '',
    ajusteMbti: '',
    nombreEvaluador: '',
    fortalezas: [] as string[],
    oportunidadesMejora: [] as string[],
    ajusteCargo: { score: 0, analisis: '' },
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
  }, [])

  useEffect(() => {
    if (!candidatoId) return
    cargarDatos()
  }, [candidatoId, procesoId])

  async function cargarDatos() {
    setCargando(true)
    const [{ data: cand }, { data: ses }] = await Promise.all([
      supabase.from('candidatos').select('*').eq('id', candidatoId!).single(),
      supabase.from('sesiones').select('*').eq('candidato_id', candidatoId!).order('finalizada_en', { ascending: false }),
    ])

    let proc: Proceso | null = null
    if (procesoId) {
      const { data } = await supabase.from('procesos').select('nombre, cargo, descripcion_cargo, competencias_requeridas').eq('id', procesoId).single()
      if (data) proc = data
    }

    setCandidato(cand)
    setProceso(proc)

    const lista = (ses || []) as Sesion[]
    setSesiones(lista)

    // Pre-poblar interpretaciones automáticas para todas las dimensiones
    const interps: Record<string, string> = {}
    lista.forEach(sesion => {
      if (!sesion.puntaje_bruto) return
      numEntries(sesion.puntaje_bruto).forEach(([factor, valor]) => {
        const f = factor.toLowerCase()
        const l = lvl(valor)
        // Buscamos en el diccionario global de interpretaciones
        if (INTERP[f]) {
          interps[`${sesion.id}_${f}`] = INTERP[f][l] || ''
        }
      })
    })
    setInf(prev => ({ ...prev, interpretacionPorFactor: interps }))
    setCargando(false)
  }

  function upd<K extends keyof InformeState>(k: K, v: InformeState[K]) {
    setInf(prev => ({ ...prev, [k]: v }))
  }
  function updFactor(key: string, val: string) {
    setInf(prev => ({ ...prev, interpretacionPorFactor: { ...prev.interpretacionPorFactor, [key]: val } }))
  }

  // Clasificación de sesiones (solo la más reciente)
  const sesBF   = sesiones.filter(s => s.puntaje_bruto && isBF(s.puntaje_bruto)).slice(0, 1)
  const sesHX   = sesiones.filter(s => s.puntaje_bruto && isHX(s.puntaje_bruto)).slice(0, 1)
  const sesCog  = sesiones.filter(s => s.puntaje_bruto && isCog(s.puntaje_bruto)).slice(0, 1)
  
  const compMap = new Map()
  sesiones.filter(s => s.puntaje_bruto && !isPersonalidad(s.puntaje_bruto) && !isCog(s.puntaje_bruto)).forEach(s => {
    const tn = testNombre(s.puntaje_bruto, s.test_id)
    if (!compMap.has(tn)) compMap.set(tn, s)
  })
  const sesComp = Array.from(compMap.values()) as Sesion[]
  const videos  = sesiones.filter(s => s.test_id === 'video' || s.transcripcion)

  const hasP = sesBF.length > 0 || sesHX.length > 0
  const hasC = sesCog.length > 0
  const hasK = sesComp.length > 0

  // ─── Generación de PDF ───────────────────────────────────────────────────────

  async function generarConIA() {
    if (!candidato) return
    setGenerandoIA(true)
    try {
      const response = await fetch('/api/generar-informe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidato,
          proceso,
          sesiones,
          hasP, hasC, hasK
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.detalle ? `${data.error}: ${data.detalle}` : (data.error || 'Error desconocido al conectar con Gemini'))
      }
      
      setInf(prev => ({
        ...prev,
        resumenEjecutivo: data.resumenEjecutivo || prev.resumenEjecutivo,
        comentarioPersonalidad: data.comentarioPersonalidad || prev.comentarioPersonalidad,
        comentarioCognitivo: data.comentarioCognitivo || prev.comentarioCognitivo,
        comentarioCompetencias: data.comentarioCompetencias || prev.comentarioCompetencias,
        recomendacion: (data.recomendacion === 'reservas' ? 'con_reservas' : data.recomendacion) || prev.recomendacion,
        fundamentacion: data.fundamentacion || prev.fundamentacion,
        ajusteMbti: data.ajusteMbti || prev.ajusteMbti,
        fortalezas: data.fortalezas || prev.fortalezas,
        oportunidadesMejora: data.oportunidadesMejora || prev.oportunidadesMejora,
        ajusteCargo: data.ajusteCargo || prev.ajusteCargo,
        interpretacionPorFactor: { 
          ...prev.interpretacionPorFactor, 
          ...(data.interpretacionPorFactor || {}) 
        }
      }))
      
      alert('¡Análisis generado con éxito por Gemini!')
    } catch (err: any) {
      console.error(err)
      alert('Hubo un problema: ' + err.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  async function descargarPDF() {
    if (!candidato) return
    setGenerando(true)
    try {
      const pdfData = {
        candidato,
        proceso,
        sesiones,
        videos,
        inf,
        helpers: {
          hasP, hasC, hasK, sesBF, sesHX, sesCog, sesComp,
          ETQ, CLR, clrOf, lvl, numEntries, testNombre, cogData,
          avgOf, interpretarPercentil, hoy,
          obtenerPercentilCognitivo, obtenerPercentilBigFive,
          estimarMBTI, MBTI_DESC
        }
      }

      const { pdf } = await import('@react-pdf/renderer')
      const { InformePDF } = await import('@/components/InformePDF')
      
      const blob = await pdf(<InformePDF data={pdfData} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fecha = hoy()
      const arch = `informe-${candidato.nombre}-${candidato.apellido}-${fecha.replace(/\//g, '-')}.pdf`
        .toLowerCase().replace(/ /g, '-')
      a.download = arch
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert('Hubo un error al generar el PDF.')
    } finally {
      setGenerando(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (cargando) return <div style={s.centro}><p>Cargando informe...</p></div>
  if (!candidato) return <div style={s.centro}><p>Candidato no encontrado.</p></div>

  const nombre = `${candidato.nombre} ${candidato.apellido}`

  return (
    <div style={s.outer}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="/panel" style={s.btnBack}>← Panel</a>
          <span style={s.toolbarTitulo}>{nombre}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={generarConIA}
            disabled={generandoIA || generando}
            style={{ ...s.btnBack, background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe', opacity: generandoIA ? 0.7 : 1 }}
          >
            <Sparkles size={16} />
            {generandoIA ? 'Analizando...' : 'Generar con IA'}
          </button>
          <button
            style={{ ...s.btnPDF, opacity: generando ? 0.7 : 1 }}
            onClick={descargarPDF}
            disabled={generando || generandoIA}
          >
            {generando ? 'Generando PDF...' : '⬇ Descargar PDF'}
          </button>
        </div>
      </div>

      <div style={s.pagina}>

        {/* ── 1. DATOS ───────────────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardHeadTxt}>Datos del candidato</span></div>
          <div style={s.datoGrid}>
            <Dato label="Nombre completo" value={nombre} />
            <Dato label="Email" value={candidato.email} />
            <Dato label="Documento" value={candidato.documento || '—'} />
            <Dato label="Fecha de informe" value={hoy()} />
            {proceso && <Dato label="Proceso" value={proceso.nombre} />}
            {proceso && <Dato label="Cargo" value={proceso.cargo} />}
          </div>
        </div>

        {/* ── 2. ANÁLISIS ESTRATÉGICO (I) ────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardHeadTxt}>I. Diagnóstico Estratégico y Ajuste al Perfil</span></div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'center', minWidth: '120px' }}>
              <div style={{ fontSize: '2.8rem', fontWeight: '900', color: clrOf(inf.ajusteCargo?.score || 0, 100), lineHeight: 1 }}>{inf.ajusteCargo?.score || 0}%</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 'bold' }}>Ajuste Estimado</div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.commentLabel}>Justificación del Ajuste al Perfil</label>
              <textarea
                style={{ ...s.ta, background: 'transparent', border: 'none', padding: '4px 0', fontSize: '0.95rem' }}
                rows={3}
                placeholder="Análisis estratégico de por qué el candidato encaja con los desafíos del cargo..."
                value={inf.ajusteCargo?.analisis || ''}
                onChange={e => setInf(p => ({ ...p, ajusteCargo: { ...p.ajusteCargo, analisis: e.target.value } }))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <h4 style={{ color: '#16a34a', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem' }}>
                <Sparkles size={18} /> Fortalezas Clave
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(inf.fortalezas || []).map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                    <input
                      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #dcfce7', width: '100%', fontSize: '0.9rem', color: '#14532d', padding: '2px 0' }}
                      value={f}
                      onChange={e => {
                        const n = [...inf.fortalezas]; n[i] = e.target.value;
                        setInf(p => ({ ...p, fortalezas: n }));
                      }}
                    />
                  </div>
                ))}
                {(!inf.fortalezas || inf.fortalezas.length === 0) && (
                  <p style={{ fontSize: '0.85rem', color: '#16a34a', fontStyle: 'italic', opacity: 0.7 }}>Pulse 'Generar con IA' para identificar fortalezas...</p>
                )}
              </div>
            </div>
            <div style={{ background: '#fff7ed', padding: '1.25rem', borderRadius: '12px', border: '1px solid #ffedd5' }}>
              <h4 style={{ color: '#ea580c', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem' }}>
                <AlertCircle size={18} /> Áreas de Desarrollo / Riesgos
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(inf.oportunidadesMejora || []).map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ea580c' }} />
                    <input
                      style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #ffedd5', width: '100%', fontSize: '0.9rem', color: '#7c2d12', padding: '2px 0' }}
                      value={f}
                      onChange={e => {
                        const n = [...inf.oportunidadesMejora]; n[i] = e.target.value;
                        setInf(p => ({ ...p, oportunidadesMejora: n }));
                      }}
                    />
                  </div>
                ))}
                {(!inf.oportunidadesMejora || inf.oportunidadesMejora.length === 0) && (
                  <p style={{ fontSize: '0.85rem', color: '#ea580c', fontStyle: 'italic', opacity: 0.7 }}>Pulse 'Generar con IA' para identificar desafíos...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. RESUMEN EJECUTIVO ───────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardHeadTxt}>Análisis Integrativo Final</span>
            <span style={s.badge}>Editable</span>
          </div>
          <textarea
            style={s.ta}
            rows={6}
            placeholder="Síntesis profunda del perfil del candidato: integración de personalidad, cognición y potencial de éxito..."
            value={inf.resumenEjecutivo}
            onChange={e => upd('resumenEjecutivo', e.target.value)}
          />
        </div>

        {/* ── 4. I. DIAGNÓSTICO ESTRATÉGICO Y AJUSTE AL PERFIL ───────────────── */}
        {proceso && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>I. Diagnóstico Estratégico y Ajuste al Perfil</span>
              <span style={s.badge}>Resultados Globales</span>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569', margin: '0 0 0.5rem 0' }}>Misión y responsabilidades del puesto</h4>
                <p style={{ fontSize: '0.875rem', color: '#1e293b', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {proceso.descripcion_cargo || 'Descripción no disponible'}
                </p>
              </div>

              {proceso.competencias_requeridas && proceso.competencias_requeridas.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569', margin: '0 0 1rem 0' }}>Análisis de brechas (Competencias requeridas vs Resultados)</h4>
                  
                  {(() => {
                    const ajuste = calcAjuste(proceso.competencias_requeridas, sesiones)
                    if (!ajuste || ajuste.general === null) return <p style={{ fontSize: '0.8rem', color: '#64748b' }}>No hay resultados suficientes para calcular el ajuste.</p>
                    
                    const gClr = ajuste.general >= 80 ? '#16a34a' : ajuste.general >= 60 ? '#ea580c' : '#dc2626'
                    
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>Índice general de ajuste</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: gClr }}>{ajuste.general}%</span>
                        </div>

                        {ajuste.detalles.map(det => {
                          if (det.pct === null) return null;
                          const clr = det.pct >= 80 ? '#16a34a' : det.pct >= 60 ? '#ea580c' : '#dc2626'
                          const lv = det.pct >= 80 ? 'Alto' : det.pct >= 60 ? 'Medio' : 'Bajo'
                          return (
                            <div key={det.nombre} style={s.factBlk}>
                              <div style={s.factRow}>
                                <span style={s.factName}>{det.nombre} (Req: Nivel {det.nivelReq})</span>
                                <span style={{ ...s.factLvl, color: clr }}>Ajuste {lv} · {det.pct}%</span>
                              </div>
                              <div style={s.barBg}>
                                <div style={{ ...s.barFill, width: `${det.pct}%`, background: clr }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 5. II. PERFIL CONDUCTUAL Y PERSONALIDAD ───────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardHeadTxt}>II. Perfil Conductual y Estilo de Personalidad</span>
            <span style={s.badge}>Dimensión Conductual</span>
          </div>

          {(sesBF.length === 0 && sesHX.length === 0) ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic' }}>
              No se han detectado pruebas de personalidad (Big Five o HEXACO) finalizadas para este candidato. 
              Si los datos existen, verifique que la sesión esté correctamente cerrada.
            </div>
          ) : (
            sesBF.concat(sesHX).map((sesion) => (
              <div key={sesion.id} style={{ marginBottom: '1.5rem' }}>
                {numEntries(sesion.puntaje_bruto).map(([factor, valor]) => {
                  const numVal = Number(typeof valor === 'object' ? valor.correctas || valor.score : (valor || 0))
                  const max = (valor && typeof valor === 'object' && 'total' in valor) ? (Number(valor.total) || 5) : 5
                  const normVal = max > 0 ? Math.round((numVal / max) * 5 * 10) / 10 : 0
                  const lv = lvl(valor)
                  const clr = clrOf(numVal, max)
                  const fk = `${sesion.id}_${factor}`
                  return (
                    <div key={factor} style={s.factBlk}>
                      <div style={s.factRow}>
                        <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                        <span style={{ ...s.factLvl, color: clr }}>{lv} · {normVal}/5</span>
                      </div>
                      <div style={s.barBg}>
                        <div style={{ ...s.barFill, width: `${(normVal / 5) * 100}%`, background: clr }} />
                      </div>
                      <textarea
                        style={s.taFact}
                        rows={2}
                        value={inf.interpretacionPorFactor[fk] ?? ''}
                        onChange={e => updFactor(fk, e.target.value)}
                        placeholder="Interpretación del evaluador para este rasgo..."
                      />
                    </div>
                  )
                })}
              </div>
            ))
          )}
          
          {/* MBTI Section */}
          {(sesBF.length > 0 || inf.ajusteMbti) && (
            <div style={{ padding: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
              {(() => {
                const mbti = sesBF[0] ? estimarMBTI(sesBF[0].puntaje_bruto) : null
                return (
                  <>
                    <div style={s.factRow}>
                      <span style={{ ...s.factName, color: '#9333ea', fontSize: '1rem' }}>Tipología Predictiva: {mbti || (inf.ajusteMbti ? 'Estimación por Perfil' : 'No determinado')}</span>
                    </div>
                    {mbti && (
                      <p style={{ fontSize: '0.85rem', color: '#475569', margin: '8px 0', lineHeight: '1.5' }}>
                        {MBTI_DESC[mbti]}
                      </p>
                    )}
                    <label style={{ ...s.commentLabel, marginTop: '1rem', display: 'block', color: '#7e22ce' }}>Análisis de Ajuste de la Tipología al Cargo</label>
                    <textarea
                      style={{ ...s.ta, borderColor: '#e9d5ff', marginTop: '0.5rem', background: '#fff' }}
                      rows={3}
                      placeholder="Análisis cualitativo del grado de ajuste de esta tipología al puesto..."
                      value={inf.ajusteMbti}
                      onChange={e => upd('ajusteMbti', e.target.value)}
                    />
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* ── 6. III. CAPACIDAD ANALÍTICA ───────────────────────────────────── */}
        {hasC && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>III. Capacidad Analítica y Potencial Cognitivo</span>
              <span style={s.badge}>Métricas de Aptitud</span>
            </div>
            {sesCog.map((sesion) => {
              const { correctas, total, percentil } = cogData(sesion.puntaje_bruto)
              const normVal = Math.round((correctas / total) * 5 * 10) / 10
              const nivel = nivelPercentil(percentil)
              const entries = numEntries(sesion.puntaje_bruto).filter(([k]) => k !== 'correctas' && k !== 'total' && k !== 'score' && k !== 'percentil');
              return (
                <div key={sesion.id}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', padding: '1.25rem' }}>
                    <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0369a1' }}>{normVal}/5</div>
                      <div style={{ fontSize: '0.7rem', color: '#0369a1', textTransform: 'uppercase', fontWeight: 'bold' }}>Efectividad Cognitiva</div>
                    </div>
                    <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0369a1' }}>P{percentil}</div>
                      <div style={{ fontSize: '0.7rem', color: '#0369a1', textTransform: 'uppercase', fontWeight: 'bold' }}>{nivel}</div>
                    </div>
                  </div>
                  {entries.map(([factor, valor]) => {
                    const vNum = typeof valor === 'object' ? valor.correctas : valor
                    const vMax = (valor && typeof valor === 'object' && 'total' in valor) ? Number(valor.total) : total
                    const vNorm = Math.round((vNum / vMax) * 5 * 10) / 10
                    return (
                      <div key={factor} style={s.factBlk}>
                        <div style={s.factRow}>
                          <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                          <span style={{ ...s.factLvl, color: '#334155' }}>{vNorm}/5</span>
                        </div>
                        <div style={s.barBg}>
                          <div style={{ ...s.barFill, width: `${(vNorm / 5) * 100}%`, background: '#0369a1' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* ── 7. IV. COMPETENCIAS PROFESIONALES ─────────────────────────────── */}
        {hasK && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>IV. Competencias Profesionales</span>
              <span style={s.badge}>Desempeño Situacional</span>
            </div>
            {sesComp.map((sesion) => (
              <div key={sesion.id} style={{ marginBottom: '1.5rem' }}>
                {numEntries(sesion.puntaje_bruto).filter(([f]) => DOMINIOS.COMPETENCIAS.includes(f)).map(([factor, valor]) => {
                  const rawVal = typeof valor === 'object' ? (valor.correctas || valor.score || 0) : (valor || 0)
                  const rawMax = (valor && typeof valor === 'object' && 'total' in valor) ? (Number(valor.total) || 5) : 5
                  const numVal = Number(rawVal)
                  const max = Number(rawMax)
                  
                  const normVal = (!isNaN(numVal) && max > 0) ? Math.round((numVal / max) * 5 * 10) / 10 : 0
                  const clr = clrOf(normVal, 5)
                  const fk = `${sesion.id}_${factor}`
                  return (
                    <div key={factor} style={s.factBlk}>
                      <div style={s.factRow}>
                        <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                        <span style={{ ...s.factLvl, color: clr }}>{normVal}/5</span>
                      </div>
                      <div style={s.barBg}>
                        <div style={{ ...s.barFill, width: `${(normVal / 5) * 100}%`, background: clr }} />
                      </div>
                      <textarea
                        style={s.taFact}
                        rows={2}
                        value={inf.interpretacionPorFactor[fk] ?? ''}
                        onChange={e => updFactor(fk, e.target.value)}
                        placeholder="Análisis cualitativo de esta competencia..."
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── 8. V. SALUD Y BIENESTAR LABORAL ──────────────────────────────── */}
        {hasK && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>V. Salud y Bienestar Laboral</span>
              <span style={s.badge}>Indicadores de Riesgo</span>
            </div>
            {sesComp.map((sesion) => (
              <div key={sesion.id} style={{ marginBottom: '1.5rem' }}>
                {numEntries(sesion.puntaje_bruto).filter(([f]) => DOMINIOS.BIENESTAR.includes(f)).map(([factor, valor]) => {
                  let rawVal = typeof valor === 'object' ? (valor.correctas || valor.score || 0) : (valor || 0)
                  
                  // Traducción de valores cualitativos a numéricos
                  if (typeof rawVal === 'string') {
                    const s = rawVal.toLowerCase().trim()
                    if (s === 'bajo') rawVal = 1.5
                    else if (s === 'medio') rawVal = 3.0
                    else if (s === 'alto') rawVal = 5.0
                  }

                  const rawMax = (valor && typeof valor === 'object' && 'total' in valor) ? (Number(valor.total) || 5) : 5
                  const numVal = Number(rawVal)
                  const max = Number(rawMax)
                  
                  const normVal = (!isNaN(numVal) && max > 0) ? Math.round((numVal / max) * 5 * 10) / 10 : 0
                  const clr = clrOf(normVal, 5)
                  const fk = `${sesion.id}_${factor}`
                  return (
                    <div key={factor} style={s.factBlk}>
                      <div style={s.factRow}>
                        <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                        <span style={{ ...s.factLvl, color: clr }}>{normVal}/5</span>
                      </div>
                      <div style={s.barBg}>
                        <div style={{ ...s.barFill, width: `${(normVal / 5) * 100}%`, background: clr }} />
                      </div>
                      <textarea
                        style={s.taFact}
                        rows={2}
                        value={inf.interpretacionPorFactor[fk] ?? ''}
                        onChange={e => updFactor(fk, e.target.value)}
                        placeholder="Análisis de bienestar y posibles riesgos..."
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── 6. RECOMENDACIÓN ──────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardHeadTxt}>Recomendación final</span></div>

          <div style={s.recBtns}>
            {(['recomendado', 'con_reservas', 'no_recomendado'] as Rec[]).map(op => (
              <button
                key={op}
                style={{
                  ...s.recBtn,
                  borderColor: inf.recomendacion === op ? REC_COLOR[op] : '#e2e8f0',
                  background: inf.recomendacion === op ? REC_COLOR[op] + '18' : '#fff',
                  color: inf.recomendacion === op ? REC_COLOR[op] : '#64748b',
                  fontWeight: inf.recomendacion === op ? '700' : '400',
                }}
                onClick={() => upd('recomendacion', op)}
              >
                {REC_LABELS[op]}
              </button>
            ))}
          </div>

          <div style={{
            ...s.sello,
            background: REC_COLOR[inf.recomendacion] + '12',
            borderColor: REC_COLOR[inf.recomendacion] + '50',
            color: REC_COLOR[inf.recomendacion],
          }}>
            {REC_LABELS[inf.recomendacion].toUpperCase()}
          </div>

          <label style={{ ...s.commentLabel, marginTop: '1rem', display: 'block' }}>Fundamentación</label>
          <textarea
            style={s.ta}
            rows={4}
            placeholder="Justificación de la recomendación considerando el perfil evaluado y las exigencias del cargo..."
            value={inf.fundamentacion}
            onChange={e => upd('fundamentacion', e.target.value)}
          />
        </div>

        {/* ── 7. EVALUADOR ──────────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardHeadTxt}>Evaluador/a</span></div>
          <label style={s.commentLabel}>Nombre y matrícula</label>
          <input
            style={s.inp}
            placeholder="Lic. María García — Mat. 12345"
            value={inf.nombreEvaluador}
            onChange={e => upd('nombreEvaluador', e.target.value)}
          />
          <p style={s.firmaTxt}>Firma y sello: ______________________________</p>
        </div>

      </div>
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' },
  outer: { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'sans-serif' },
  toolbar: {
    position: 'sticky', top: 0, zIndex: 10,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 2rem', background: '#fff',
    borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  btnBack: {
    padding: '0.375rem 0.875rem', background: '#f1f5f9', color: '#475569',
    border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem',
    textDecoration: 'none', whiteSpace: 'nowrap',
  },
  toolbarTitulo: { fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' },
  btnPDF: {
    padding: '0.5rem 1.25rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  pagina: { maxWidth: '820px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  card: { background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' },
  cardHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.875rem 1.25rem', background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0', borderLeft: '3px solid #2563eb',
  },
  cardHeadTxt: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' },
  badge: { fontSize: '0.7rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '99px', fontWeight: '500' },
  datoGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.25rem' },
  ta: {
    width: '100%', padding: '0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '8px',
    fontSize: '0.875rem', color: '#1e293b', fontFamily: 'sans-serif', resize: 'vertical',
    lineHeight: '1.5', outline: 'none', boxSizing: 'border-box', background: '#fafafa',
  },
  taFact: {
    width: '100%', padding: '0.5rem 0.75rem', border: '1px dashed #cbd5e1', borderRadius: '6px',
    fontSize: '0.8rem', color: '#475569', fontFamily: 'sans-serif', resize: 'vertical',
    lineHeight: '1.45', outline: 'none', boxSizing: 'border-box', background: '#f8fafc',
    marginTop: '0.5rem',
  },
  inp: {
    width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '8px',
    fontSize: '0.875rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box', background: '#fafafa',
  },
  sesLabel: { fontSize: '0.75rem', fontWeight: '600', color: '#64748b', margin: '0.5rem 0 0.25rem', padding: '0 1.25rem' },
  factBlk: { padding: '0.75rem 1.25rem', borderBottom: '1px solid #f1f5f9' },
  factRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' },
  factName: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' },
  factLvl: { fontSize: '0.8rem', fontWeight: '500' },
  barBg: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' },
  commentWrap: { padding: '1rem 1.25rem' },
  commentLabel: { fontSize: '0.75rem', fontWeight: '500', color: '#475569', display: 'block', marginBottom: '6px' },
  recBtns: { display: 'flex', gap: '0.75rem', padding: '1.25rem 1.25rem 0.75rem', flexWrap: 'wrap' },
  recBtn: {
    flex: 1, minWidth: '140px', padding: '0.625rem 1rem', border: '2px solid', borderRadius: '8px',
    fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s',
  },
  sello: {
    margin: '0 1.25rem 1rem', padding: '0.75rem', border: '2px solid', borderRadius: '8px',
    textAlign: 'center', fontSize: '0.9rem', fontWeight: '800', letterSpacing: '0.05em',
  },
  firmaTxt: { fontSize: '0.875rem', color: '#94a3b8', margin: '0.75rem 0 0', padding: '0 1.25rem', paddingBottom: '1.25rem' },
}
