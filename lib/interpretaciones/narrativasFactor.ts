/**
 * lib/interpretaciones/narrativasFactor.ts
 *
 * Banco único de narrativas sugeridas (alto/medio/bajo) por factor, compartido
 * entre la vista web del informe (app/informe/page.tsx) y el PDF (components/
 * InformePDF.tsx). Antes vivía duplicado en ambos archivos con redacción y
 * umbrales distintos para el mismo factor; este módulo es la fuente única.
 *
 * En la web, este texto es solo la sugerencia inicial de un campo editable
 * (el evaluador puede sobreescribirla por candidato/sesión). En el PDF, es el
 * último fallback cuando no hay interpretación de IA guardada para ese factor.
 *
 * Módulo puro: no accede a Supabase ni a datos externos.
 */

export type NivelFactor = 'alto' | 'medio' | 'bajo'

export type NarrativasFactor = Record<string, Record<NivelFactor, string>>

export const NARRATIVAS_FACTOR: NarrativasFactor = {
  // ── Personalidad (Big Five) ─────────────────────────────────────────────
  extraversion: {
    alto: 'Posee una notable facultad para la interacción social y la construcción de redes de colaboración efectivas. Su estilo comunicativo es activo y dinámico, aportando una energía propositiva que favorece el intercambio de ideas y la vitalidad operativa en entornos de alta exposición.',
    medio: 'Mantiene un equilibrio profesional entre la colaboración grupal y el trabajo enfocado. Es capaz de integrarse con fluidez a las dinámicas de equipo cuando el objetivo lo requiere, comunicándose de forma clara y eficiente sin descuidar su autonomía.',
    bajo: 'Muestra una preferencia por entornos de trabajo que privilegian el análisis reflexivo y la concentración profunda. Su valor reside en tareas que requieren autonomía y un procesamiento pausado de la información, lejos de la estimulación social constante.'
  },
  amabilidad: {
    alto: 'Se distingue por un estilo relacional armónico y una marcada vocación de soporte hacia su entorno de trabajo. Su capacidad para colaborar de forma empática facilita la cohesión del equipo, promoviendo un ambiente de respeto mutuo y comunicación fluida.',
    medio: 'Logra un equilibrio saludable entre la firmeza para cumplir objetivos y la cordialidad para mantener un buen trato con sus pares. Defiende sus criterios técnicos de forma profesional, asegurando que sus interacciones contribuyan a la estabilidad del equipo.',
    bajo: 'Prioriza el pragmatismo y la obtención de resultados directos sobre las dinámicas interpersonales de grupo. Su estilo es franco y orientado a la tarea, lo que resulta eficiente en entornos donde la claridad y la rapidez son críticas para el éxito.'
  },
  responsabilidad: {
    alto: 'Identifica un compromiso sólido y una organización minuciosa en el cumplimiento de sus responsabilidades. Su enfoque es metódico y orientado a la calidad, asegurando una ejecución confiable y alineada con los estándares de excelencia organizacionales.',
    medio: 'Organiza su flujo de trabajo de manera funcional, cumpliendo consistentemente con sus responsabilidades profesionales. Gestiona sus prioridades con autonomía dentro de marcos predefinidos, manteniendo un estándar de calidad estable en sus funciones.',
    bajo: 'Su desempeño es más fluido en entornos que brinden objetivos claros de corto plazo y una estructura de seguimiento definida. Se beneficia de herramientas de planificación que le permitan mantener el foco en las metas inmediatas con efectividad.'
  },
  neuroticismo: {
    alto: 'Muestra una notable serenidad y temple ante situaciones de alta demanda o imprevistos operativos. Logra mantener el foco profesional bajo presión, lo que le permite abordar desafíos complejos con una objetividad que transmite seguridad al equipo.',
    medio: 'Gestiona sus reacciones de forma profesional y equilibrada ante las demandas laborales habituales. Mantiene un rendimiento constante y un trato estable, mostrando una capacidad de ajuste adecuada a las variaciones de la carga de trabajo.',
    bajo: 'El perfil se siente más productivo en entornos de trabajo estables y con metas bien definidas. Ante situaciones de mucha presión, se beneficia de un liderazgo que brinde claridad y apoyo para procesar los desafíos sin comprometer su efectividad.'
  },
  apertura: {
    alto: 'Se caracteriza por una mentalidad abierta y una disposición natural hacia el aprendizaje continuo y la innovación. Posee una curiosidad intelectual que favorece la adaptabilidad de los procesos ante entornos laborales en constante evolución.',
    medio: 'Muestra una receptividad adecuada hacia el cambio y la actualización de sus competencias. Se adapta a nuevas metodologías cuando percibe un beneficio claro, manteniendo un equilibrio entre la innovación y los métodos ya probados.',
    bajo: 'Posee una marcada preferencia por los procedimientos establecidos y las rutinas predecibles. Su mayor valor reside en funciones que requieran un seguimiento riguroso de normativas y donde la especialización sea el factor clave de éxito operativo.'
  },
  normas: {
    alto: 'Muestra una sintonía clara con los marcos de integridad y cumplimiento institucional. Es un perfil que valora la transparencia y el respeto por los procedimientos establecidos, lo que contribuye a una gestión de riesgos controlada para la organización.',
    medio: 'Demuestra un comportamiento profesional alineado con las normas de convivencia y legalidad de la empresa. Respeta las reglas establecidas y valora la claridad en el trato diario, mostrando un criterio equilibrado y confiable.',
    bajo: 'Su estilo de toma de decisiones prioriza la resolución pragmática y el criterio individual sobre los marcos normativos rígidos. Se beneficiará de una cultura organizacional con lineamientos de cumplimiento explícitos y un acompañamiento que oriente su autonomía.'
  },
  honestidad: {
    alto: 'Se destaca por una comunicación transparente y directa. Su estilo facilita la construcción de confianza y el intercambio de información honesta, siendo un perfil orientado a la claridad y la integridad institucional en todo momento.',
    medio: 'Mantiene una comunicación equilibrada y profesional. Es capaz de plantear sus puntos de vista manteniendo las formas institucionales, logrando transmitir información relevante de manera asertiva y honesta.',
    bajo: 'En ocasiones podría reservar información para evitar tensiones o conflictos inmediatos. Se sugiere fomentar un canal de comunicación abierto y validar la información importante mediante indicadores de gestión objetivos.'
  },
  promedio_general: {
    alto: 'El perfil proyecta una coherencia profesional destacada en su conducta. Sus valores personales se manifiestan en un compromiso sólido con la integridad, favoreciendo una alineación confiable con la cultura y principios de la empresa.',
    medio: 'Posee un nivel de integridad acorde a las expectativas corporativas. Su comportamiento es predecible dentro de los marcos éticos estándar, mostrando un juicio profesional funcional, prudente y equilibrado.',
    bajo: 'Se observa un estilo de toma de decisiones que prioriza la resolución pragmática y el criterio individual. Se beneficiará de una cultura organizacional con marcos de cumplimiento claros y un acompañamiento que alinee su autonomía con los protocolos institucionales.'
  },
  logro: {
    alto: 'Manifiesta una fuerte orientación al logro, fijándose metas exigentes y sosteniendo el esfuerzo hasta superar lo esperado. Su enfoque favorece el cumplimiento de objetivos desafiantes con un mínimo de seguimiento externo.',
    medio: 'Presenta un nivel adecuado de motivación al logro, respondiendo de forma consistente ante exigencias puntuales. Cumple con lo solicitado y puede escalar su esfuerzo cuando la situación lo requiere.',
    bajo: 'Reporta una menor motivación de logro autopercibida, pudiendo requerir objetivos concretos y un seguimiento más explícito para sostener el esfuerzo en el tiempo.'
  },
  dinamismo: {
    alto: 'Se caracteriza por un alto nivel de energía y actividad, manteniéndose ocupado y respondiendo con rapidez ante múltiples demandas simultáneas. Se adapta con soltura a ritmos de trabajo exigentes.',
    medio: 'Sostiene un ritmo de trabajo equilibrado, adaptándose tanto a tareas que exigen celeridad como a otras de ejecución más pausada, sin comprometer la calidad de su desempeño.',
    bajo: 'Presenta un estilo más pausado y reflexivo, prefiriendo avanzar a un ritmo propio antes que bajo presión constante. Puede rendir mejor en entornos que permitan planificar con anticipación.'
  },

  // ── Cognitivo / Aptitud ──────────────────────────────────────────────────
  documentos: {
    alto: 'Organiza y revisa su trabajo con orden y prolijidad. Maneja bien grandes cantidades de información, lo que ayuda a que las tareas administrativas avancen sin errores ni demoras.',
    medio: 'Mantiene sus documentos y registros con un orden adecuado. Revisa la información con cuidado, lo que permite que las tareas de soporte avancen sin problemas.',
    bajo: 'Tiende a priorizar la rapidez por sobre el detalle en el manejo de documentos. Le conviene apoyarse en listas de chequeo o una revisión final antes de cerrar una tarea, para no dejar nada pendiente.'
  },
  comparacion: {
    alto: 'Detecta diferencias y compara información con rapidez y precisión, lo que le permite responder con agilidad en tareas que requieren revisar datos una y otra vez.',
    medio: 'Compara y revisa información a un ritmo parejo, manteniendo un buen nivel de calidad en el resultado final.',
    bajo: 'Prefiere tomarse su tiempo al comparar datos para no cometer errores. Rinde mejor en tareas que no dependen de una respuesta inmediata, donde puede revisar con calma.'
  },
  concentracion: {
    alto: 'Mantiene el foco de forma constante, incluso en ambientes con muchas interrupciones. Puede sostener tareas complejas durante períodos largos sin perder calidad.',
    medio: 'Mantiene un nivel de atención adecuado durante la jornada. Logra concentrarse en sus tareas a pesar de las distracciones habituales.',
    bajo: 'Su atención puede verse afectada en ambientes con muchos estímulos. Rinde mejor en espacios de trabajo tranquilos y ordenados, que le ayuden a mantener el foco.'
  },
  errores_texto: {
    alto: 'Es muy cuidadosa al escribir y revisar textos, y detecta errores con facilidad. Esto ayuda a que las comunicaciones de la empresa mantengan siempre un buen nivel de calidad.',
    medio: 'Escribe y revisa textos con un nivel de corrección adecuado. Detecta los errores más comunes y mantiene sus comunicaciones claras y ordenadas.',
    bajo: 'Prioriza la rapidez al escribir por sobre el detalle. Le conviene darle una última revisión a los textos importantes, o pedir una segunda mirada, antes de enviarlos.'
  },
  errores_numeros: {
    alto: 'Maneja números y cálculos con seguridad y cuidado, lo que da confianza en la exactitud de sus reportes.',
    medio: 'Maneja bien los números en el día a día, con pocos errores en condiciones normales de trabajo.',
    bajo: 'Con volúmenes de datos numéricos más grandes, le conviene revisar sus cálculos una segunda vez. Rinde mejor cuando puede seguir pasos claros y ordenados para esas tareas.'
  },
  metricas_fraude: {
    alto: 'Se observa una disposición genuina hacia la transparencia y la honestidad en su autopercepción profesional. Su estilo de respuesta sugiere una mirada objetiva sobre sus propias capacidades, lo que brinda una base de confianza sólida para la interpretación de los resultados.',
    medio: 'Sus resultados muestran un ajuste profesional equilibrado entre la imagen proyectada y sus características reales. Mantiene un nivel de franqueza que permite confiar plenamente en la información brindada durante el proceso.',
    bajo: 'Muestra una tendencia a proyectar una imagen muy positiva de sus capacidades. Para obtener una visión más equilibrada, se recomienda profundizar en ejemplos conductuales concretos que permitan validar la aplicación real de sus rasgos en el entorno laboral.'
  },

  // ── Competencias profesionales ────────────────────────────────────────────
  comunicacion: {
    alto: 'Transmite información de manera clara y estructurada, facilitando el intercambio de datos entre áreas con fluidez. Su discurso se adapta a los requerimientos del entorno, lo que asegura que los objetivos sean comprendidos con precisión y sin ambigüedades.',
    medio: 'Logra transmitir información de manera efectiva y profesional, asegurando que los mensajes clave lleguen a su destino con claridad. Posee habilidades de escucha activa que le permiten interactuar de forma constructiva con su entorno laboral.',
    bajo: 'Se recomienda fortalecer la estructura de sus mensajes para asegurar la total claridad en la transmisión de datos. El uso de canales de comunicación pautados garantizaría que sus interacciones mantengan la efectividad en procesos dinámicos.'
  },
  liderazgo: {
    alto: 'Muestra una sólida facultad para coordinar procesos y guiar la ejecución de tareas bajo estándares de calidad. Su enfoque se centra en el cumplimiento de objetivos organizando el flujo de trabajo de manera que se optimicen los recursos y el tiempo del equipo.',
    medio: 'Actúa como un referente operativo que facilita la ejecución de tareas y apoya la estabilidad del grupo. Posee un estilo de influencia funcional que permite mantener la cohesión y el avance de las metas diarias bajo directrices claras.',
    bajo: 'Manifiesta una marcada preferencia por roles de ejecución individual y autónoma. Se beneficiará de un acompañamiento que le permita desarrollar progresivamente habilidades de gestión de equipos y toma de decisiones compartidas.'
  },
  trabajo_equipo: {
    alto: 'Se integra a la dinámica grupal de forma proactiva, favoreciendo un clima de confianza y soporte mutuo. Su enfoque fomenta la sinergia organizacional, asegurando que el cumplimiento de los objetivos colectivos se realice con una productividad estable.',
    medio: 'Participa de forma colaborativa en el equipo, cumpliendo con sus responsabilidades técnicas y manteniendo una interacción profesional cordial. Facilita que los proyectos compartidos avancen con fluidez, respetando siempre los acuerdos del grupo.',
    bajo: 'Tiende a priorizar el trabajo autónomo sobre la interdependencia. Se recomienda su integración en proyectos colaborativos que le permitan fortalecer su sentido de pertenencia y desarrollar una mayor agilidad en el intercambio con pares.'
  },
  adaptabilidad: {
    alto: 'Posee una notable facultad para ajustar su ritmo de trabajo ante cambios en las prioridades del área. Su flexibilidad le permite transitar modificaciones operativas manteniendo la calidad de su ejecución técnica y asegurando la continuidad de los resultados.',
    medio: 'Logra asimilar cambios en procesos y estructuras organizacionales de manera profesional, mostrando una apertura constructiva hacia las nuevas metodologías necesarias para la evolución del negocio.',
    bajo: 'Muestra una preferencia por rutinas operativas estables y predecibles. Se beneficia de una gestión del cambio estructurada y comunicada con antelación, lo que le permite adaptarse con mayor seguridad a las nuevas demandas del entorno.'
  },
  resolucion_problemas: {
    alto: 'Utiliza criterios lógicos y un enfoque práctico para identificar la raíz de desafíos operativos. Su análisis facilita soluciones que no solo resuelven la urgencia, sino que aportan mejoras al proceso para prevenir recurrencias de manera efectiva.',
    medio: 'Es capaz de resolver inconvenientes operativos de manera autónoma utilizando su experiencia y criterio profesional. Muestra iniciativa para destrabar situaciones que impiden el avance de sus tareas diarias con seguridad.',
    bajo: 'Tiende a requerir guías claras para abordar situaciones que se alejan de su rutina habitual. Se recomienda el desarrollo de metodologías de análisis de problemas para ganar mayor autonomía y agilidad resolutiva ante imprevistos.'
  },
  etica: {
    alto: 'Demuestra un compromiso sólido con la integridad y el manejo responsable de la información. Su estilo de trabajo se alinea con los estándares institucionales, mitigando riesgos operativos mediante un apego consistente a los protocolos del área.',
    medio: 'Mantiene un comportamiento profesional alineado con las normas y la cultura organizacional. Su criterio permite tomar decisiones equilibradas que aseguran la transparencia y la confianza en la ejecución de sus responsabilidades diarias.',
    bajo: 'Se recomienda reforzar el conocimiento de los protocolos específicos de integridad del cargo. Una guía cercana le permitirá alinear sus acciones con los estándares de transparencia requeridos por la organización de manera más sólida.'
  },
  negociacion: {
    alto: 'Utiliza argumentos fundamentados para alcanzar acuerdos que aseguren la fluidez operativa. Su enfoque facilita la resolución de diferencias mediante criterios prácticos, preservando siempre la calidad de los vínculos profesionales y el objetivo común.',
    medio: 'Posee habilidades de comunicación que le permiten llegar a consensos en la operativa diaria. Logra representar los intereses del área de forma profesional, mostrando la flexibilidad necesaria cuando el éxito del proyecto así lo requiere.',
    bajo: 'Muestra preferencia por defender posturas técnicas fijas en situaciones de desacuerdo. Se beneficiaría de fortalecer sus habilidades de comunicación asertiva para facilitar el alcance de acuerdos constructivos en el día a día.'
  },
  manejo_emocional: {
    alto: 'Gestiona sus reacciones ante desafíos o conflictos laborales con profesionalismo y calma. Su estabilidad actúa como un factor de equilibrio que favorece la toma de decisiones objetivas y mantiene el foco en la tarea bajo situaciones de demanda.',
    medio: 'Maneja el impacto de las demandas laborales de manera estable, asegurando que las variables externas no afecten su desempeño técnico. Es capaz de mantener un trato profesional y cordial incluso ante periodos de actividad intensa.',
    bajo: 'Ante situaciones de alta presión, su estilo de respuesta puede verse influenciado por la tensión del momento. Se beneficia de entornos predecibles y de una estructura de apoyo que le permita recuperar su objetividad de forma rápida.'
  },
  tolerancia_frustracion: {
    alto: 'Mantiene el ritmo de ejecución previsto ante el aumento en el volumen de tareas o demoras en los resultados esperados. Su respuesta profesional se mantiene estable, capitalizando los obstáculos como una oportunidad para el ajuste de procesos y la mejora continua.',
    medio: 'Muestra una capacidad adecuada para recuperarse ante fallos operativos, manteniendo su compromiso con las metas pendientes. Logra retomar sus funciones con profesionalismo una vez superado el inconveniente detectado.',
    bajo: 'La gestión de los reveses operativos es un área que se beneficia de un acompañamiento cercano. Mantiene su compromiso, aunque requiere pautas claras para recuperar la fluidez en sus funciones tras resultados imprevistos.'
  },

  // ── Bienestar ─────────────────────────────────────────────────────────────
  burnout: {
    alto: 'Posee un sólido blindaje emocional contra el agotamiento. Su vitalidad y entusiasmo se mantienen intactos, reflejando una excelente higiene mental y una integración saludable de las demandas laborales en su vida.',
    medio: 'Muestra una gestión de la energía funcional, propia de ciclos de alta exigencia. Si bien mantiene la productividad, se beneficia de espacios de recuperación para sostener su compromiso a largo plazo.',
    bajo: 'Se observa una vulnerabilidad al desgaste crónico que sugiere la necesidad de redosificar la carga inmediata. El fortalecimiento de sus recursos de afrontamiento favorecerá la recuperación de su vitalidad operativa.'
  },
  equilibrio: {
    alto: 'Demuestra una gestión ejemplar de sus límites profesionales y personales, manteniendo un ritmo de trabajo sostenible que previene el agotamiento y asegura una presencia mental plena en sus tareas.',
    medio: 'Logra un balance funcional entre sus compromisos laborales y su entorno privado. Posee los mecanismos básicos para recuperar su centro y mantener la efectividad operativa sin sacrificar su bienestar.',
    bajo: 'Muestra dificultades para establecer fronteras claras entre la esfera laboral y la personal. Esta falta de equilibrio podría derivar en una sensación de agobio que afecte su capacidad de respuesta técnica.'
  },
  relaciones: {
    alto: 'Destaca por su capacidad para construir vínculos de confianza mutua con su entorno. Su estilo relacional fomenta un clima de colaboración y seguridad psicológica, facilitando la cohesión hacia objetivos comunes.',
    medio: 'Mantiene interacciones profesionales correctas y cordiales con sus pares. Logra integrarse bien en las dinámicas de equipo, contribuyendo de forma estable a la armonía del grupo de trabajo.',
    bajo: 'Manifiesta un estilo de interacción centrado estrictamente en la tarea, lo que puede ser percibido como distancia. Se beneficia de entornos que fomenten la comunicación abierta para mejorar su integración.'
  },
  claridad_rol: {
    alto: 'Posee un entendimiento profundo de sus responsabilidades y del impacto de su función en la cadena de valor. Esta claridad le permite actuar con determinación y autonomía en cada intervención.',
    medio: 'Comprende sus funciones básicas y los límites de su puesto. Se desempeña con corrección y orienta su actividad hacia el cumplimiento de los objetivos fijados por la organización.',
    bajo: 'Experimenta cierta ambigüedad respecto a las expectativas de su posición. Se recomienda una definición de perfil más rigurosa para evitar vacilaciones e inseguridades en su ejecución diaria.'
  },
  nivel_estres: {
    alto: 'Se maneja con tranquilidad frente a la presión del día a día. Las demandas externas no le generan sobresaltos y mantiene un ritmo de trabajo estable.',
    medio: 'Maneja bien la tensión habitual del trabajo, aunque en momentos de mayor exigencia agradece poder tomarse una pausa para reordenarse.',
    bajo: 'Actualmente convive con un nivel de tensión más alto de lo deseable, lo que puede afectar su claridad para tomar decisiones en el día a día. Un entorno con rutinas previsibles y objetivos bien delimitados lo ayudaría a recuperar el equilibrio y sostener su rendimiento habitual.'
  },
  carga_laboral: {
    alto: 'Siente que el volumen de trabajo actual le queda cómodo y tiene margen para sumar tareas o desafíos nuevos.',
    medio: 'Organiza bien la carga de trabajo que le toca, ajustando prioridades sin que esto afecte la calidad de lo que entrega.',
    bajo: 'Percibe que el volumen de tareas actual supera su capacidad de organización, lo que puede derivar en demoras o en la sensación de estar siempre "atrás". Definir prioridades junto a su líder directo lo ayudaría a ordenar la carga y recuperar margen de acción.'
  },
  autonomia: {
    alto: 'Manifiesta una sólida facultad para gestionar sus procesos y tiempos con independencia. Su proactividad le permite tomar decisiones lúcidas y proponer mejoras sustanciales en su esfera de influencia.',
    medio: 'Siente que tiene el margen de maniobra suficiente para gestionar su día a día con eficacia, equilibrando las directrices recibidas con su propio criterio profesional de manera constructiva.',
    bajo: 'Percibe una alta rigidez o supervisión excesiva en sus tareas. Esta sensación de falta de control puede inhibir su iniciativa, recomendándose delegar mayores espacios de decisión para potenciar su valor.'
  },
  expectativas: {
    alto: 'Sus aspiraciones profesionales están plenamente alineadas con la propuesta de valor de la organización. Esta sintonía genera un alto compromiso intrínseco y una visión optimista sobre su crecimiento.',
    medio: 'Mantiene una visión realista y funcional sobre su carrera y el entorno laboral. Sus expectativas son estables y se ajustan a las oportunidades actuales, permitiéndole mantener un compromiso constante.',
    bajo: 'Se observa una brecha entre sus proyecciones personales y la realidad percibida en su rol. Se recomienda un diálogo abierto para reencuadrar sus objetivos dentro del proyecto institucional.'
  },
  resiliencia: {
    alto: 'Presenta una arquitectura de resiliencia sobresaliente, capitalizando los obstáculos como aprendizaje activo. Mantiene la estabilidad técnica y la orientación a metas incluso en periodos de crisis.',
    medio: 'Posee una fortaleza emocional adecuada para afrontar los desafíos cotidianos. Logra recuperar su ritmo operativo en tiempos razonables tras experimentar contratiempos en sus tareas.',
    bajo: 'Los obstáculos inesperados impactan en su seguridad operativa. Requiere un sistema de validación externa constante para recuperar su productividad ante entornos volátiles o de alta incertidumbre.'
  },
  manejo_estres: {
    alto: 'Utiliza estrategias de afrontamiento que le permiten mantener la precisión técnica bajo presión. Logra priorizar tareas de forma efectiva cuando el volumen de actividad aumenta súbitamente.',
    medio: 'Gestiona de manera efectiva las demandas de un entorno dinámico. Mantiene el control sobre sus procesos, aunque ante picos extraordinarios se beneficia de soporte en la organización de prioridades.',
    bajo: 'Presenta una baja tolerancia a la multiactividad. Ante situaciones de presión extrema, su capacidad de organización se ve comprometida, requiriendo una estructura de tareas muy pautada.'
  },
  autoestima: {
    alto: 'Demuestra una confianza profesional sólida fundamentada en sus competencias. Esta seguridad le permite aceptar feedback técnico de forma constructiva para optimizar continuamente su desempeño.',
    medio: 'Mantiene un nivel de confianza equilibrado, reconociendo sus fortalezas y áreas de mejora. Se siente capaz de afrontar nuevos desafíos operativos con una actitud receptiva y profesional.',
    bajo: 'Muestra inseguridad respecto a sus capacidades, lo que puede limitar su iniciativa. Requiere un ambiente de baja exposición para desplegar su potencial sin temor al error técnico.'
  }
}

/**
 * Clasifica un puntaje 0-5 en alto/medio/bajo con el umbral único ya vigente
 * en la vista web (4.5 para "alto"). Antes el PDF usaba 4.0, lo que podía
 * clasificar el mismo puntaje distinto en cada superficie.
 */
export function nivelDesdeValor(valor: number): NivelFactor {
  if (valor >= 4.5) return 'alto'
  if (valor >= 3.0) return 'medio'
  return 'bajo'
}

/**
 * Busca la narrativa sugerida para un factor y puntaje. Devuelve null si el
 * factor no está en el banco (el llamador decide el texto de fallback,
 * que varía por dominio: personalidad, cognitivo, competencias, bienestar).
 */
export function obtenerNarrativaFactor(factor: string, valor: number): string | null {
  const clave = factor?.toLowerCase().trim()
  if (!clave) return null
  return NARRATIVAS_FACTOR[clave]?.[nivelDesdeValor(valor)] ?? null
}
