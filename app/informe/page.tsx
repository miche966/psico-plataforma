'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { InformePDF } from '@/components/InformePDF'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

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
  confianza: number
  alertasTab: number
  alertasCopia: number
  tiempoPromedio: number
}

const ETQ: Record<string, string> = {
  // Personalidad y Probidad
  extraversion: 'Extraversión', amabilidad: 'Amabilidad', responsabilidad: 'Responsabilidad',
  neuroticismo: 'Estabilidad Emocional', apertura: 'Apertura a la Experiencia',
  honestidad_humildad: 'Honestidad y Humildad',
  honestidad: 'Sinceridad y Franqueza',
  normas: 'Apego a Normas y Ética',
  promedio_general: 'Índice de Probidad General',
  
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
  liderazgo: 'Liderazgo Estratégico',
  trabajo_equipo: 'Trabajo en Equipo y Sinergia',
  adaptabilidad: 'Adaptabilidad al Cambio',
  resolucion_problemas: 'Resolución de Problemas Complejos',
  
  // Salud y Bienestar Laboral
  burnout: 'Nivel de Riesgo (Burnout)',
  equilibrio: 'Balance Vida-Trabajo',
  relaciones: 'Relaciones Interpersonales y Clima',
  claridad_rol: 'Percepción de Claridad de Rol',
  nivel_estres: 'Indicador de Tensión Psicológica',
  carga_laboral: 'Gestión de la Demanda de Trabajo',
  resiliencia: 'Capacidad de Resiliencia',
  manejo_estres: 'Gestión Situacional de Estrés',
  autoestima: 'Confianza y Autoestima Profesional',
  inteligencia_emocional: 'Inteligencia Emocional (IE)',
};

const DOMINIOS = {
  PERSONALIDAD: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad', 'honestidad', 'normas', 'promedio_general'],
  COGNITIVO: ['correctas', 'percentil', 'score', 'documentos', 'comparacion', 'concentracion', 'errores_texto', 'errores_numeros', 'metricas_fraude'],
  COMPETENCIAS: ['etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion', 'comunicacion', 'liderazgo', 'trabajo_equipo', 'adaptabilidad', 'resolucion_problemas'],
  BIENESTAR: ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'nivel_estres', 'carga_laboral', 'resiliencia', 'manejo_estres', 'autoestima', 'inteligencia_emocional']
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
  'ISTJ': 'Inspector - Responsable, leal, pragmático y orientado al deber.',
  'ISFJ': 'Protector - Dedicado, cálido, responsable y detallista.',
  'INFJ': 'Consejero - Idealista, organizado, visionario y decidido.',
  'INTJ': 'Arquitecto - Estratega, ambicioso, independiente y analítico.',
  'ISTP': 'Virtuoso - Pragmático, adaptable, observador y técnico.',
  'ISFP': 'Aventurero - Flexible, sensible, amable y creativo.',
  'INFP': 'Mediador - Idealista, leal, curioso y empático.',
  'INTP': 'Lógico - Analítico, escéptico, independiente y teórico.',
  'ESTP': 'Emprendedor - Enérgico, pragmático, observador y audaz.',
  'ESFP': 'Animador - Entusiasta, espontáneo, sociable y flexible.',
  'ENFP': 'Activista - Entusiasta, creativo, sociable y optimista.',
  'ENTP': 'Innovador - Analítico, curioso, estratégico y retador.',
  'ESTJ': 'Ejecutivo - Organizado, práctico, decidido y eficiente.',
  'ESFJ': 'Cónsul - Servicial, responsable, sociable y detallista.',
  'ENFJ': 'Protagonista - Inspirador, empático, organizado y líder.',
  'ENTJ': 'Comandante - Estratega, decidido, eficiente y líder nato.'
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
  // Si no hay requerimientos, calculamos un Índice de Potencial General basado en todos los datos
  if (!reqs || reqs.length === 0) {
    const todosLosFactores: Record<string, number> = {}
    
    sesiones.forEach(s => {
      const scan = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        Object.entries(obj).forEach(([k, v]) => {
          const key = k.toLowerCase()
          // Evitamos claves técnicas o de sistema
          if (['total', 'correctas', 'score', 'percentil', 'events', 'tabswitches', 'copypasteattempts', 'timeoutoffocus'].includes(key)) return
          
          if (!todosLosFactores.hasOwnProperty(key)) {
            let val = 0
            if (typeof v === 'object' && v !== null && 'correctas' in v) {
              val = (Number(v.correctas) / (Number(v.total) || 1)) * 5
            } else if (typeof v === 'number') {
              val = v
            } else if (typeof v === 'string') {
              const s = v.toLowerCase()
              if (s === 'alto') val = 5
              else if (s === 'medio') val = 3
              else if (s === 'bajo') val = 1.5
            }
            todosLosFactores[key] = val
          }
          if (key === 'por_factor' || key === 'por_subtipo') scan(v)
        })
      }
      scan(s.puntaje_bruto)
    })

    const vals = Object.values(todosLosFactores)
    if (vals.length === 0) return null
    
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return { general: Math.round((avg / 5) * 100), detalles: [] }
  }
  
  const scores: number[] = []
  const detalles = reqs.map(r => {
    // Buscar el valor más reciente para esta competencia
    let valorCandidato = -1 
    for (const s of sesiones) {
      if (!s.puntaje_bruto || valorCandidato !== -1) continue
      
      const buscar = (obj: any) => {
        if (!obj || typeof obj !== 'object' || valorCandidato !== -1) return
        Object.entries(obj).forEach(([f, v]: any) => {
          if (valorCandidato !== -1) return
          if (f.toLowerCase() === r.competencia.toLowerCase()) {
            valorCandidato = (typeof v === 'object' && v !== null && 'correctas' in v) ? (v.correctas / (v.total || 1)) * 5 : Number(v)
          }
          if ((f === 'por_factor' || f === 'por_subtipo') && typeof v === 'object') buscar(v)
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
    fortalezas: [],
    oportunidadesMejora: [],
    resumenEjecutivo: '',
    ajusteCargo: { score: 0, analisis: '' },
    interpretacionPorFactor: {},
    nombreEvaluador: 'Equipo de Consultoría Psicométrica',
    mbti: '',
    ajusteMbti: '',
    liderazgo: 0,
    adaptabilidad: 0,
    resiliencia: 0,
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

      // Recuperar Informe Existente o Inicializar
      const { data: rep } = await supabase.from('informes_psicometricos').select('*').eq('candidato_id', id).single()
      
      // Cálculo automático de ajuste inicial si hay requerimientos en el proceso
      let autoAjuste = 0
      if (procData && procData.competencias_requeridas && lista.length > 0) {
        const resAjuste = calcAjuste(procData.competencias_requeridas, lista)
        autoAjuste = resAjuste ? resAjuste.general : 0
      }

      if (rep) {
        const contenido = rep.contenido as InformeState
        setInf({ 
          ...contenido, 
          alertasTab: aTab, 
          alertasCopia: aCopia, 
          confianza, 
          tiempoPromedio: tiempoFinal,
          ajusteCargo: {
            score: contenido.ajusteCargo?.score ?? autoAjuste,
            analisis: contenido.ajusteCargo?.analisis ?? ''
          }
        })
      } else {
        setInf(prev => ({ 
          ...prev, 
          alertasTab: aTab, 
          alertasCopia: aCopia, 
          confianza, 
          tiempoPromedio: tiempoFinal,
          ajusteCargo: { score: autoAjuste, analisis: '' }
        }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Helpers de lógica
  const parseVal = (v: any, key?: string) => {
    if (typeof v === 'object' && v !== null) {
      if (key?.toLowerCase() === 'metricas_fraude') {
        const alertas = (v.events?.length || 0) + (v.tabSwitches || 0) + (v.copyPasteAttempts || 0)
        return Math.max(0, 5 - (alertas * 0.5))
      }
      if ('correctas' in v && 'total' in v) return (Number(v.correctas) / (Number(v.total) || 1)) * 5
      return Number(v.correctas || v.score) || 0
    }
    if (typeof v === 'string') {
      const s = v.toLowerCase().trim()
      if (s === 'alto') return 5
      if (s === 'medio') return 3
      if (s === 'bajo') return 1.5
    }
    return Number(v) || 0
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
  const sesCog = sesiones.filter(s => s.puntaje_bruto && (Object.keys(s.puntaje_bruto).some(k => DOMINIOS.COGNITIVO.includes(k.toLowerCase())) || (s.puntaje_bruto.por_factor && Object.keys(s.puntaje_bruto.por_factor).some(k => DOMINIOS.COGNITIVO.includes(k.toLowerCase())))))
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
    const mapa = new Map<string, { valor: any, sesionId: string, testId: string }>()
    
    // Ordenar sesiones por fecha (más reciente primero)
    const sesionesOrd = [...sesiones].sort((a, b) => {
      const dA = new Date(a.finalizada_en || a.iniciada_en || 0).getTime()
      const dB = new Date(b.finalizada_en || b.iniciada_en || 0).getTime()
      return dB - dA
    })

    sesionesOrd.forEach(s => {
      if (!s.puntaje_bruto) return
      const escanear = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        Object.entries(obj).forEach(([f, v]: any) => {
          const key = f.toLowerCase()
          if (dominio.includes(key)) {
            const vNum = parseVal(v, key)
            if (!mapa.has(key)) {
              const acc = (v && typeof v === 'object' && 'correctas' in v) ? (v.correctas / (v.total || 1)) : (Number(vNum) / 5)
              mapa.set(key, { valor: v, sesionId: s.id, testId: s.test_id, acc } as any)
            }
          }
          if (f === 'por_factor' && typeof v === 'object') escanear(v)
        })
      }
      escanear(s.puntaje_bruto)
    })
    return Array.from(mapa.entries())
  }

  // MBTI Estimator
  function estimarMBTI(pb: any) {
    if (!pb || !pb.extraversion) return null
    const E = pb.extraversion >= 3 ? 'E' : 'I'
    const S = pb.apertura < 3 ? 'S' : 'N'
    const T = pb.amabilidad < 3 ? 'T' : 'F'
    const J = pb.responsabilidad >= 3 ? 'J' : 'P'
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
      const data = await res.json()
      
      // La API devuelve el objeto directamente o bajo la clave 'informe'
      const nuevoInforme = data.informe || data
      
      if (nuevoInforme && !data.error) {
        setInf(prev => ({
          ...prev,
          ...nuevoInforme,
          // Preservamos las métricas de auditoría que la IA no debe sobrescribir
          alertasTab: prev.alertasTab,
          alertasCopia: prev.alertasCopia,
          confianza: prev.confianza,
          tiempoPromedio: prev.tiempoPromedio
        }))
      } else if (data.error) {
        alert('Error IA: ' + data.error)
      }
    } catch (e) {
      console.error(e)
      alert('Error de conexión con el motor de IA')
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
              <h1 style={s.title}>Editor de Informe Ejecutivo</h1>
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
            <div style={s.item}><span style={s.label}>Email</span><div style={s.value}>{candidato.email}</div></div>
            {proceso && (
              <>
                <div style={s.item}><span style={s.label}>Proceso</span><div style={s.value}>{proceso.nombre}</div></div>
                <div style={s.item}><span style={s.label}>Cargo</span><div style={s.value}>{proceso.cargo}</div></div>
              </>
            )}
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
                  value={inf.ajusteCargo?.analisis}
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
                        value={f}
                        onChange={e => {
                          const n = [...inf.fortalezas]; n[i] = e.target.value;
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
                        value={f}
                        onChange={e => {
                          const n = [...inf.oportunidadesMejora]; n[i] = e.target.value;
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div style={{ background: '#f5f3ff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #ddd6fe', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Liderazgo</div>
                <input type="number" style={{ fontSize: '2.5rem', fontWeight: '900', color: '#7c3aed', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.liderazgo} onChange={e => upd('liderazgo', Number(e.target.value))} />
                <div style={{ fontSize: '0.7rem', color: '#9333ea', marginTop: '4px' }}>Impacto e Influencia</div>
              </div>
              <div style={{ background: '#fff7ed', padding: '1.5rem', borderRadius: '16px', border: '1px solid #ffedd5', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Adaptabilidad</div>
                <input type="number" style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ea580c', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.adaptabilidad} onChange={e => upd('adaptabilidad', Number(e.target.value))} />
                <div style={{ fontSize: '0.7rem', color: '#c2410c', marginTop: '4px' }}>Flexibilidad al Cambio</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '1.5rem', borderRadius: '16px', border: '1px solid #fee2e2', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Resiliencia</div>
                <input type="number" style={{ fontSize: '2.5rem', fontWeight: '900', color: '#dc2626', background: 'transparent', border: 'none', width: '100%', textAlign: 'center' }} value={inf.resiliencia} onChange={e => upd('resiliencia', Number(e.target.value))} />
                <div style={{ fontSize: '0.7rem', color: '#b91c1c', marginTop: '4px' }}>Tolerancia a la Presión</div>
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
            value={inf.resumenEjecutivo}
            onChange={e => upd('resumenEjecutivo', e.target.value)}
          />
        </div>

        {/* ── II. PERSONALIDAD Y CONDUCTA ───────────────────────────────────── */}
        {hasP && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={s.cardHeadTxt}>II. Perfil Conductual y Personalidad</span>
              <span style={s.badge}>Dimensión Conductual</span>
            </div>

            <div style={{ padding: '0 1.25rem' }}>
              {getFactoresUnicos(DOMINIOS.PERSONALIDAD).map(([factor, { valor, sesionId }]) => {
                const numVal = parseVal(valor)
                const max = (valor && typeof valor === 'object' && 'total' in valor) ? (Number(valor.total) || 5) : 5
                const rawNorm = max > 0 ? Math.round((numVal / max) * 5 * 10) / 10 : 0
                const normVal = isNaN(rawNorm) ? 0 : rawNorm
                const clr = clrOf(normVal)
                const fk = `${sesionId}_${factor.toLowerCase()}`

                const narrativas: Record<string, any> = {
                  etica: {
                    alto: 'Presenta una estructura moral sólida y una alineación natural con marcos normativos de alta exigencia. Es un perfil que prioriza la transparencia y la rectitud incluso bajo niveles extremos de presión, lo que garantiza una gestión de riesgo nulo para la organización. Su compromiso con la honestidad no es reactivo, sino un valor intrínseco que actúa como un pilar de confianza para el equipo, asegurando que los procesos internos se mantengan íntegros y proyecten una imagen institucional de máxima seriedad.',
                    medio: 'Demuestra un comportamiento íntegro alineado con los estándares de convivencia y legalidad organizacional. Respeta las reglas establecidas y valora la transparencia en el trato diario, mostrando un criterio equilibrado entre la practicidad que requiere el negocio y la observancia de las normas vigentes. Es un perfil confiable que se adapta bien a entornos estructurados y que mantiene una conducta profesional predecible y ética en sus interacciones habituales.',
                    bajo: 'Muestra una tendencia a flexibilizar normas en favor de resultados inmediatos o situaciones de conveniencia personal. En entornos de alta regulación o manejo de recursos críticos, este perfil requiere una supervisión cercana y una definición muy clara de los marcos de cumplimiento para evitar sesgos en la toma de decisiones que puedan comprometer la imagen institucional. Se recomienda reforzar la cultura de integridad mediante auditorías frecuentes y metas basadas en procesos, no solo en resultados.'
                  },
                  responsabilidad: {
                    alto: 'Es un perfil de máxima confiabilidad operativa y autoliderazgo. Se caracteriza por un compromiso intrínseco con la excelencia de sus entregables y una gestión rigurosa de los cronogramas. No se limita a cumplir con sus asignaciones, sino que asume una propiedad total sobre los resultados finales, mostrando una autodisciplina que elimina la necesidad de microgestión. Es un activo clave para proyectos que demandan autonomía, rigor técnico y un sentido de urgencia constante para el éxito del área.',
                    medio: 'Cumple de manera consistente con sus compromisos laborales y mantiene un nivel de organización funcional acorde a las demandas del puesto. Es capaz de gestionar sus prioridades con autonomía en condiciones estándar, asegurando que el flujo de trabajo se mantenga estable y los objetivos se alcancen en los tiempos previstos. Responde bien a metas claras y a una supervisión de apoyo que le permita validar sus avances periódicamente.',
                    bajo: 'Suele presentar inconsistencias en el seguimiento de tareas a largo plazo o en el rigor de los detalles técnicos finales. Su desempeño tiende a ser reactivo a la presión externa, por lo que se beneficia de entornos con metas de muy corto plazo y una estructura de reporte frecuente para evitar la procrastinación. Requiere de un líder que establezca sistemas de control de calidad intermedios para asegurar que la productividad no decaiga ante la falta de supervisión directa.'
                  },
                  estabilidad: {
                    alto: 'Posee una madurez emocional superior que le permite procesar el estrés, la incertidumbre y la frustración de manera constructiva. Actúa como un regulador emocional natural en situaciones de crisis, manteniendo la objetividad analítica y evitando que las emociones nublen su juicio técnico. Su presencia aporta serenidad al equipo, facilitando la toma de decisiones críticas en entornos de alta volatilidad donde otros perfiles podrían verse desbordados por la presión situacional.',
                    medio: 'Muestra un equilibrio emocional saludable y una gestión profesional de sus reacciones en el entorno laboral. Logra manejar las presiones cotidianas con tranquilidad, aunque ante picos de demanda extrema o conflictos interpersonales agudos podría requerir espacios de descarga para mantener su enfoque. Su respuesta es predecible y estable, lo que facilita una convivencia armónica y una productividad constante sin grandes fluctuaciones anímicas.',
                    bajo: 'Tiende a verse afectado significativamente por el clima del entorno, la incertidumbre o las críticas constructivas, lo que genera fluctuaciones marcadas en su rendimiento. En periodos de alta tensión, su capacidad de análisis y ejecución podría verse mermada por el estrés, por lo que requiere un ambiente de trabajo que priorice la seguridad psicológica y una validación constante de su desempeño para evitar que la inseguridad emocional bloquee su capacidad operativa.'
                  },
                  amabilidad: {
                    alto: 'Es un facilitador de alto nivel para las relaciones interpersonales y la cohesión de la cultura interna. Su enfoque genuino en la armonía y la colaboración fomenta la sinergia grupal y la resolución pacífica de conflictos complejos. Su presencia suele elevar el bienestar del equipo, convirtiéndose en un puente de comunicación vital que facilita la integración de nuevas ideas y el apoyo mutuo, factores que impactan directamente en la retención del talento y el compromiso colectivo.',
                    medio: 'Mantiene una actitud colaborativa, respetuosa y profesional, integrándose con naturalidad a equipos de trabajo diversos. Valora el buen trato y la cortesía institucional, logrando un balance efectivo entre la asertividad necesaria para el cumplimiento de objetivos y la calidez humana que requiere la colaboración diaria. Es un perfil que contribuye activamente a mantener un clima laboral positivo y estable a largo plazo.',
                    bajo: 'Prioriza el pragmatismo, la lógica fría y los resultados objetivos por sobre las dinámicas interpersonales o el clima emocional del grupo. Su comunicación suele ser extremadamente directo y, en ocasiones, percibida como distante o poco empática por sus pares. Si bien es altamente eficiente en tareas técnicas individuales, requiere ser gestionado en entornos que demanden consenso o negociación para evitar fricciones que puedan afectar la cohesión del equipo de trabajo.'
                  },
                  apertura: {
                    alto: 'Destaca por una curiosidad intelectual insaciable y una apertura total a paradigmas disruptivos y nuevas tecnologías. Es un perfil que abraza el cambio no como un obstáculo, sino como una oportunidad estratégica de aprendizaje. Su capacidad para conectar ideas diversas y proponer soluciones creativas a problemas convencionales lo convierte en un motor de innovación fundamental para proyectos que busquen la mejora continua y la ventaja competitiva.',
                    medio: 'Muestra una receptividad adecuada hacia el aprendizaje continuo y la actualización de procesos operativos. Se adapta bien a los cambios tecnológicos o metodológicos siempre que se le presente un marco lógico y beneficios claros, manteniendo un equilibrio saludable entre el respeto por las prácticas que ya han demostrado ser exitosas y la exploración prudente de nuevas alternativas para optimizar su propio rendimiento.',
                    bajo: 'Presenta una marcada preferencia por entornos estables, métodos tradicionales y rutinas predecibles. Le resulta difícil salir de su zona de confort operativa y puede mostrar una resistencia pasiva ante cambios súbitos que no perciba como estrictamente necesarios. Su mayor valor reside en puestos que requieren un rigor metodológico extremo, constancia y donde la adherencia a procesos probados sea un factor crítico de éxito.'
                  }
                };

                const cat = normVal >= 4.5 ? 'alto' : normVal >= 3.0 ? 'medio' : 'bajo';
                const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || 'Muestra un perfil equilibrado acorde a las demandas profesionales.';

                return (
                  <div key={factor} style={s.factBlk}>
                    <div style={s.factRow}>
                      <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                      <span style={{ ...s.factLvl, color: clr }}>{normVal}/5</span>
                    </div>
                    <div style={s.barBg}><div style={{ ...s.barFill, width: `${(normVal/5)*100}%`, background: clr }} /></div>
                    <textarea style={s.taFact} rows={4} value={inf.interpretacionPorFactor?.[fk] || descSugerida} onChange={(e) => updFactor(fk, e.target.value)} />
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
            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ background: '#f0f9ff', padding: '2rem', borderRadius: '16px', border: '1px solid #bae6fd', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', fontWeight: '900', color: '#0369a1' }}>{estimarMBTI(getFactoresUnicos(DOMINIOS.PERSONALIDAD)[0]?.[1]?.valor) || 'N/A'}</div>
                <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 'bold', textTransform: 'uppercase' }}>Tipo Estimado</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ color: '#1e293b', margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 'bold' }}>Análisis Tipológico</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', fontStyle: 'italic' }}>
                  {MBTI_DESC[estimarMBTI(getFactoresUnicos(DOMINIOS.PERSONALIDAD)[0]?.[1]?.valor) || ''] || 'No se cuenta con datos suficientes para una estimación tipológica precisa.'}
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <label style={s.commentLabel}>Ajuste Tipológico al Cargo</label>
                  <textarea 
                    style={{ ...s.ta, fontSize: '0.85rem' }} 
                    rows={3} 
                    value={inf.ajusteMbti} 
                    onChange={e => upd('ajusteMbti', e.target.value)}
                    placeholder="Analice cómo este tipo de personalidad se desempeña en las tareas específicas del puesto..."
                  />
                </div>
              </div>
            </div>
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
              const sesion = sesCog[0] // Usar la más reciente para métricas generales
              const { correctas, total, percentil } = cogData(sesion.puntaje_bruto)
              const rawNorm = total > 0 ? Math.round((correctas / total) * 5 * 10) / 10 : 0
              const normVal = isNaN(rawNorm) ? 0 : rawNorm
              const nivel = nivelPercentil(percentil)
              return (
                <div key={sesion.id} style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#f0f9ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0369a1' }}>{normVal}/5</div>
                      <div style={{ fontSize: '0.75rem', color: '#0369a1', textTransform: 'uppercase', fontWeight: '800' }}>Efectividad Cognitiva</div>
                    </div>
                    <div style={{ background: '#f0f9ff', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0369a1' }}>P{percentil}</div>
                      <div style={{ fontSize: '0.75rem', color: '#0369a1', textTransform: 'uppercase', fontWeight: '800' }}>{nivel}</div>
                    </div>
                  </div>
                  {getFactoresUnicos(DOMINIOS.COGNITIVO).filter(([k]) => !['correctas','total','score','percentil'].includes(k)).map(([factor, { valor, sesionId }]) => {
                    const hasStructure = (valor && typeof valor === 'object' && 'correctas' in valor)
                    let vNum = hasStructure ? valor.correctas : parseVal(valor, factor)
                    let vMax = hasStructure ? (Number(valor.total) || 5) : 5
                    
                    // Eliminamos la inversión manual ya que parseVal maneja el fraude de forma nativa
                    const rawNorm = Math.round((vNum / vMax) * 5 * 10) / 10
                    const vNorm = isNaN(rawNorm) ? 0 : rawNorm
                    const fk = `${sesionId}_${factor.toLowerCase()}`
                    
                    const narrativas: Record<string, any> = {
                      documentos: {
                        alto: 'Muestra una agudeza excepcional en el manejo de registros y procesos administrativos. Su capacidad para detectar inconsistencias en grandes volúmenes de datos garantiza un flujo documental libre de errores operativos, lo que se traduce en una gestión administrativa de alta precisión y confiabilidad para la organización.',
                        medio: 'Posee una destreza adecuada para la organización y revisión de documentos técnicos. Mantiene un estándar de orden constante, logrando procesar información con seguridad y criterio, lo que asegura que los procesos de soporte administrativo se ejecuten sin contratiempos significativos.',
                        bajo: 'Presenta dificultades para mantener el rigor sistemático en la gestión de archivos o datos. Su rendimiento en tareas de control administrativo tiende a ser variable, por lo que requiere herramientas de soporte, listas de verificación o una supervisión final para garantizar la integridad de los registros.'
                      },
                      comparacion: {
                        alto: 'Su velocidad de procesamiento y reconocimiento de patrones es superior. Logra identificar diferencias sutiles y errores de transcripción con una rapidez que optimiza los tiempos de respuesta del área. Es un perfil altamente eficiente en tareas que demandan una validación cruzada constante y ágil.',
                        medio: 'Demuestra una agilidad mental acorde a las exigencias operativas habituales. Es capaz de contrastar información y detectar errores evidentes de manera eficiente, manteniendo un ritmo de trabajo estable que equilibra correctamente la velocidad con la precisión técnica.',
                        bajo: 'Tiende a procesar la comparación de datos de forma lenta o con omisiones ante la presión de tiempo. Le resulta difícil mantener la exactitud cuando se le exige rapidez, por lo que se desempeña mejor en tareas que no dependen de una respuesta inmediata o que permiten una revisión pausada.'
                      },
                      concentracion: {
                        alto: 'Posee una capacidad de atención sostenida admirable, incluso en entornos con altos niveles de interferencia. Su foco se mantiene imperturbable durante periodos prolongados, lo que le permite finalizar tareas complejas con un estándar de calidad homogéneo y sin degradación del rendimiento por fatiga mental.',
                        medio: 'Mantiene un nivel de atención estable durante la jornada laboral. Logra abstraerse de las distracciones comunes de la oficina para cumplir con sus objetivos, aunque podría presentar leves bajas en su precisión ante tareas extremadamente monótonas o tras periodos muy largos de actividad ininterrumpida.',
                        bajo: 'Su umbral de atención es limitado y se ve fácilmente afectado por estímulos externos o pensamientos intrusivos. Requiere pausas frecuentes o entornos de trabajo muy controlados y silenciosos para poder mantener la calidad operativa, ya que el riesgo de errores por distracción es latente.'
                      },
                      errores_texto: {
                        alto: 'Presenta un "ojo clínico" para la detección de anomalías sintácticas, ortográficas o de redacción. Su intervención en reportes y comunicaciones asegura una imagen institucional impecable, eliminando cualquier riesgo de malentendidos o falta de profesionalismo en la palabra escrita.',
                        medio: 'Es capaz de producir y revisar textos con un nivel de corrección profesional adecuado. Detecta los errores más comunes y mantiene una coherencia narrativa lógica, asegurando que las comunicaciones internas y externas cumplan con los estándares básicos de calidad de la organización.',
                        bajo: 'Muestra una tendencia a la omisión de errores en la redacción o revisión de informes. Su falta de agudeza en este sentido puede derivar en documentos con inconsistencias, por lo que su trabajo escrito requiere una edición final por parte de un tercero o el uso riguroso de correctores automatizados.'
                      },
                      errores_numeros: {
                        alto: 'Su precisión en el manejo de cifras y cálculos es de nivel experto. Detecta de inmediato descuadres contables o errores de carga de datos numéricos, aportando una capa de seguridad crítica en procesos financieros, estadísticos o de facturación donde el margen de error debe ser cero.',
                        medio: 'Maneja la información cuantitativa con seguridad y criterio. Logra realizar cálculos y transcripciones numéricas con una tasa de error muy baja en condiciones normales de trabajo, contribuyendo a la estabilidad de los reportes de gestión del área.',
                        bajo: 'Vulnerabilidad ante la fatiga numérica; tiende a trasponer cifras o cometer errores de cálculo básico cuando maneja volúmenes moderados de datos. Su desempeño en esta área debe ser validado doblemente para evitar impactos en la contabilidad o en los indicadores de rendimiento.'
                      },
                      metricas_fraude: {
                        alto: 'El perfil muestra una transparencia absoluta en su autoevaluación. No se detectan sesgos de deseabilidad social, lo que otorga una validez técnica muy alta a todos los resultados del informe. Sus respuestas reflejan una autopercepción realista y honesta, facilitando una integración genuina a la cultura organizacional.',
                        medio: 'Sus resultados son coherentes y muestran un ajuste realista entre la imagen profesional que desea proyectar y sus características reales. Mantiene un nivel de franqueza adecuado que permite confiar en la validez general de la evaluación, sin distorsiones significativas del perfil.',
                        bajo: 'Se observa una marcada tendencia a proyectar una imagen idealizada, lo que podría indicar una baja autocrítica o un intento deliberado de manipulación de la prueba. Los resultados de este informe deben cruzarse cuidadosamente con una entrevista por competencias para validar la veracidad de los rasgos declarados.'
                      }
                    };

                    const cat = vNorm >= 4.5 ? 'alto' : vNorm >= 3.0 ? 'medio' : 'bajo';
                    const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || 'Nivel de desempeño funcional acorde a los requerimientos del cargo.';

                    return (
                      <div key={factor} style={s.factBlk}>
                        <div style={s.factRow}><span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span><span style={{...s.factLvl, color:'#0369a1'}}>{vNorm}/5</span></div>
                        <div style={s.barBg}><div style={{...s.barFill, width:`${(vNorm/5)*100}%`, background:'#0369a1'}} /></div>
                        <textarea style={s.taFact} rows={4} value={inf.interpretacionPorFactor?.[fk] || descSugerida} onChange={(e) => updFactor(fk, e.target.value)} />
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
                const numVal = parseVal(valor)
                const max = (valor && typeof valor === 'object' && 'total' in valor) ? (Number(valor.total) || 5) : 5
                const rawNorm = max > 0 ? Math.round((numVal / max) * 5 * 10) / 10 : 0
                const normVal = isNaN(rawNorm) ? 0 : rawNorm
                const clr = clrOf(normVal)
                const fk = `${sesionId}_${factor.toLowerCase()}`

                const narrativas: Record<string, any> = {
                  comunicacion: {
                    alto: 'Demuestra una capacidad superior para articular ideas complejas de forma sencilla, coherente y persuasiva. Su comunicación no es solo un intercambio de información, sino una herramienta estratégica que impacta positivamente en sus interlocutores, logrando alinear expectativas, generar consensos y movilizar voluntades en entornos de alta exigencia profesional. Es un perfil que fortalece la imagen institucional en cada interacción y domina el arte de la escucha activa.',
                    medio: 'Logra transmitir información de manera efectiva, estructurada y profesional, asegurando que los mensajes clave lleguen a su destino sin distorsiones operativas. Posee habilidades de comunicación asertiva que le permiten interactuar constructivamente con sus pares y superiores, manteniendo un flujo de información funcional que apoya la operatividad diaria. Se beneficia de contar con marcos de referencia claros para optimizar el impacto de su discurso en audiencias diversas.',
                    bajo: 'Presenta dificultades para estructurar sus mensajes de forma lógica y sintética, lo que puede derivar en malentendidos, omisiones de datos críticos o una percepción de falta de claridad por parte del equipo. Su estilo comunicativo tiende a ser insuficiente para las demandas estratégicas del cargo, por lo que requiere entrenamiento específico en oratoria técnica, redacción ejecutiva y el uso de canales de comunicación más pautados para garantizar la efectividad.',
                  },
                  liderazgo: {
                    alto: 'Posee una visión estratégica de largo alcance y una capacidad natural para inspirar y guiar equipos hacia el logro de metas altamente ambiciosas. Su liderazgo se fundamenta en el ejemplo personal, la integridad y el empoderamiento de sus colaboradores, logrando delegar con confianza y mentorizar el talento emergente. Es un motor de resultados extraordinarios que sabe equilibrar con maestría la exigencia técnica con el bienestar y la motivación del capital humano.',
                    medio: 'Muestra iniciativa para coordinar procesos operativos y guiar a sus compañeros en situaciones de trabajo cotidiano. Ejerce una influencia positiva basada en su sólido conocimiento técnico y su capacidad de organización, logrando que el equipo mantenga el rumbo y cumpla con los objetivos propuestos de manera cohesionada. Funciona bien como un líder de soporte que facilita la ejecución y mantiene la estabilidad del grupo bajo directrices generales.',
                    bajo: 'Muestra una marcada preferencia por roles de ejecución individual antes que de coordinación o gestión de personas. Le cuesta asumir la responsabilidad directa sobre el desempeño de terceros y tiende a evitar la toma de decisiones difíciles que puedan generar conflicto, por lo que su potencial de liderazgo requiere ser desarrollado mediante un plan de carrera estructurado y un acompañamiento jerárquico cercano que le brinde seguridad en la toma de decisiones.',
                  },
                  trabajo_equipo: {
                    alto: 'Destaca por su excepcional nivel de compromiso con los objetivos colectivos, priorizando de forma sistemática el éxito del grupo sobre el reconocimiento personal. Es un integrador por excelencia que fomenta la sinergia organizacional, comparte sus conocimientos de manera generosa y actúa como un soporte crítico para sus compañeros en momentos de alta carga laboral. Su presencia garantiza un clima de confianza y una productividad potenciada por la colaboración inteligente.',
                    medio: 'Se integra con facilidad a dinámicas grupales diversas, manteniendo una actitud cooperativa, propositiva y orientada al apoyo mutuo. Contribuye activamente al mantenimiento de un clima laboral positivo y cumple con rigor sus compromisos hacia el equipo, facilitando que los proyectos compartidos avancen de manera fluida y sin fricciones internas. Es un colaborador confiable que valora el consenso y la estabilidad en las relaciones de trabajo.',
                    bajo: 'Tiende a trabajar de forma aislada y compartimentada, mostrando cierta resistencia a compartir información estratégica o a delegar parte de sus responsabilidades técnicas. Su enfoque individualista puede ralentizar involuntariamente los procesos colectivos y afectar la agilidad del equipo, por lo que necesita ser integrado en proyectos que demanden una interdependencia obligatoria para desarrollar su músculo colaborativo y su sentido de pertenencia.',
                  },
                  adaptabilidad: {
                    alto: 'Muestra una flexibilidad cognitiva y operativa excepcional frente a entornos de alta volatilidad, incertidumbre y cambio constante. Logra reconfigurar sus estrategias, prioridades y métodos de trabajo de manera casi instantánea cuando el negocio lo demanda, manteniendo su productividad intacta y actuando como un agente de cambio positivo que ayuda al resto de la organización a transitar las transformaciones con seguridad y optimismo.',
                    medio: 'Logra asimilar cambios en procesos, herramientas y estructuras organizacionales en tiempos razonables, mostrando una apertura constructiva hacia la innovación necesaria. Es capaz de mantener su desempeño bajo control mientras atraviesa nuevas curvas de aprendizaje, ajustándose a los requerimientos cambiantes del cargo con solvencia y profesionalismo, siempre que el cambio esté debidamente justificado y comunicado.',
                    bajo: 'Presenta una marcada rigidez frente a las modificaciones súbitas en su rutina u operativa diaria. Los cambios imprevistos suelen generar una baja significativa en su rendimiento y un aumento en sus niveles de frustración personal, por lo que requiere de una gestión del cambio muy estructurada, comunicada con mucha antelación y con un acompañamiento paso a paso para poder integrarse a las nuevas dinámicas sin bloquearse.',
                  },
                  resolucion_problemas: {
                    alto: 'Posee un enfoque analítico, sistémico y pragmático de alto nivel para el abordaje de situaciones complejas. Identifica la raíz de los problemas de forma predictiva y propone soluciones integrales que no solo resuelven la urgencia inmediata, sino que previenen recurrencias futuras mediante la mejora de procesos. Su capacidad de decisión en situaciones críticas aporta una seguridad operativa y una eficiencia de recursos invaluable para la dirección.',
                    medio: 'Es capaz de resolver inconvenientes operativos de manera autónoma utilizando el sentido común, su experiencia previa y los recursos disponibles. Muestra iniciativa para destrabar situaciones que impiden el avance de sus tareas, buscando alternativas viables y comunicando los incidentes de forma oportuna a sus superiores. Su enfoque es resolutivo y práctico, asegurando la continuidad de la operación diaria sin necesidad de escalamientos constantes.',
                    bajo: 'Tiende a bloquearse ante imprevistos técnicos o a depender de manera excesiva de instrucciones externas detalladas para resolver problemas básicos. Su falta de autonomía resolutiva puede generar cuellos de botella en la operación y sobrecargar la supervisión, por lo que necesita ser capacitado en metodologías de análisis de problemas, pensamiento lateral y toma de decisiones bajo presión para ganar confianza operativa.',
                  },
                  etica: {
                    alto: 'Muestra una adherencia inquebrantable a los valores éticos y principios organizacionales, incluso en situaciones de alta complejidad o conflicto de intereses. Su integridad actúa como un marco de referencia para el equipo, promoviendo una cultura de transparencia y responsabilidad. Es un perfil altamente confiable para la gestión de activos críticos y la representación institucional en entornos de alta sensibilidad.',
                    medio: 'Actúa de manera íntegro y profesional en sus interacciones cotidianas, respetando las normas y valores establecidos por la organización. Posee un criterio ético equilibrado que le permite tomar decisiones alineadas con el bien común y la legalidad vigente. Es un colaborador confiable que valora la transparencia y el trato justo en todas sus relaciones laborales.',
                    bajo: 'Presenta dificultades para alinear sus acciones con los marcos éticos en situaciones de conveniencia personal o presión externa. Su juicio moral puede verse nublado por intereses de corto plazo, por lo que requiere una supervisión clara y un reforzamiento constante de la cultura de integridad organizacional para evitar sesgos que comprometan la reputación institucional.'
                  },
                  negociacion: {
                    alto: 'Destaca por una capacidad excepcional para gestionar desacuerdos y alcanzar acuerdos beneficiosos para todas las partes (ganar-ganar). Su habilidad para leer las necesidades implícitas y proponer soluciones creativas le permite destrabar negociaciones complejas, preservando la calidad de las relaciones interpersonales y asegurando la sostenibilidad de los acuerdos alcanzados.',
                    medio: 'Posee habilidades de negociación funcionales que le permiten llegar a consensos operativos en el día a día. Logra defender su posición de manera profesional y respetuosa, mostrando flexibilidad para ceder cuando el objetivo colectivo lo requiere. Su enfoque es práctico y orientado a la resolución constructiva de las diferencias habituales en el entorno de trabajo.',
                    bajo: 'Tiende a adoptar posturas rígidas o puramente competitivas que dificultan la resolución de conflictos. Su falta de flexibilidad y dificultad para empatizar con las necesidades del otro pueden generar estancamientos en las tareas compartidas, por lo que requiere entrenamiento en técnicas de comunicación asertiva y resolución alternativa de disputas.'
                  },
                  manejo_emocional: {
                    alto: 'Demuestra un dominio superior sobre sus reacciones emocionales, manteniendo la calma y el profesionalismo incluso en situaciones de crisis extrema. Su inteligencia emocional le permite procesar la tensión de manera productiva, actuando como un regulador emocional para el equipo y facilitando un clima de seguridad psicológica que favorece la toma de decisiones objetiva.',
                    medio: 'Logra gestionar sus emociones de manera profesional en el entorno laboral, evitando que los sentimientos personales interfieran con su desempeño técnico. Es capaz de manejar situaciones de estrés moderado con tranquilidad, manteniendo un trato cordial y estable con sus compañeros y superiores durante toda la jornada operativa.',
                    bajo: 'Sus emociones suelen desbordar su capacidad analítica en momentos de presión o conflicto. Presenta dificultades para autorregularse, lo que puede derivar en reacciones impulsivas o una baja significativa de su rendimiento ante críticas o imprevistos, requiriendo un ambiente de trabajo muy estable y predictivo.'
                  },
                  tolerancia_frustracion: {
                    alto: 'Posee una resiliencia excepcional que le permite mantenerse enfocado y productivo a pesar de los reveses o la falta de resultados inmediatos. No se desmotiva ante el error, sino que lo utiliza como insumo para el aprendizaje, persistiendo con optimismo y tenacidad hasta alcanzar los objetivos estratégicos propuestos.',
                    medio: 'Muestra una tolerancia adecuada a los inconvenientes y demoras habituales en el trabajo. Es capaz de sobrellevar los fallos operativos sin que afecten de manera permanente su ánimo o su productividad, retomando sus tareas con profesionalismo una vez superado el obstáculo situacional.',
                    bajo: 'Tiende a desmoralizarse rápidamente cuando las cosas no salen según lo planeado. Los fallos menores impactan de forma desproporcionada en su autoconfianza y motivación, lo que puede llevarle a abandonar tareas complejas o a una parálisis operativa ante la incertidumbre, requiriendo validación y apoyo constante.'
                  }
                };

                const cat = normVal >= 4.5 ? 'alto' : normVal >= 3.0 ? 'medio' : 'bajo';
                const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || 'Muestra un nivel de competencia alineado con los desafíos del puesto evaluado.';

                return (
                  <div key={factor} style={s.factBlk}>
                    <div style={s.factRow}><span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span><span style={{...s.factLvl, color:clr}}>{normVal}/5</span></div>
                    <div style={s.barBg}><div style={{...s.barFill, width:`${(normVal/5)*100}%`, background:clr}} /></div>
                    <textarea style={s.taFact} rows={4} value={inf.interpretacionPorFactor?.[fk] || descSugerida} onChange={(e) => updFactor(fk, e.target.value)} />
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
                const numVal = parseVal(valor)
                const max = (valor && typeof valor === 'object' && 'total' in valor) ? (Number(valor.total) || 5) : 5
                const rawNorm = max > 0 ? Math.round((numVal / max) * 5 * 10) / 10 : 0
                const normVal = isNaN(rawNorm) ? 0 : rawNorm
                const clr = clrOf(normVal)
                const fk = `${sesionId}_${factor.toLowerCase()}`

                const narrativas: Record<string, any> = {
                  resiliencia: {
                    alto: 'Presenta una capacidad de recuperación emocional notable frente a la adversidad laboral. Ante proyectos fallidos o periodos de crisis, logra capitalizar la experiencia como un aprendizaje activo, manteniendo su integridad psicológica y motivando al equipo a perseverar hacia los objetivos estratégicos de la organización.',
                    medio: 'Muestra una fortaleza emocional adecuada para afrontar los desafíos cotidianos del puesto. Es capaz de procesar los inconvenientes con objetividad y recuperar su ritmo operativo en tiempos razonables, asegurando que los contratiempos no afecten su estabilidad ni su rendimiento a largo plazo.',
                    bajo: 'Los obstáculos inesperados impactan de forma profunda en su motivación y seguridad. Presenta una recuperación lenta tras periodos de presión, lo que puede derivar en una baja de productividad sostenida ante entornos volátiles si no cuenta con un sistema de soporte y validación externa constante.',
                  },
                  manejo_estres: {
                    alto: 'Posee estrategias de afrontamiento de alto nivel que le permiten mantener la lucidez y la precisión técnica bajo condiciones de máxima presión. Sabe priorizar con maestría cuando el volumen de tareas aumenta, evitando el desbordamiento y actuando como un regulador del estrés para su entorno inmediato.',
                    medio: 'Gestiona de manera efectiva las demandas habituales de un entorno laboral dinámico. Mantiene el control sobre sus procesos y logra canalizar la tensión de forma saludable, aunque ante picos de demanda extraordinarios podría requerir apoyo en la organización de prioridades para evitar la fatiga mental.',
                    bajo: 'Presenta una baja tolerancia a la presión del tiempo y a la multiactividad. Ante situaciones de estrés moderado, su capacidad de organización se ve comprometida, lo que genera errores por precipitación o parálisis operativa. Requiere una estructura de tareas muy pautada y previsible.',
                  },
                  autoestima: {
                    alto: 'Demuestra una autopercepción sólida y una confianza genuina en sus competencias profesionales. Esta seguridad le permite aceptar feedback crítico con apertura y madurez, utilizándolo como insumo para su crecimiento sin que afecte su valía personal. Es un perfil que proyecta liderazgo y solvencia técnica.',
                    medio: 'Mantiene un nivel de confianza profesional equilibrado, reconociendo con realismo tanto sus fortalezas como sus áreas de mejora. Se siente capaz de afrontar nuevos desafíos operativos y muestra una receptividad constructiva ante las sugerencias de sus superiores y pares.',
                    bajo: 'Muestra inseguridad respecto a sus capacidades, lo que puede llevarle a evitar la toma de decisiones o a depender excesivamente de la aprobación de terceros. Requiere un reconocimiento constante de sus logros y un ambiente de baja exposición para poder desplegar su potencial sin miedo al error.',
                  },
                  inteligencia_emocional: {
                    alto: 'Sobresale por su capacidad para identificar y gestionar sutilmente el clima emocional de la organización. Su empatía y habilidades sociales le permiten mediar en conflictos complejos y construir redes de colaboración sólidas, convirtiéndose en un activo clave para la cultura y la retención del talento.',
                    medio: 'Posee una conciencia emocional funcional que facilita sus relaciones interpersonales en el trabajo. Entiende el impacto de su comportamiento en los demás y se esfuerza por mantener un trato profesional, empático y respetuoso, contribuyendo positivamente a la armonía del equipo.',
                    bajo: 'Presenta dificultades para leer las señales sociales o para regular sus reacciones emocionales en momentos de tensión. Puede generar fricciones involuntarias con el equipo debido a una comunicación poco empática, por lo que necesita formación en habilidades blandas y autorregulación consciente.',
                  },
                  burnout: {
                    alto: 'Presenta un perfil de alta resistencia al agotamiento laboral crónico, con mecanismos de autogestión efectivos que preservan su energía y motivación. Logra mantener un equilibrio saludable entre la entrega profesional y su bienestar personal, lo que garantiza una productividad sostenible a largo plazo.',
                    medio: 'Muestra niveles de fatiga dentro de los parámetros normales para la carga de trabajo habitual. Aunque logra cumplir con sus responsabilidades, se beneficia de prácticas de desconexión periódica y una organización del tiempo equilibrada para evitar el agotamiento.',
                    bajo: 'Se detectan indicadores de fatiga acumulada o un riesgo latente de agotamiento emocional. Le cuesta recuperar su energía tras jornadas intensas, por lo que requiere una revisión de sus tareas y un acompañamiento que priorice la prevención del estrés crónico.'
                  },
                  equilibrio: {
                    alto: 'Domina el balance entre sus esferas personal y laboral, integrándolas de forma armónica. Esta estabilidad le permite presentarse al trabajo con un enfoque pleno y una disposición positiva, impactando favorablemente en el clima del equipo.',
                    medio: 'Logra un equilibrio funcional que le permite atender sus compromisos profesionales sin descuidar significativamente su bienestar personal. Es capaz de establecer límites saludables en la mayoría de las situaciones cotidianas.',
                    bajo: 'Presenta dificultades para separar las demandas laborales de su vida privada, lo que genera una sensación de agobio constante. Esta falta de equilibrio afecta su capacidad de concentración y puede derivar en un deterioro de su rendimiento.'
                  },
                  relaciones: {
                    alto: 'Es un catalizador de relaciones interpersonales sanas y productivas. Su capacidad para generar confianza y colaborar de forma genuina fortalece el tejido social de la organización, facilitando la resolución de problemas compartidos.',
                    medio: 'Mantiene interacciones profesionales respetuosas y cordiales con sus compañeros. Se integra bien a la cultura del equipo y contribuye al mantenimiento de un clima de trabajo positivo basado en la cortesía y la cooperación.',
                    bajo: 'Sus relaciones en el trabajo suelen estar marcadas por la distancia o la falta de entendimiento mutuo. Le cuesta construir vínculos de confianza y puede verse involucrado en malentendidos que afectan la cohesión del grupo.'
                  },
                  claridad_rol: {
                    alto: 'Posee una comprensión absoluta de sus funciones, responsabilidades y el impacto de su trabajo en la estrategia global. Esta claridad le permite actuar con autonomía y seguridad, alineando sus esfuerzos con las metas del negocio.',
                    medio: 'Entiende correctamente sus tareas principales y el alcance de su posición en la estructura del área. Sabe qué se espera de su desempeño y logra orientar su actividad hacia el cumplimiento de los objetivos fijados.',
                    bajo: 'Muestra ambigüedad respecto a sus responsabilidades reales o a la prioridad de sus tareas. Esta incertidumbre genera inseguridad en su toma de decisiones, requiriendo una definición de perfil de puesto más rigurosa.'
                  }
                };

                const cat = normVal >= 4.5 ? 'alto' : normVal >= 3.0 ? 'medio' : 'bajo';
                const descSugerida = narrativas[factor.toLowerCase()]?.[cat] || 'Muestra indicadores de bienestar acordes a una integración saludable.';

                return (
                  <div key={factor} style={s.factBlk}>
                    <div style={s.factRow}><span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span><span style={{...s.factLvl, color:clr}}>{normVal}/5</span></div>
                    <div style={s.barBg}><div style={{...s.barFill, width:`${(normVal/5)*100}%`, background:clr}} /></div>
                    <textarea style={s.taFact} rows={4} value={inf.interpretacionPorFactor?.[fk] || descSugerida} onChange={(e) => updFactor(fk, e.target.value)} />
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
            <textarea style={{ ...s.ta, minHeight: '120px' }} value={inf.fundamentacion} onChange={e => upd('fundamentacion', e.target.value)} placeholder="Fundamente su recomendación basándose en las evidencias psicométricas..." />
          </div>
        </div>

        {/* ── 7. FIRMA ──────────────────────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardHead}><span style={s.cardHeadTxt}>Validación del Informe</span></div>
          <div style={{ padding: '1.25rem' }}>
            <label style={s.commentLabel}>Nombre del Evaluador Responsable</label>
            <input style={{ ...s.ta, padding: '0.75rem' }} value={inf.nombreEvaluador} onChange={e => upd('nombreEvaluador', e.target.value)} />
          </div>
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
