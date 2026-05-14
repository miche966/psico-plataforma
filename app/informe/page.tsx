'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { InformePDF } from '@/components/InformePDF'
import Link from 'next/link'
import { ChevronLeft, FileText, Download, User, Briefcase, Calendar, Target, Award, ShieldAlert, Clock, ChevronRight, Sparkles, BrainCircuit, Activity, Info } from 'lucide-react'

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
}

// Tipos base
type Rec = 'recomendado' | 'con_reservas' | 'no_recomendado'

interface InformeState {
  recomendacion: Rec
  fundamentacion: string
  fortalezas: string[]
  oportunidadesMejora: string[]
  resumenEjecutivo: string
  ajusteCargo: { score: number, analisis: string }
  interpretacionPorFactor: Record<string, string>
  nombreEvaluador: string
  mbti?: string
  ajusteMbti?: string
  liderazgo: number
  adaptabilidad: number
  resiliencia: number
  colaboracion: number
  comunicacion: number
  confianza: number
  alertasTab: number
  alertasCopia: number
  tiempoPromedio: number
}

const ETQ: Record<string, string> = {
  // Personalidad e Integridad
  extraversion: 'Extraversión', 
  'extraversión y energía social': 'Extraversión',
  'extraversión': 'Extraversión',
  amabilidad: 'Amabilidad',
  'amabilidad y cooperación': 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  'responsabilidad y organización': 'Responsabilidad',
  neuroticismo: 'Estabilidad Emocional',
  'neuroticismo y ajuste': 'Estabilidad Emocional',
  'estabilidad emocional': 'Estabilidad Emocional',
  apertura: 'Apertura a la Experiencia',
  'apertura a la experiencia': 'Apertura a la Experiencia',
  'apertura y curiosidad': 'Apertura a la Experiencia',
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

const DOMINIOS = {
  PERSONALIDAD: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad', 'honestidad', 'normas', 'promedio_general'],
  COGNITIVO: ['correctas', 'percentil', 'score', 'documentos', 'comparacion', 'concentracion', 'errores_texto', 'errores_numeros', 'metricas_fraude'],
  COMPETENCIAS: ['etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion', 'comunicacion', 'liderazgo', 'trabajo_equipo', 'adaptabilidad', 'resolucion_problemas'],
  BIENESTAR: ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'nivel_estres', 'carga_laboral', 'autonomia', 'expectativas', 'resiliencia', 'manejo_estres', 'autoestima', 'inteligencia_emocional']
}

const REC_COLOR: Record<Rec, string> = {
  recomendado: '#059669',
  con_reservas: '#d97706',
  no_recomendado: '#dc2626'
}

const REC_LABELS: Record<Rec, string> = {
  recomendado: 'Candidato Recomendado',
  con_reservas: 'Recomendado con Reservas',
  no_recomendado: 'No Recomendado para el cargo'
}

const MBTI_DESC: Record<string, string> = {
  'ISTJ': 'Perfil Logista: Se caracteriza por un enfoque profundamente metódico y una lealtad notable hacia los estándares de calidad establecidos. Posee una capacidad innata para la organización detallada y el seguimiento riguroso de procesos, actuando como un pilar de estabilidad dentro del equipo. Su valor reside en una responsabilidad silenciosa y constante, prefiriendo entornos donde la previsibilidad y el orden permitan una ejecución técnica de alta confiabilidad.',
  'ISFJ': 'Perfil Protector: Demuestra una dedicación genuina y un sentido de la responsabilidad orientado al bienestar y soporte del entorno laboral. Su enfoque es minucioso y armónico, destacando por una memoria operativa excepcional para los detalles que otros podrían pasar por alto. Es un perfil que fomenta la cohesión grupal mediante un trato profesional cálido y una ética de trabajo basada en el servicio y la constancia.',
  'INFJ': 'Perfil Consejero: Caracterizado por una visión estratégica profunda y un compromiso firme con los valores institucionales. Posee una intuición aguda para comprender las dinámicas humanas y anticipar necesidades futuras, lo que le permite liderar con propósito e integridad. Su enfoque es organizado y reflexivo, buscando siempre la coherencia entre las acciones diarias y el impacto a largo plazo de la organización.',
  'INTJ': 'Perfil Estratega: Manifiesta un estilo de pensamiento altamente analítico y orientado a la optimización de sistemas complejos. Se destaca por una independencia de criterio y una curiosidad intelectual que le permite diseñar soluciones innovadoras con un enfoque estrictamente lógico. Es un perfil que valora la eficiencia estratégica y la mejora continua, aportando una visión clara y objetiva para la toma de decisiones críticas.',
  'ISTP': 'Perfil Virtuoso: Se identifica un perfil con una marcada autonomía y un enfoque profundamente pragmático ante los desafíos. Posee una habilidad natural para desglosar situaciones complejas y abordarlas con una lógica directa y pausada, manteniendo un enfoque objetivo incluso en entornos de alta presión. Su estilo es observador y analítico, prefiriendo comprender la mecánica interna de los procesos antes de intervenir, lo que le otorga una gran precisión en la ejecución técnica.',
  'ISFP': 'Perfil Aventurero: Posee una sensibilidad profesional única y una gran capacidad de adaptación ante entornos dinámicos. Su enfoque es práctico y armonioso, destacando por un estilo de trabajo flexible que evita la rigidez innecesaria. Es un perfil que aporta una visión detallista a las tareas, prefiriendo ambientes que permitan una ejecución fluida y donde se valore la autenticidad y el respeto mutuo.',
  'INFP': 'Perfil Mediador: Empático y leal, con una fuerte orientación hacia proyectos que posean un propósito o impacto humano significativo. Se caracteriza por una curiosidad natural y una mente abierta que le permite explorar múltiples soluciones creativas. Su valor reside en su capacidad para integrar valores humanos en la estrategia operativa, fomentando un clima de trabajo auténtico, colaborativo y con visión de futuro.',
  'INTP': 'Perfil Lógico: Se destaca por una curiosidad intelectual incesante y una preferencia por el análisis conceptual profundo. Es un perfil reflexivo que disfruta desarmando ideas para entender cómo funcionan, aportando una visión innovadora y objetiva a los procesos. Valora la autonomía profesional y se desempeña con excelencia en roles que demanden investigación, desarrollo de marcos de trabajo o resolución de problemas complejos.',
  'ESTP': 'Perfil Emprendedor: Enérgico y audaz, con un enfoque pragmático orientado a la acción inmediata y la obtención de resultados en terreno. Posee una gran capacidad para navegar la incertidumbre y responder con agilidad ante crisis operativas. Su comunicación es directa y funcional, destacando por un carisma natural que le permite movilizar recursos y personas de manera eficiente en situaciones de alta exigencia.',
  'ESFP': 'Perfil Animador: Se caracteriza por un entusiasmo contagioso y una habilidad natural para dinamizar equipos de trabajo. Posee un enfoque práctico y centrado en el presente, logrando que las tareas complejas se perciban como alcanzables y motivadoras. Su valor reside en su gran inteligencia social y su capacidad para resolver conflictos de manera espontánea, asegurando un ambiente laboral vibrante y colaborativo.',
  'ENFP': 'Perfil Activista: Creativo y optimista, con una visión entusiasta hacia la innovación y el desarrollo de nuevas posibilidades. Posee una facilidad de palabra y una apertura mental que favorecen la generación constante de ideas disruptivas. Su ajuste es ideal para roles que exijan iniciativa propia y la capacidad de inspirar a otros, actuando como un catalizador de energía positiva y crecimiento dentro de la organización.',
  'ENTP': 'Perfil Innovador: Estratégico y mentalmente ágil, se destaca por su capacidad para cuestionar el status quo y proponer mejoras sustanciales mediante el debate de ideas. Posee una curiosidad intelectual que lo impulsa a explorar nuevos enfoques con gran audacia. Su valor reside en su capacidad para encontrar oportunidades ocultas y diseñar soluciones que desafíen los límites convencionales para optimizar el rendimiento del área.',
  'ESTJ': 'Perfil Ejecutivo: Caracterizado por una organización impecable y una determinación clara hacia el cumplimiento de hitos operativos. Posee un liderazgo basado en la honestidad, el orden y el respeto por los procedimientos establecidos. Su enfoque es decidido y eficiente, aportando la estructura necesaria para que la organización funcione con la precisión de un sistema bien coordinado.',
  'ESFJ': 'Perfil Cónsul: Responsable y sociable, enfoca su energía en asegurar que las necesidades operativas y humanas sean atendidas con equilibrio y calidez. Posee una gran capacidad para la coordinación y la gestión de personas, fomentando la lealtad y la armonía del equipo. Su valor reside en su compromiso con la cultura organizacional y su habilidad para crear entornos de trabajo productivos y seguros.',
  'ENFJ': 'Perfil Protagonista: Líder inspirador y empático, posee una gran capacidad de organización orientada al éxito colectivo y al desarrollo del potencial humano. Se destaca por una comunicación persuasiva y con propósito, logrando alinear las metas individuales con los objetivos estratégicos de la empresa. Su enfoque es integrador, actuando como un puente de confianza y motivación en toda la organización.',
  'ENTJ': 'Perfil Comandante: Decidido y con una visión estratégica de alto alcance, su liderazgo natural impulsa la ejecución de metas institucionales complejas con una eficiencia notable. No teme a los desafíos y posee un estilo de pensamiento orientado a resultados tangibles y a la excelencia operativa. Su valor reside en su capacidad para tomar decisiones difíciles de manera objetiva, asegurando la competitividad a largo plazo.'
}

// Estilos base de la UI
const s = {
  page: { minHeight: '100vh', background: '#f8fafc', padding: '2rem 1rem' },
  container: { maxWidth: '1000px', margin: '0 auto' },
  header: { marginBottom: '2.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: '1.875rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em' },
  subtitle: { color: '#64748b', marginTop: '0.25rem', fontSize: '0.95rem' },
  card: { background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', marginBottom: '2.5rem', overflow: 'hidden', border: '1px solid #f1f5f9' },
  cardHead: { padding: '1.25rem', borderBottom: '1px solid #f1f5f9', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardHeadTxt: { fontWeight: '700', color: '#1e293b', fontSize: '1.05rem' },
  badge: { padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', background: '#f1f5f9', color: '#64748b', textTransform: 'uppercase' as const },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', padding: '1.25rem' },
  item: { padding: '1rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' },
  label: { fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: '0.25rem', display: 'block' },
  value: { fontSize: '1rem', fontWeight: '600', color: '#1e293b' },
  ta: { width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.95rem', lineHeight: '1.6', color: '#334155', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' },
  factBlk: { marginBottom: '1.5rem' },
  factRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-end' },
  factName: { fontWeight: '600', color: '#334155', fontSize: '0.9rem' },
  factLvl: { fontSize: '0.85rem', fontWeight: '700' },
  barBg: { height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem' },
  barFill: { height: '100%', borderRadius: '4px', transition: 'width 0.6s ease-out' },
  taFact: { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '0.875rem', color: '#475569', background: '#fafbfc', fontStyle: 'italic', lineHeight: '1.5' },
  btnGen: { padding: '12px 24px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: '#0f172a', color: '#fff' },
  btnSave: { padding: '12px 24px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', background: '#2563eb', color: '#fff', border: 'none' },
  recBtns: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1.25rem' },
  recBtn: { padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem', textAlign: 'center' as const },
  sello: { margin: '0 1.25rem 1.25rem', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' as const, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '0.1em', border: '2px dashed' },
  commentLabel: { fontSize: '0.8rem', fontWeight: '600', color: '#64748b', marginBottom: '4px' },
}

// Helpers de lógica y cálculo
function calcAjuste(reqs: any[], sesiones: any[]) {
  // Si no hay requerimientos (o están vacíos), calculamos un promedio general omnisciente
  if (!reqs || reqs.length === 0 || (reqs.length === 1 && !reqs[0]?.competencia)) {
    const todosLosFactores: number[] = []
    const CLAVES_IGNORAR = ['total', 'correctas', 'porcentaje', 'id', 'created_at', 'proceso_id', 'candidato_id', 'finalizada_en', 'iniciada_en', 'nivel_maximo']
    
    sesiones.forEach(s => {
      const scan = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        Object.entries(obj).forEach(([k, v]) => {
          const key = k.toLowerCase().trim()
          if (CLAVES_IGNORAR.includes(key)) return

          const valNum = parseFloat(String(v))
          if (!isNaN(valNum)) {
            let val = valNum
            if (val > 5 && val <= 20) val = (val / 20) * 5
            else if (val > 20 && val <= 100) val = (val / 100) * 5
            if (val > 0 && val <= 5) todosLosFactores.push(val)
          } 
          else if (typeof v === 'object' && v !== null && 'correctas' in v) {
            const score = (Number((v as any).correctas) / (Number((v as any).total) || 1)) * 5
            todosLosFactores.push(score)
          }
          else if (typeof v === 'object') scan(v)
        })
      }
      scan(s.puntaje_bruto)
    })
    
    if (todosLosFactores.length === 0) return { general: 0, detalles: [] }
    const avg = todosLosFactores.reduce((a, b) => a + b, 0) / todosLosFactores.length
    return { general: Math.round((avg / 5) * 100), detalles: [] }
  }
  
  const FACTORES_NEGATIVOS = ['neuroticismo', 'nivel_estres', 'carga_laboral', 'burnout', 'errores_texto', 'errores_numeros', 'tabswitches', 'copypasteattempts', 'alerta'];

  const scores: number[] = []
  const detalles = reqs.map(r => {
    // Buscar el valor más reciente para esta competencia
    let valorCandidato = -1 
    const mapping = COMPETENCIAS_MAPPING[r.competencia]
    
    for (const s of sesiones) {
      if (!s.puntaje_bruto || valorCandidato !== -1) continue
      
      const buscar = (obj: any) => {
        if (!obj || typeof obj !== 'object' || valorCandidato !== -1) return
        Object.entries(obj).forEach(([f, v]: any) => {
          if (valorCandidato !== -1) return
          const keyNormalizada = f?.toLowerCase()?.trim()
          
          // Caso 1: Coincidencia directa
          if (keyNormalizada === r.competencia?.toLowerCase()?.trim()) {
            valorCandidato = (typeof v === 'object' && v !== null && 'correctas' in v) ? (v.correctas / (v.total || 1)) * 5 : Number(v)
          } 
          // Caso 2: Coincidencia a través de mapeo (Big Five)
          else if (mapping && mapping[keyNormalizada as keyof typeof mapping]) {
            let val = (typeof v === 'object' && v !== null && 'correctas' in v) ? (v.correctas / (v.total || 1)) * 5 : Number(v)
            // Si es neuroticismo y el mapeo es bajo, invertimos
            if (keyNormalizada === 'neuroticismo' && (mapping[keyNormalizada] || 0) < 3) {
              val = 6 - val
            }
            valorCandidato = val
          }

          if (typeof v === 'object' && v !== null) buscar(v)
        })
      }
      buscar(s.puntaje_bruto)
      if (valorCandidato !== -1) break
    }
    if (valorCandidato === -1) valorCandidato = 0

    const pct = Math.min(100, Math.round((valorCandidato / r.nivel) * 100))
    scores.push(pct)
    return { nombre: r.competencia, nivelReq: r.nivel, nivelCand: valorCandidato, pct }
  })

  const general = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  return { general, detalles }
}

function InformePageContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('candidato')
  
  const [candidato, setCandidato] = useState<any>(null)
  const [proceso, setProceso] = useState<any>(null)
  const [sesiones, setSesiones] = useState<any[]>([])
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const [inf, setInf] = useState<InformeState>({
    recomendacion: 'con_reservas',
    fundamentacion: '',
    resumenEjecutivo: '',
    fortalezas: ['', '', ''],
    oportunidadesMejora: ['', ''],
    ajusteCargo: { score: 0, analisis: '' },
    interpretacionPorFactor: {},
    nombreEvaluador: 'Antigravity AI',
    liderazgo: 0,
    adaptabilidad: 0,
    resiliencia: 0,
    colaboracion: 0,
    comunicacion: 0,
    confianza: 100,
    alertasTab: 0,
    alertasCopia: 0,
    tiempoPromedio: 0
  })

  useEffect(() => {
    if (id) fetchAll()
    else setLoading(false)
  }, [id])

  async function fetchAll() {
    try {
      const { data: cand } = await supabase.from('candidatos').select('*').eq('id', id).single()
      if (!cand) return
      setCandidato(cand)

      let pid = cand.proceso_id
      const { data: sess } = await supabase.from('sesiones').select('*').eq('candidato_id', id).order('finalizada_en', { ascending: false })
      const lista = sess || []
      setSesiones(lista)

      if (!pid && lista.length > 0) {
        pid = lista.find(s => s.proceso_id)?.proceso_id
      }

      let procData = null
      if (pid) {
        const { data: proc } = await supabase.from('procesos').select('*').eq('id', pid).single()
        procData = proc
        setProceso(proc)
      }

      const { data: vids } = await supabase.from('respuestas_video').select('*').eq('candidato_id', id)
      setVideos(vids || [])

      // Cálculos de Auditoría y Potencial
      let aTab = 0, aCopia = 0, tDur = 0, sTime = 0
      
      lista.forEach(s => {
        const pb = s.puntaje_bruto || {}
        aTab += Number(pb.metricas_fraude?.tabSwitches || 0)
        aCopia += Number(pb.metricas_fraude?.copyPasteAttempts || 0)
        
        const start = s.created_at || s.iniciada_en
        if (s.finalizada_en && start) {
          const dur = (new Date(s.finalizada_en).getTime() - new Date(start).getTime()) / 1000 / 60
          if (dur > 0.5 && dur < 120) { tDur += dur; sTime++ }
        }
      })

      const totalAlertas = aTab + aCopia
      const avgAlertas = lista.length ? totalAlertas / lista.length : 0
      const confianza = totalAlertas > 0 ? Math.max(0, 100 - Math.round(avgAlertas * 10)) : 100
      const tiempoFinal = sTime > 0 ? Math.round(tDur / sTime) : 15

      // Cálculo automático de ajuste inicial con fallback si no hay datos de proceso
      let autoAjuste = 0
      if (lista.length > 0) {
        const resAjuste = calcAjuste(procData?.competencias_requeridas || [], lista)
        autoAjuste = (resAjuste && resAjuste.general > 0) ? resAjuste.general : 0
        
        if (autoAjuste === 0) {
          console.log("DEBUG: Iniciando fallback omnisciente para Avril...");
          const todosLosFactores: number[] = []
          lista.forEach((s, idx) => {
            console.log(`DEBUG: Analizando sesión ${idx + 1}:`, s.test_id, s.puntaje_bruto);
            const scan = (obj: any) => {
              if (!obj || typeof obj !== 'object') return
              Object.entries(obj).forEach(([k, v]) => {
                const valNum = parseFloat(String(v))
                if (!isNaN(valNum)) {
                  let val = valNum
                  if (val > 5 && val <= 100) val = (val / 100) * 5
                  if (val > 0 && val <= 5) {
                    console.log(`  > Factor Detectado: ${k} = ${val} (Original: ${v})`);
                    todosLosFactores.push(val)
                  }
                } 
                else if (typeof v === 'object' && v !== null && 'correctas' in v) {
                  const score = (Number((v as any).correctas) / (Number((v as any).total) || 1)) * 5
                  console.log(`  > Puntaje Detectado (Objeto): ${k} = ${score}`);
                  todosLosFactores.push(score)
                }
                else if (typeof v === 'object') scan(v)
              })
            }
            scan(s.puntaje_bruto)
          })
          if (todosLosFactores.length > 0) {
            const avg = todosLosFactores.reduce((a, b) => a + b, 0) / todosLosFactores.length
            autoAjuste = Math.round((avg / 5) * 100)
            console.log(`DEBUG: AutoAjuste Final Calculado: ${autoAjuste}% basado en ${todosLosFactores.length} factores.`);
          }
        }
      }

      // ACTUALIZACIÓN CRÍTICA: Forzar el valor en el estado y asegurar persistencia
      setInf(prev => {
        const finalScore = autoAjuste > 0 ? autoAjuste : prev.ajusteCargo?.score || 0;
        return { 
          ...prev, 
          alertasTab: aTab, 
          alertasCopia: aCopia, 
          confianza, 
          tiempoPromedio: tiempoFinal,
          ajusteCargo: { 
            score: finalScore, 
            analisis: prev.ajusteCargo?.analisis || '' 
          }
        };
      })

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Helpers de lógica
  // --- GUARDIÁN DE DATOS (Saneamiento Global) ---
  const sanitizarPuntajes = (datos: any): any => {
    if (!datos) return datos
    const nuevo = JSON.parse(JSON.stringify(datos))
    
    const limpiar = (obj: any) => {
      if (!obj || typeof obj !== 'object') return
      Object.entries(obj).forEach(([k, v]) => {
        if (typeof v === 'number' && v > 5) {
          if (v <= 25) obj[k] = Math.min(5, (v / 25) * 5)
          else if (v <= 100) obj[k] = Math.min(5, (v / 100) * 5)
          else obj[k] = 5
        } else if (typeof v === 'object') {
          limpiar(v)
        }
      })
    }
    
    limpiar(nuevo)
    return nuevo
  }

  const parseVal = (v: any, key?: string) => {
    let val = 0
    const k = key?.toLowerCase().trim() || ''
    
    if (typeof v === 'object' && v !== null) {
      if (k === 'metricas_fraude') {
        const alertas = (v.events?.length || 0) + (v.tabSwitches || 0) + (v.copyPasteAttempts || 0)
        val = Math.max(0, 5 - (alertas * 0.5))
      } else if ('correctas' in v && 'total' in v) {
        val = (Number(v.correctas) / (Number(v.total) || 1)) * 5
      } else {
        val = Number(v.correctas || v.score || v.promedio || 0)
      }
    } else if (typeof v === 'string') {
      const s = v.toLowerCase().trim()
      if (s === 'alto') val = 5
      else if (s === 'medio') val = 3
      else if (s === 'bajo') val = 1.5
      else val = Number(v) || 0
    } else {
      val = Number(v) || 0
    }

    // Inversión lógica selectiva (Escala 1-5):
    if (k === 'neuroticismo' || k === 'nivel_estres' || k === 'burnout') {
      val = Math.max(0, 6 - val)
    }
    // La inversión lógica para escalas 0-5 de errores fue eliminada ya que el motor
    // ahora entrega directamente efectividad (correctas/total), evitando dobles inversiones.


    // Normalización Final de Seguridad (Escala 0-5)
    if (val > 5) {
      if (val <= 25) val = (val / 25) * 5
      else if (val <= 100) val = (val / 100) * 5
      else val = 5
    }
    return Math.min(5, Math.max(0, val))
  }

  const clrOf = (v: number) => {
    const val = (isNaN(v) || v === null || v === undefined) ? 0 : v
    return val >= 4 ? '#059669' : val >= 3 ? '#2563eb' : val >= 2 ? '#d97706' : '#dc2626'
  }
  const upd = (k: keyof InformeState, v: any) => setInf(p => ({ ...p, [k]: v }))
  const updFactor = (fk: string, v: string) => setInf(p => ({
    ...p,
    interpretacionPorFactor: { ...(p.interpretacionPorFactor || {}), [fk]: v }
  }))

  const hasP = sesiones.some(s => {
    const pb = s.puntaje_bruto || {}
    const keys = Object.keys(pb).map(k => k.toLowerCase())
    return keys.some(k => DOMINIOS.PERSONALIDAD.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => DOMINIOS.PERSONALIDAD.includes(k.toLowerCase())))
  })
  const hasC = sesiones.some(s => {
    const pb = s.puntaje_bruto || {}
    const keys = Object.keys(pb).map(k => k.toLowerCase())
    return keys.some(k => DOMINIOS.COGNITIVO.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => DOMINIOS.COGNITIVO.includes(k.toLowerCase())))
  })
  const hasK = sesiones.some(s => {
    if (s.test_id?.toLowerCase().startsWith('sjt-')) return true
    const pb = s.puntaje_bruto || {}
    const keys = Object.keys(pb).map(k => k.toLowerCase())
    return keys.some(k => DOMINIOS.COMPETENCIAS.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => DOMINIOS.COMPETENCIAS.includes(k.toLowerCase())))
  })
  const hasV = sesiones.some(s => {
    const tid = s.test_id?.toLowerCase() || ''
    if (tid.includes('bienestar') || tid.includes('estres') || tid.includes('dass21')) return true
    const pb = s.puntaje_bruto || {}
    const keys = Object.keys(pb).map(k => k.toLowerCase())
    return keys.some(k => DOMINIOS.BIENESTAR.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => DOMINIOS.BIENESTAR.includes(k.toLowerCase())))
  })

  const sesBF = sesiones.filter(s => s.puntaje_bruto && (Object.keys(s.puntaje_bruto).some(k => DOMINIOS.PERSONALIDAD.includes(k.toLowerCase())) || (s.puntaje_bruto.por_factor && Object.keys(s.puntaje_bruto.por_factor).some(k => DOMINIOS.PERSONALIDAD.includes(k.toLowerCase())))))
  const sesHX = sesiones.filter(s => s.test_id === 'hexaco') // HEXACO usually has a specific test_id but we can leave it for now or expand it
  const sesCog = sesiones.filter(s => {
    const tid = s.test_id?.toLowerCase() || ''
    if (tid.includes('dass21') || tid.includes('estres')) return false
    return s.puntaje_bruto && (Object.keys(s.puntaje_bruto).some(k => DOMINIOS.COGNITIVO.includes(k.toLowerCase())) || (s.puntaje_bruto.por_factor && Object.keys(s.puntaje_bruto.por_factor).some(k => DOMINIOS.COGNITIVO.includes(k.toLowerCase()))))
  })
  const sesComp = sesiones.filter(s => {
    const tid = s.test_id?.toLowerCase() || ''
    return tid.startsWith('sjt-') || (s.puntaje_bruto && (Object.keys(s.puntaje_bruto).some(k => DOMINIOS.COMPETENCIAS.includes(k.toLowerCase())) || (s.puntaje_bruto.por_factor && Object.keys(s.puntaje_bruto.por_factor).some(k => DOMINIOS.COMPETENCIAS.includes(k.toLowerCase())))))
  })
  const sesBien = sesiones.filter(s => {
    const tid = s.test_id?.toLowerCase() || ''
    return tid.includes('bienestar') || tid.includes('estres') || tid.includes('dass21') || (s.puntaje_bruto && (Object.keys(s.puntaje_bruto).some(k => DOMINIOS.BIENESTAR.includes(k.toLowerCase())) || (s.puntaje_bruto.por_factor && Object.keys(s.puntaje_bruto.por_factor).some(k => DOMINIOS.BIENESTAR.includes(k.toLowerCase())))))
  })

  function cogData(pb: any) {
    if (!pb) return { correctas: 0, total: 1, percentil: 0 }
    const corr = Number(pb.correctas || 0)
    const tot = Number(pb.total || 1)
    let perc = Number(pb.percentil)
    if (isNaN(perc) || !pb.hasOwnProperty('percentil')) {
      perc = Math.round((corr / tot) * 100)
    }
    return { correctas: corr, total: tot, percentil: perc }
  }

  function nivelPercentil(p: number) {
    if (p >= 85) return 'Muy Superior'
    if (p >= 70) return 'Superior'
    if (p >= 40) return 'Promedio'
    return 'Bajo'
  }

  function getFactoresUnicos(dominio: string[]) {
    const mapa = new Map<string, { valor: any, sesionId: string, testId: string, acc: number }>()
    
    // Ordenar sesiones por fecha (más reciente primero)
    const sesionesOrd = [...sesiones].sort((a, b) => {
      const dA = new Date(b.finalizada_en || b.iniciada_en || b.created_at || 0).getTime()
      const dB = new Date(a.finalizada_en || a.iniciada_en || a.created_at || 0).getTime()
      return dA - dB
    })

    sesionesOrd.forEach(s => {
      const pb = s.puntaje_bruto || {}
      const escanear = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        Object.entries(obj).forEach(([f, v]: any) => {
          const key = f.toLowerCase().trim()
          if (dominio.includes(key)) {
            const vNum = parseVal(v, key)
            // Si el factor no está o el valor actual es 0 y el nuevo es > 0, actualizamos
            if (!mapa.has(key) || (mapa.get(key)!.acc === 0 && vNum > 0)) {
              const acc = (v && typeof v === 'object' && 'correctas' in v) ? (v.correctas / (v.total || 1)) * 5 : vNum
              mapa.set(key, { valor: v, sesionId: s.id, testId: s.test_id, acc })
            }
          }
          // Escaneo recursivo para estructuras anidadas (ej: por_factor, resultados, etc.)
          if (typeof v === 'object' && v !== null && !['metricas_fraude'].includes(key)) {
            escanear(v)
          }
        })
      }
      escanear(pb)
    })
    return Array.from(mapa.entries())
  }

  // MBTI Estimator
  function estimarMBTI(pb: any) {
    if (!pb) return null
    // Búsqueda profunda de factores OCEAN si pb es un objeto complejo
    const find = (key: string) => {
      let found = 2.5
      const search = (obj: any) => {
        Object.entries(obj).forEach(([f, v]) => {
          if (f.toLowerCase().includes(key)) {
            found = (v?.correctas ? (v.correctas/v.total)*5 : (typeof v === 'number' ? v : 0)) || 2.5
          } else if (typeof v === 'object' && v !== null) {
            search(v)
          }
        })
      }
      search(pb)
      return found
    }

    const E = find('extraver') >= 2.7 ? 'E' : 'I'
    const S = find('apertura') < 2.7 ? 'S' : 'N'
    const T = find('amabilid') < 2.7 ? 'T' : 'F'
    const J = find('responsab') >= 2.7 ? 'J' : 'P'
    return `${E}${S}${T}${J}`
  }

  async function generarIA() {
    setGenerating(true)
    try {
      const res = await fetch('/api/generar-informe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidato, proceso, sesiones, videos, actual: inf })
      })

      if (!res.ok) {
        throw new Error(`Servidor Vercel respondió con código ${res.status}. Esto suele ser un Timeout (10s) o un error de configuración.`);
      }

      const data = await res.json()
      
      const rawRes = data.informe || data
      
      if (rawRes && !data.error) {
        // Humanizador de factores técnicos y tono profesional (Consultoría)
        const humanizar = (t: string) => {
          if (!t || typeof t !== 'string') return t
          let limpio = t.replace(/\*\*/g, '')

          // 1. Filtro de nombre: reemplaza el nombre del evaluado por "El candidato"
          if (candidato?.nombre) {
            const nombreEscaped = candidato.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regexNombre = new RegExp(nombreEscaped, 'gi')
            limpio = limpio.replace(regexNombre, 'El candidato')
          }

          // 2. Normalización de factores técnicos (ETQ)
          Object.entries(ETQ).forEach(([key, label]) => {
            const variant = key.replace(/_/g, '[\\s\\-_]')
            // Usamos límites de palabra (\b) para evitar reemplazar subcadenas dentro de otras palabras
            const regex = new RegExp(`\\b${variant}\\b`, 'gi')
            // Integramos la etiqueta en minúsculas para que fluya mejor en la oración
            limpio = limpio.replace(regex, label.toLowerCase())
          })

          // 3. Eliminación de maximalismos y lenguaje informal
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

          // 4. Limpieza final de artefactos técnicos y normalización gramatical
          limpio = limpio
            .replace(/NaN/g, 'adecuado')
            .replace(/PUNTAJE DE AJUSTE/gi, 'nivel de adecuación')
            .trim()

          // 5. Autocorrección de capitalización (Mayúscula al inicio de cada oración)
          limpio = limpio.replace(/(^\s*\w|[\.\!\?]\s+\w)/g, c => c.toUpperCase())
          
          return limpio
        }

        // BLINDAJE: Recuperamos el score que el Frontend ya calculó con éxito (ej: 61%)
        const scoreFrontend = inf.ajusteCargo?.score || 0;
        
        const nuevoInforme = {
          ...rawRes,
          fundamentacion: humanizar(rawRes.fundamentacion),
          fortalezas: (rawRes.fortalezas || []).map((f: string) => humanizar(f)),
          oportunidadesMejora: (rawRes.oportunidadesMejora || rawRes.areasDesarrollo || []).map((f: string) => humanizar(f)),
          interpretacionPorFactor: Object.fromEntries(
            Object.entries(rawRes.interpretacionPorFactor || {}).map(([k, v]) => [k, humanizar(v as string)])
          ),
          ajusteCargo: {
            score: scoreFrontend, 
            analisis: humanizar(rawRes.ajusteCargo?.analisis || rawRes.fundamentacion || '')
          },
          ajusteMbti: humanizar(rawRes.ajusteMbti || ''),
          recomendacion: scoreFrontend >= 85 ? 'recomendado' : scoreFrontend >= 70 ? 'con_reservas' : 'no_recomendado'
        }

        setInf(prev => ({
          ...prev,
          ...nuevoInforme,
          liderazgo: rawRes.metaCompetencias?.liderazgo || prev.liderazgo,
          adaptabilidad: rawRes.metaCompetencias?.adaptabilidad || prev.adaptabilidad,
          resiliencia: rawRes.metaCompetencias?.resiliencia || prev.resiliencia,
          colaboracion: rawRes.metaCompetencias?.colaboracion || prev.colaboracion,
          comunicacion: rawRes.metaCompetencias?.comunicacion || prev.comunicacion,
          alertasTab: prev.alertasTab,
          alertasCopia: prev.alertasCopia,
          confianza: prev.confianza,
          tiempoPromedio: prev.tiempoPromedio
        }))
      } else if (data.error) {
        alert('Error IA: ' + data.error)
      }
    } catch (err: any) {
      console.error(err)
      alert(`Error de conexión: ${err.message || 'Error desconocido'}. Revisa la consola para más detalles.`)
    } finally {
      setGenerating(false)
    }
  }

  async function guardar() {
    setSaving(true)
    try {
      const { error } = await supabase.from('informes_psicometricos').upsert({
        candidato_id: id,
        contenido: inf,
        actualizado_en: new Date().toISOString()
      }, { onConflict: 'candidato_id' })
      if (!error) alert('Informe guardado correctamente')
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const descargarTXT = () => {
    const text = `
==================================================
      INFORME EJECUTIVO PSICOMÉTRICO
==================================================
Candidato: ${candidato.nombre} ${candidato.apellido}
Documento: ${candidato.documento || 'No provisto'}
Cargo: ${proceso?.cargo || 'Sin cargo'}
Fecha: ${new Date().toLocaleDateString()}

--------------------------------------------------
1. RESUMEN EJECUTIVO
--------------------------------------------------
${inf.resumenEjecutivo || 'Contenido no generado'}

--------------------------------------------------
2. DIAGNÓSTICO ESTRATÉGICO
--------------------------------------------------
AJUSTE AL CARGO: ${inf.ajusteCargo?.score || 0}%
Análisis de Idoneidad:
${inf.ajusteCargo?.analisis || 'Sin análisis'}

MATRIZ DE POTENCIAL CONDUCTUAL:
• Liderazgo: ${inf.liderazgo}/100
• Adaptabilidad: ${inf.adaptabilidad}/100
• Resiliencia: ${inf.resiliencia}/100
• Colaboración: ${inf.colaboracion}/100
• Comunicación: ${inf.comunicacion}/100

FORTALEZAS CLAVE:
${(inf.fortalezas || []).map(f => typeof f === 'object' ? `• ${f.tendencia || f.competencia}: ${f.mecanismo}. Impacto: ${f.impacto_organizacional}` : `• ${f}`).join('\n') || 'No definidas'}

OPORTUNIDADES DE MEJORA:
${(inf.oportunidadesMejora || []).map(o => typeof o === 'object' ? `• ${o.tendencia || o.competencia}: ${o.mecanismo}. Impacto: ${o.impacto_organizacional}` : `• ${o}`).join('\n') || 'No definidas'}

--------------------------------------------------
3. FUNDAMENTACIÓN TÉCNICA
--------------------------------------------------
${inf.fundamentacion || 'Sin fundamentación'}

--------------------------------------------------
4. AJUSTE CONDUCTUAL (MBTI)
--------------------------------------------------
${inf.ajusteMbti || 'Sin análisis de personalidad'}

--------------------------------------------------
5. INTERPRETACIÓN POR FACTORES
--------------------------------------------------
${Object.entries(inf.interpretacionPorFactor || {}).length > 0 
  ? Object.entries(inf.interpretacionPorFactor || {}).map(([f, t]) => `[${f.toUpperCase()}]\n${t}`).join('\n\n')
  : 'Sin desglose detallado'}

==================================================
PsicoPlataforma - Gestión Inteligente de Talento
==================================================
    `;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe_${candidato.nombre}_${candidato.apellido}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Cargando datos del motor psicométrico...</div>
  if (!candidato) return <div style={{ padding: '4rem', textAlign: 'center', color: '#ef4444' }}>Candidato no localizado.</div>

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header Premium */}
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link 
              href="/panel" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                color: '#64748b', 
                textDecoration: 'none', 
                fontSize: '0.85rem', 
                fontWeight: '600',
                padding: '8px 12px',
                borderRadius: '10px',
                backgroundColor: '#f1f5f9',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            >
              <ChevronLeft className="w-4 h-4" />
              Volver al Panel
            </Link>
            <div>
              <h1 style={s.title}>Informe Psicolaboral Final</h1>
              <p style={s.subtitle}>Candidato: <span style={{ color: '#1e293b', fontWeight: '700' }}>{candidato.nombre} {candidato.apellido}</span></p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={generarIA} disabled={generating} style={{ ...s.btnGen, opacity: generating ? 0.6 : 1 }}>
              {generating ? 'Analizando...' : '✦ Generar con IA'}
            </button>
            <button onClick={guardar} disabled={saving} style={{ ...s.btnSave, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button 
              onClick={descargarTXT} 
              style={{ 
                background: '#475569', 
                color: '#fff', 
                padding: '12px 24px', 
                borderRadius: '12px', 
                fontWeight: '700', 
                fontSize: '0.9rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              📥 Descargar TXT
            </button>
            <Suspense fallback={<div style={{ padding: '12px', fontSize: '0.8rem' }}>Cargando exportador...</div>}>
              <PDFDownloadLink
                document={<InformePDF data={{ candidato, proceso, sesiones, videos, inf, helpers: { hoy: () => new Date().toLocaleDateString(), clrOf: (v: number) => v >= 4 ? '#059669' : v >= 3 ? '#2563eb' : v >= 2 ? '#d97706' : '#dc2626', hasP, hasC, hasK, hasV, sesBF, sesHX, sesCog, sesComp, sesBien, cogData, estimarMBTI, MBTI_DESC, ETQ, DOMINIOS } }} />}
                fileName={`Informe_${candidato.nombre}_${candidato.apellido}.pdf`}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  fontSize: '0.9rem'
                }}
              >
                {/* @ts-ignore */}
                {({ loading }) => (loading ? 'Preparando PDF...' : 'Descargar PDF Oficial')}
              </PDFDownloadLink>
            </Suspense>
          </div>
        </header>

        {/* ── 1. FICHA TÉCNICA ─────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardHeadTxt}>Información General</span>
            <span style={s.badge}>Datos de Identidad</span>
          </div>
          <div style={s.grid}>
            <div style={s.item}><span style={s.label}>Nombre Completo</span><div style={s.value}>{candidato.nombre} {candidato.apellido}</div></div>
            <div style={s.item}><span style={s.label}>Documento</span><div style={s.value}>{candidato.documento || 'No provisto'}</div></div>
            <div style={s.item}><span style={s.label}>Edad</span><div style={s.value}>{candidato.edad || '—'} años</div></div>
            <div style={s.item}><span style={s.label}>Sexo</span><div style={s.value}>{candidato.sexo || '—'}</div></div>
            <div style={s.item}><span style={s.label}>Email</span><div style={s.value}>{candidato.email}</div></div>
            {proceso && (
              <>
                <div style={s.item}><span style={s.label}>Proceso</span><div style={s.value}>{proceso.nombre}</div></div>
                <div style={s.item}><span style={s.label}>Cargo</span><div style={s.value}>{proceso.cargo}</div></div>
              </>
            )}
            <div style={s.item}><span style={s.label}>Formación</span><div style={s.value}>{candidato.formacion || '—'}</div></div>
            <div style={s.item}><span style={s.label}>Profesión</span><div style={s.value}>{candidato.profesion || '—'}</div></div>
          </div>
        </div>
        {/* ── 2. DIAGNÓSTICO ESTRATÉGICO ────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardHeadTxt}>Diagnóstico Estratégico</span>
            <span style={s.badge}>Ajuste Persona-Cargo</span>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Ajuste al Cargo</div>
                <input
                  type="number"
                  style={{ fontSize: '3rem', fontWeight: '900', color: clrOf((inf.ajusteCargo?.score || 0)/20), background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }}
                  value={inf.ajusteCargo?.score || 0}
                  onChange={e => setInf(p => ({ ...p, ajusteCargo: { ...p.ajusteCargo, score: Number(e.target.value) } }))}
                />
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#94a3b8' }}>%</span>
              </div>
              <div>
                <label style={s.commentLabel}>Justificación del Ajuste al Perfil</label>
                <textarea
                  style={{ ...s.ta, minHeight: '120px' }}
                  value={inf.ajusteCargo?.analisis || ''}
                  onChange={e => setInf(p => ({ ...p, ajusteCargo: { ...p.ajusteCargo, analisis: e.target.value } }))}
                  placeholder="Explique por qué el candidato se ajusta o no a la posición..."
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <h4 style={{ color: '#16a34a', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>✦ Fortalezas Clave</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(inf.fortalezas || []).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                      <input
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #dcfce7', width: '100%', fontSize: '0.9rem', color: '#14532d', padding: '2px 0' }}
                        value={typeof f === 'object' ? `${f.tendencia || f.competencia} - ${f.mecanismo}` : f}
                        onChange={e => {
                          const n = [...inf.fortalezas]; 
                          if (typeof f === 'object') {
                            n[i] = { ...f, tendencia: e.target.value };
                          } else {
                            n[i] = e.target.value;
                          }
                          setInf(p => ({ ...p, fortalezas: n }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff7ed', padding: '1.25rem', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                <h4 style={{ color: '#ea580c', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>▲ Áreas de Desarrollo</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(inf.oportunidadesMejora || []).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ea580c' }} />
                      <input
                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #ffedd5', width: '100%', fontSize: '0.9rem', color: '#7c2d12', padding: '2px 0' }}
                        value={typeof f === 'object' ? `${f.tendencia || f.competencia} - ${f.mecanismo}` : f}
                        onChange={e => {
                          const n = [...inf.oportunidadesMejora];
                          if (typeof f === 'object') {
                            n[i] = { ...f, tendencia: e.target.value };
                          } else {
                            n[i] = e.target.value;
                          }
                          setInf(p => ({ ...p, oportunidadesMejora: n }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2.5 AUDITORÍA DE PROCESO E INTEGRIDAD (RESTAURADO) ─────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardHeadTxt}>Auditoría de Proceso y Confiabilidad</span>
            <span style={s.badge}>Control de Calidad</span>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Índice de Confianza</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '900', color: inf.confianza > 80 ? '#059669' : inf.confianza > 60 ? '#d97706' : '#dc2626' }}>{inf.confianza}%</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Cambios de Pestaña</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#334155' }}>{inf.alertasTab}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Intentos de Copia</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#334155' }}>{inf.alertasCopia}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Tiempo Promedio</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#334155' }}>{inf.tiempoPromedio} min</div>
            </div>
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
            * El Índice de Confianza evalúa la integridad del proceso mediante el monitoreo de eventos proctoring en tiempo real.
          </div>
        </div>

        {/* ── 2.6 MATRIZ DE POTENCIAL CONDUCTUAL (SOFT SKILLS - PREMIUM) ────── */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <span style={s.cardHeadTxt}>Matriz de Potencial Conductual (Soft Skills)</span>
            <span style={s.badge}>Análisis de Meta-Competencias</span>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#f5f3ff', padding: '1rem', borderRadius: '16px', border: '1px solid #ddd6fe', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Liderazgo</div>
                <input type="number" style={{ fontSize: '2rem', fontWeight: '900', color: '#7c3aed', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.liderazgo} onChange={e => upd('liderazgo', Number(e.target.value))} />
                <div style={{ fontSize: '0.6rem', color: '#9333ea', marginTop: '2px' }}>Impacto e Influencia</div>
              </div>
              <div style={{ background: '#fff7ed', padding: '1rem', borderRadius: '16px', border: '1px solid #ffedd5', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Adaptabilidad</div>
                <input type="number" style={{ fontSize: '2rem', fontWeight: '900', color: '#ea580c', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.adaptabilidad} onChange={e => upd('adaptabilidad', Number(e.target.value))} />
                <div style={{ fontSize: '0.6rem', color: '#c2410c', marginTop: '2px' }}>Flexibilidad al Cambio</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '16px', border: '1px solid #fee2e2', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Resiliencia</div>
                <input type="number" style={{ fontSize: '2rem', fontWeight: '900', color: '#dc2626', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.resiliencia} onChange={e => upd('resiliencia', Number(e.target.value))} />
                <div style={{ fontSize: '0.6rem', color: '#b91c1c', marginTop: '2px' }}>Tolerancia a la Presión</div>
              </div>
              <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '16px', border: '1px solid #d1fae5', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#059669', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Colaboración</div>
                <input type="number" style={{ fontSize: '2rem', fontWeight: '900', color: '#059669', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.colaboracion} onChange={e => upd('colaboracion', Number(e.target.value))} />
                <div style={{ fontSize: '0.6rem', color: '#047857', marginTop: '2px' }}>Sintonía Grupal</div>
              </div>
              <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '16px', border: '1px solid #e0f2fe', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Comunicación</div>
                <input type="number" style={{ fontSize: '2rem', fontWeight: '900', color: '#0284c7', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.comunicacion} onChange={e => upd('comunicacion', Number(e.target.value))} />
                <div style={{ fontSize: '0.6rem', color: '#0369a1', marginTop: '2px' }}>Claridad y Discurso</div>
              </div>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1.25rem', textAlign: 'center', lineHeight: '1.4' }}>
              Estas métricas integran múltiples rasgos de personalidad para predecir el éxito en entornos organizacionales dinámicos.
            </p>
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
            placeholder="Síntesis profunda del perfil..."
            value={inf.resumenEjecutivo || ''}
            onChange={e => upd('resumenEjecutivo', e.target.value)}
          />
        </div>

        {/* ── II. EVALUACIÓN PSICOMÉTRICA POR TÉCNICA (PERSONALIDAD) ────────── */}
        {hasP && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>II. Evaluación Psicométrica por Técnica (Personalidad)</span>
              <span style={s.badge}>Dimensiones del Big Five</span>
            </div>

            <div style={{ padding: '0 1.25rem' }}>
              {getFactoresUnicos(DOMINIOS.PERSONALIDAD).map(([factor, { valor, sesionId }]) => {

                const narrativas: Record<string, any> = {
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
                  }
                };

                const normVal = Math.min(5.0, Math.max(0, parseVal(valor, factor)))
                const clr = clrOf(normVal)
                const fk = `${sesionId}_${factor.toLowerCase()}`
                const cat = normVal >= 4.5 ? 'alto' : normVal >= 3.0 ? 'medio' : 'bajo'
                const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || `El candidato muestra un nivel de ${Number(normVal.toFixed(1))}/5 en ${ETQ[factor.toLowerCase()] || factor}.`

                return (
                  <div key={factor} style={s.factBlk}>
                    <div style={s.factRow}>
                      <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                      <span style={{ ...s.factLvl, color: clr }}>{Number(normVal.toFixed(1))}/5</span>
                    </div>
                    <div style={s.barBg}><div style={{ ...s.barFill, width: `${(normVal / 5) * 100}%`, background: clr }} /></div>
                    <textarea style={s.taFact} rows={4} value={inf.interpretacionPorFactor?.[fk] || inf.interpretacionPorFactor?.[factor.toLowerCase()] || descSugerida} onChange={(e) => updFactor(fk, e.target.value)} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 2.7 PERFIL DE PERSONALIDAD MBTI (RESTAURADO) ──────────────────── */}
        {hasP && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>Perfil Tipológico MBTI</span>
              <span style={s.badge}>Estimación Psicométrica</span>
            </div>
            {(() => {
              const pbPersonalidad = getFactoresUnicos(DOMINIOS.PERSONALIDAD)[0]?.[1]?.valor;
              const mbtiCodigo = inf.mbtiType || estimarMBTI(pbPersonalidad) || 'N/A';
              const mbtiDesc = MBTI_DESC[mbtiCodigo] || 'No se cuenta con datos suficientes para una estimación tipológica precisa.';
              
              return (
                <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ background: '#f0f9ff', padding: '2rem', borderRadius: '16px', border: '1px solid #bae6fd', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', fontWeight: '900', color: '#0369a1' }}>{mbtiCodigo}</div>
                    <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 'bold', textTransform: 'uppercase' }}>Tipo Estimado</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ color: '#1e293b', margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 'bold' }}>Análisis Tipológico</h4>
                    <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', fontStyle: 'italic' }}>
                      {mbtiDesc}
                    </p>
                    <div style={{ marginTop: '1rem' }}>
                      <label style={s.commentLabel}>Ajuste Tipológico al Cargo</label>
                      <textarea 
                        style={{ ...s.ta, fontSize: '0.85rem' }} 
                        rows={3} 
                        value={inf.ajusteMbti || ''} 
                        onChange={e => upd('ajusteMbti', e.target.value)}
                        placeholder="Análisis del perfil tipológico en relación al puesto..."
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── III. CAPACIDAD ANALÍTICA ─────────────────────────────────────── */}
        {hasC && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>III. Capacidad Analítica y Potencial Cognitivo</span>
              <span style={s.badge}>Métricas de Aptitud</span>
            </div>
            {sesCog.length > 0 && (() => {
              // Calculamos el promedio de todos los tests cognitivos/aptitud
              let sumaCorrectas = 0
              let sumaTotal = 0
              let sumaPercentil = 0
              
              sesCog.forEach(s => {
                const { correctas, total, percentil } = cogData(s.puntaje_bruto)
                sumaCorrectas += correctas
                sumaTotal += total
                sumaPercentil += percentil
              })

              const normVal = sumaTotal > 0 ? Math.round((sumaCorrectas / sumaTotal) * 5 * 10) / 10 : 0
              const percentil = Math.round(sumaPercentil / sesCog.length)
              const nivel = nivelPercentil(percentil)
              
              return (
                <div key="cog-agregado" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#f0f9ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0369a1' }}>{Number(normVal.toFixed(1))}/5</div>
                      <div style={{ fontSize: '0.75rem', color: '#0369a1', textTransform: 'uppercase', fontWeight: '800' }}>Efectividad Cognitiva</div>
                    </div>
                    <div style={{ background: '#f0f9ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0369a1' }}>P{percentil}</div>
                      <div style={{ fontSize: '0.75rem', color: '#0369a1', textTransform: 'uppercase', fontWeight: '800' }}>{nivel}</div>
                    </div>
                  </div>
                  {getFactoresUnicos(DOMINIOS.COGNITIVO).filter(([k]) => !['correctas', 'total', 'score', 'percentil'].includes(k)).map(([factor, { valor, sesionId }]) => {
                    const vNorm = parseVal(valor, factor)
                    const fk = `${sesionId}_${factor.toLowerCase()}`

                    const narrativas: Record<string, any> = {
                      documentos: {
                        alto: 'Destaca por un manejo prolijo y ordenado de los activos documentales y registros administrativos. Su capacidad para organizar volúmenes de datos asegura que la información sea tratada con rigor, facilitando un entorno operativo fluido y fortaleciendo la calidad de la gestión administrativa interna.',
                        medio: 'Muestra un cuidado profesional adecuado en la organización y revisión de documentos. Mantiene un estándar de orden constante, logrando procesar la información con claridad y criterio, lo que asegura que las tareas de soporte avancen sin contratiempos.',
                        bajo: 'En tareas que exigen un rigor sistemático extremo en la gestión de archivos, se beneficiará del apoyo de listas de verificación. Su enfoque tiende a ser más ágil que detallista, por lo que una revisión de cierre asegurará la integridad total de los registros.'
                      },
                      comparacion: {
                        alto: 'Manifiesta una notable agilidad en el procesamiento y reconocimiento de patrones. Logra contrastar información y detectar discrepancias con una fluidez que optimiza los tiempos de respuesta, aportando una alta efectividad en tareas que demandan validación constante.',
                        medio: 'Demuestra un ritmo de ejecución equilibrado que le permite abordar tareas habituales con una fluidez adecuada. Es capaz de contrastar información de manera efectiva, manteniendo una cadencia estable que asegura la calidad del resultado final.',
                        bajo: 'Tiende a procesar la comparación de datos de forma más pausada para asegurar la exactitud. Su desempeño mejora en entornos que no dependan de una respuesta inmediata, permitiéndole realizar una revisión más deliberada de la información.'
                      },
                      concentracion: {
                        alto: 'Posees una capacidad de enfoque sostenido y constante, incluso en entornos con múltiples estímulos. Su atención se mantiene estable durante periodos prolongados, lo que le permite completar tareas complejas manteniendo un estándar de calidad homogéneo.',
                        medio: 'Mantiene un nivel de atención funcional durante la jornada. Logra enfocarse en sus objetivos a pesar de las distracciones comunes, asegurando una ejecución estable en sus responsabilidades diarias de manera profesional.',
                        bajo: 'Muestra un estilo de atención que puede fluctuar ante entornos de alta estimulación. Se beneficia de espacios de trabajo organizados que favorezcan la inmersión en la tarea, minimizando así el impacto de las distracciones en su desempeño.'
                      },
                      errores_texto: {
                        alto: 'Se identifica una notable minuciosidad en el procesamiento de información escrita y registros de texto. Su habilidad para identificar inconsistencias garantiza que la comunicación institucional sea presentada con un estándar de calidad constante, protegiendo la integridad de los reportes.',
                        medio: 'Es capaz de producir y revisar documentos con un nivel de corrección profesional claro. Detecta los errores comunes y mantiene una coherencia narrativa lógica, asegurando que las comunicaciones cumplan con los parámetros de claridad esperados.',
                        bajo: 'Su enfoque se centra principalmente en la agilidad de la comunicación. Para asegurar la precisión absoluta en la redacción de informes críticos, se recomienda una revisión final o el uso de herramientas de soporte que garanticen la consistencia de los textos.'
                      },
                      errores_numeros: {
                        alto: 'Demuestra un manejo seguro y criterioso de la información cuantitativa. Su enfoque en el cálculo y la transcripción de datos numéricos asegura una consistencia sólida en los reportes de gestión, aportando fiabilidad a los procesos de alta exactitud.',
                        medio: 'Maneja la información cuantitativa con seguridad y criterio profesional. Realiza cálculos y transcripciones con una baja incidencia de errores en condiciones normales, contribuyendo a la estabilidad y orden de los reportes del área.',
                        bajo: 'Ante volúmenes moderados de datos numéricos, su precisión mejora con una validación secundaria. Se beneficia de metodologías de trabajo pautadas que le permitan mantener el rigor en tareas que impliquen indicadores críticos de gestión.'
                      },
                      metricas_fraude: {
                        alto: 'Se observa una disposición genuina hacia la transparencia y la honestidad en su autopercepción profesional. Su estilo de respuesta sugiere una mirada objetiva sobre sus propias capacidades, lo que brinda una base de confianza sólida para la interpretación de los resultados.',
                        medio: 'Sus resultados muestran un ajuste profesional equilibrado entre la imagen proyectada y sus características reales. Mantiene un nivel de franqueza que permite confiar plenamente en la información brindada durante el proceso.',
                        bajo: 'Muestra una tendencia a proyectar una imagen muy positiva de sus capacidades. Para obtener una visión más equilibrada, se recomienda profundizar en ejemplos conductuales concretos que permitan validar la aplicación real de sus rasgos en el entorno laboral.'
                      }
                    };

                    const cat = vNorm >= 4.5 ? 'alto' : vNorm >= 3.0 ? 'medio' : 'bajo';
                    const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || 'Nivel de desempeño funcional acorde a los requerimientos del cargo.';

                    return (
                      <div key={factor} style={s.factBlk}>
                        <div style={s.factRow}>
                        <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                        <span style={{...s.factLvl, color:'#0369a1'}}>{Number(vNorm.toFixed(1))}/5</span>
                      </div>
                        <div style={s.barBg}><div style={{...s.barFill, width:`${(vNorm/5)*100}%`, background:'#0369a1'}} /></div>
                        <textarea 
                          style={s.taFact} 
                          rows={4} 
                          value={inf.interpretacionPorFactor?.[fk] || inf.interpretacionPorFactor?.[factor.toLowerCase()] || descSugerida} 
                          onChange={(e) => updFactor(fk, e.target.value)} 
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── IV. COMPETENCIAS PROFESIONALES ───────────────────────────────── */}
        {hasK && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>IV. Competencias Profesionales</span>
              <span style={s.badge}>Desempeño Situacional</span>
            </div>
            <div style={{ padding: '0 1.25rem' }}>
              {getFactoresUnicos(DOMINIOS.COMPETENCIAS).map(([factor, { valor, sesionId }]) => {
                const normVal = parseVal(valor, factor)
                const clr = clrOf(normVal)
                const fk = `${sesionId}_${factor.toLowerCase()}`

                const narrativas: Record<string, any> = {
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
                  }
                };

                const cat = normVal >= 4.5 ? 'alto' : normVal >= 3.0 ? 'medio' : 'bajo';
                const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || 'Muestra un nivel de competencia alineado con los desafíos del puesto evaluado.';

                return (
                  <div key={factor} style={s.factBlk}>
                    <div style={s.factRow}>
                      <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                      <span style={{...s.factLvl, color:clr}}>{Number(normVal.toFixed(1))}/5</span>
                    </div>
                    <div style={s.barBg}><div style={{...s.barFill, width:`${(normVal/5)*100}%`, background:clr}} /></div>
                    <textarea 
                      style={s.taFact} 
                      rows={4} 
                      value={inf.interpretacionPorFactor?.[fk] || inf.interpretacionPorFactor?.[factor.toLowerCase()] || descSugerida} 
                      onChange={(e) => updFactor(fk, e.target.value)} 
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── V. SALUD Y BIENESTAR LABORAL ─────────────────────────────────── */}
        {hasV && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>V. Salud y Bienestar Laboral</span>
              <span style={s.badge}>Indicadores de Riesgo</span>
            </div>
            <div style={{ padding: '0 1.25rem' }}>
              {getFactoresUnicos(DOMINIOS.BIENESTAR).map(([factor, { valor, sesionId }]) => {
                const normVal = parseVal(valor, factor)
                const clr = clrOf(normVal)
                const fk = `${sesionId}_${factor.toLowerCase()}`

                const narrativas: Record<string, any> = {
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
                    alto: 'Manifiesta un estado de calma operativa y alta resiliencia. Su percepción de las demandas externas es de control, lo que le permite mantener una ejecución técnica fluida y sin ruidos emocionales.',
                    medio: 'Gestiona la tensión operativa de forma profesional en la mayoría de las situaciones. Mantiene el control bajo demanda moderada, requiriendo pausas de recuperación ante picos extraordinarios de presión.',
                    bajo: 'Presenta indicadores de tensión que sugieren una fase de alerta elevada. Se beneficia de entornos estructurados y previsibles que le permitan recuperar su objetividad en la toma de decisiones.'
                  },
                  carga_laboral: {
                    alto: 'Considera que el volumen de trabajo actual le permite un desempeño holgado y detallista. Posee capacidad remanente para asumir nuevos desafíos o liderar iniciativas especiales con rigor técnico.',
                    medio: 'Logra procesar el volumen de trabajo asignado de forma eficiente, ajustando su ritmo a las prioridades del área sin comprometer la calidad de los resultados finales.',
                    bajo: 'Percibe un volumen de tareas que desafía su capacidad de organización. Requiere soporte en la jerarquización estratégica de prioridades para evitar la saturación y asegurar el cumplimiento de hitos.'
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
                };

                const cat = normVal >= 4.5 ? 'alto' : normVal >= 3.0 ? 'medio' : 'bajo';
                const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || 'Muestra indicadores de bienestar acordes a una integración saludable.';

                return (
                  <div key={factor} style={s.factBlk}>
                    <div style={s.factRow}>
                      <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                      <span style={{...s.factLvl, color:clr}}>{Number(normVal.toFixed(1))}/5</span>
                    </div>
                    <div style={s.barBg}><div style={{...s.barFill, width:`${(normVal/5)*100}%`, background:clr}} /></div>
                    <textarea 
                      style={s.taFact} 
                      rows={4} 
                      value={inf.interpretacionPorFactor?.[fk] || inf.interpretacionPorFactor?.[factor.toLowerCase()] || descSugerida} 
                      onChange={(e) => updFactor(fk, e.target.value)} 
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 6. RECOMENDACIÓN ──────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardHeadTxt}>Dictamen Final</span><span style={s.badge}>Evaluación de Ajuste</span></div>
          <div style={s.recBtns}>
            {(['recomendado', 'con_reservas', 'no_recomendado'] as Rec[]).map(op => (
              <button key={op} onClick={() => upd('recomendacion', op)} style={{ ...s.recBtn, borderColor: inf.recomendacion === op ? REC_COLOR[op] : '#e2e8f0', background: inf.recomendacion === op ? REC_COLOR[op] + '18' : '#fff', color: inf.recomendacion === op ? REC_COLOR[op] : '#64748b', fontWeight: inf.recomendacion === op ? '700' : '400' }}>
                {REC_LABELS[op]}
              </button>
            ))}
          </div>
          <div style={{ ...s.sello, background: REC_COLOR[inf.recomendacion] + '12', borderColor: REC_COLOR[inf.recomendacion] + '50', color: REC_COLOR[inf.recomendacion] }}>
            {REC_LABELS[inf.recomendacion].toUpperCase()}
          </div>
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <label style={s.commentLabel}>Argumentación Técnica del Dictamen</label>
            <textarea style={{ ...s.ta, minHeight: '120px' }} value={inf.fundamentacion || ''} onChange={e => upd('fundamentacion', e.target.value)} placeholder="Fundamente su recomendación basándose en las evidencias psicométricas..." />
          </div>
        </div>

        {/* ── 7. FIRMA ──────────────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardHeadTxt}>Validación del Informe</span></div>
          <div style={{ padding: '1.25rem' }}>
            <label style={s.commentLabel}>Nombre del Evaluador Responsable</label>
            <input style={{ ...s.ta, padding: '0.75rem' }} value={inf.nombreEvaluador || ''} onChange={e => upd('nombreEvaluador', e.target.value)} />
          </div>
        </div>
        {/* ── PIE DE INFORME (AUDITORÍA) ────────────────────────────────── */}
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5, fontSize: '0.7rem' }}>
          <span>PsicoPlataforma © 2026 - Informe de Auditoría Rigurosa</span>
          <span style={{ fontWeight: 'bold', color: '#0369a1' }}>ENGINE_V4.0_STABLE</span>
        </div>
      </div>
    </div>
  )
}

export default function InformePage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Cargando motor de informes...</div>}>
      <InformePageContent />
    </Suspense>
  )
}
