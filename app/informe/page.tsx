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
  // Personalidad y Probidad
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
    // Inversión lógica para escalas 0-5:
    if (k === 'errores_texto') {
      val = Math.max(0, 5 - val)
    }

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

      if (!res.ok) {
        throw new Error(`Servidor Vercel respondió con código ${res.status}. Esto suele ser un Timeout (10s) o un error de configuración.`);
      }

      const data = await res.json()
      
      const rawRes = data.informe || data
      
      if (rawRes && !data.error) {
        // Humanizador de factores técnicos mejorado (más flexible)
        const humanizar = (t: string) => {
          if (!t || typeof t !== 'string') return t
          let limpio = t
          Object.entries(ETQ).forEach(([key, label]) => {
            const variant = key.replace(/_/g, '[\\s\\-_]')
            const regex = new RegExp(`['"]?${variant}['"]?`, 'gi')
            limpio = limpio.replace(regex, label)
          })
          
          // Filtro de palabras rimbombantes y tecnicismos (humanización agresiva)
          const prohibidas: Record<string, string> = {
            'superior': 'destacado',
            'excelente': 'sólido',
            'extraordinario': 'notable',
            'maravilloso': 'positivo',
            'increíble': 'relevante',
            'magnífico': 'adecuado',
            'excepcional': 'destacado',
            'sobresaliente': 'notable',
            'inquebrantable': 'consistente',
            'agudo': 'claro',
            'aguda': 'clara',
            'profunda adherencia': 'adherencia consistente',
            'manejo excepcional': 'manejo efectivo',
            'inteligencia emocional': 'estabilidad emocional',
            'IE aplicada': 'gestión de emociones',
            'apego a normas y ética': 'sentido ético',
            'decisiones objetiva': 'decisiones objetivas',
            'DASS-21': 'equilibrio emocional',
            'DASS21': 'equilibrio emocional',
            'MBTI': 'perfil conductual',
            'ICAR': 'capacidad cognitiva',
            'SJT': 'juicio situacional',
            'discurso inferido': 'comunicación observada'
          }
          Object.entries(prohibidas).forEach(([mal, bien]) => {
            // Regex más agresivo para capturar variaciones y puntuación
            const regex = new RegExp(mal, 'gi')
            limpio = limpio.replace(regex, bien)
          })
          
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
${(inf.fortalezas || []).filter(f => f.trim() !== '').map(f => `• ${f}`).join('\n') || 'No definidas'}

OPORTUNIDADES DE MEJORA:
${(inf.oportunidadesMejora || []).filter(o => o.trim() !== '').map(o => `• ${o}`).join('\n') || 'No definidas'}

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
                    alto: 'Posee una energía social e interpersonal sobresaliente, lo que le permite actuar como un catalizador positivo dentro de los equipos de trabajo. Se destaca por su asertividad y capacidad para dinamizar entornos colaborativos, siendo especialmente efectivo en roles que demandan negociación, liderazgo de proyectos y una comunicación persuasiva orientada al impacto institucional.',
                    medio: 'Demuestra un equilibrio funcional entre la interacción social y la autonomía en sus tareas. Es capaz de integrarse con fluidez a dinámicas grupales cuando el objetivo lo requiere, manteniendo un estilo comunicativo profesional y eficiente que facilita la coordinación diaria sin comprometer su capacidad de enfoque individual.',
                    bajo: 'Muestra una preferencia por entornos de trabajo más estructurados y reflexivos, donde prime el análisis individual sobre la interacción constante. Su mayor potencial reside en tareas que requieran una concentración profunda y un procesamiento autónomo de la información, lejos de entornos con alta estimulación social.'
                  },
                  amabilidad: {
                    alto: 'Destaca por su excepcional disposición cooperativa y su orientación genuina hacia el apoyo al equipo. Es un perfil que prioriza la armonía y la sinergia organizacional, actuando como un mediador natural en situaciones de conflicto y fortaleciendo el tejido interpersonal de la empresa mediante una actitud de escucha activa y empatía.',
                    medio: 'Mantiene una actitud colaborativa y respetuosa, alineada con los estándares de profesionalismo de la organización. Logra interactuar constructivamente con sus pares, defendiendo su criterio técnico con asertividad pero manteniendo siempre un tono conciliador que favorece la estabilidad del clima laboral.',
                    bajo: 'Prioriza el pragmatismo y el cumplimiento de objetivos objetivos sobre las dinámicas de grupo. Su estilo tiende a ser más individualista y directo, lo que resulta eficiente en entornos de alta exigencia técnica o competitiva, aunque podría requerir acompañamiento en tareas que demanden alto consenso.'
                  },
                  responsabilidad: {
                    alto: 'Es un perfil de alta confiabilidad estratégica, caracterizado por un rigor excepcional en la organización de sus tareas y un fuerte compromiso con la excelencia de sus entregables. Su capacidad de autogestión y su enfoque meticuloso aseguran que los proyectos bajo su cargo se ejecuten con precisión técnica y dentro de los plazos establecidos.',
                    medio: 'Demuestra una organización funcional de su flujo de trabajo, cumpliendo de manera consistente con sus responsabilidades profesionales. Es capaz de gestionar prioridades con autonomía y responde positivamente a marcos de trabajo predefinidos, manteniendo un estándar de calidad estable en sus funciones cotidianas.',
                    bajo: 'Su desempeño es más óptimo en entornos con objetivos de corto plazo y una supervisión cercana que le brinde estructura. Podría presentar dificultades en la planificación de proyectos complejos a largo plazo, por lo que se beneficia de herramientas de gestión del tiempo y metas diarias claras.'
                  },
                  neuroticismo: {
                    alto: 'Muestra una madurez emocional y una resiliencia sobresalientes frente a la presión y la incertidumbre. Su capacidad para mantener la objetividad analítica bajo estrés actúa como un factor de estabilidad para el equipo, permitiéndole tomar decisiones equilibradas en momentos de crisis sin que las emociones interfieran en el resultado técnico.',
                    medio: 'Gestiona sus reacciones emocionales de forma profesional y equilibrada ante las demandas laborales habituales. Mantiene un rendimiento constante y un trato estable con sus colaboradores, mostrando una capacidad de ajuste adecuada a las variaciones normales de la carga de trabajo y el clima organizacional.',
                    bajo: 'Su umbral de tolerancia a la frustración tiende a ser limitado, pudiendo presentar fluctuaciones en su rendimiento ante climas de alta tensión o cambios imprevistos. Se recomienda un entorno de trabajo que brinde seguridad psicológica y una retroalimentación frecuente que refuerce su confianza y estabilidad operativa.'
                  },
                  apertura: {
                    alto: 'Se caracteriza por una curiosidad intelectual activa y una apertura excepcional hacia la innovación y el aprendizaje continuo. Es un agente de cambio natural que busca constantemente optimizar procesos y aplicar soluciones creativas para problemas convencionales, aportando una visión fresca y estratégica a la organización.',
                    medio: 'Muestra una receptividad adecuada hacia el cambio y la actualización de sus competencias técnicas. Se adapta con solvencia a nuevas metodologías cuando percibe un beneficio claro para su operativa, manteniendo un equilibrio saludable entre la innovación necesaria y los métodos de trabajo probados.',
                    bajo: 'Muestra una marcada preferencia por los procedimientos establecidos y las rutinas predecibles. Su mayor valor reside en funciones que requieran un seguimiento riguroso de normativas y donde la constancia operativa y la especialización en tareas conocidas sean factores clave de éxito para el área.'
                  },
                  normas: {
                    alto: 'Presenta una estructura moral sólida y una alineación consistente con marcos normativos de alta exigencia. Es un perfil que prioriza la transparencia y la rectitud incluso bajo niveles significativos de presión, lo que contribuye a una gestión de riesgo controlada para la organización.',
                    medio: 'Demuestra un comportamiento íntegro alineado con los estándares de convivencia y legalidad organizacional. Respeta las reglas establecidas y valora la transparencia en el trato diario, mostrando un criterio equilibrado.',
                    bajo: 'Podría mostrar tendencia a priorizar resultados inmediatos sobre ciertos marcos normativos. Se recomienda una definición clara de los lineamientos de cumplimiento y una supervisión periódica.'
                  },
                  honestidad: {
                    alto: 'Se destaca por su franqueza y una comunicación transparente. Su estilo facilita la construcción de confianza y la obtención de retroalimentación constructiva, siendo un perfil orientado a la claridad institucional.',
                    medio: 'Mantiene una comunicación equilibrada y profesional. Es capaz de ser sincero en sus planteamientos manteniendo las formas institucionales, logrando transmitir información relevante de manera asertiva.',
                    bajo: 'En ocasiones podría reservar información para evitar tensiones situacionales. Se sugiere fomentar un canal de comunicación abierto y validar la información relevante mediante indicadores objetivos.'
                  },
                  promedio_general: {
                    alto: 'El perfil proyecta una integridad global destacada. Sus valores personales se manifiestan en una conducta profesional coherente en las dimensiones evaluadas, favoreciendo una alineación sólida.',
                    medio: 'Posee un nivel de probidad acorde a las expectativas corporativas habituales. Su comportamiento es predecible dentro de los marcos éticos estándar, mostrando un juicio moral funcional.',
                    bajo: 'Se observan áreas de mejora en su juicio ético que requieren atención. Se recomienda un periodo de acompañamiento inicial y una comunicación clara de los valores corporativos.'
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
                    value={inf.ajusteMbti || ''} 
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
                        alto: 'Muestra una agudeza destacada en el manejo de registros y procesos administrativos. Su capacidad para identificar inconsistencias en volúmenes de datos favorece un flujo documental con mínima incidencia de errores, lo que se traduce en una gestión administrativa precisa y confiable para la organización.',
                        medio: 'Posee una destreza adecuada para la organización y revisión de documentos técnicos. Mantiene un estándar de orden constante, logrando procesar información con seguridad y criterio, lo que facilita que los procesos de soporte administrativo se ejecuten sin contratiempos.',
                        bajo: 'Podría presentar dificultades para mantener el rigor sistemático en la gestión de archivos o datos. Su rendimiento en tareas de control administrativo tiende a ser variable, por lo que se beneficia del uso de listas de verificación o una revisión final para asegurar la integridad de los registros.'
                      },
                      comparacion: {
                        alto: 'Su velocidad de procesamiento y reconocimiento de patrones es destacada. Logra identificar diferencias y errores de transcripción con una agilidad que optimiza los tiempos de respuesta del área, siendo un perfil eficiente en tareas que demandan validación de datos.',
                        medio: 'Demuestra una agilidad mental acorde a las exigencias operativas habituales. Es capaz de contrastar información y detectar errores de manera eficiente, manteniendo un ritmo de trabajo estable que equilibra la velocidad con la precisión técnica.',
                        bajo: 'Tiende a procesar la comparación de datos de forma más pausada ante la presión de tiempo. Su exactitud mejora en tareas que no dependen de una respuesta inmediata o que permiten una revisión detallada de la información.'
                      },
                      concentracion: {
                        alto: 'Posee una capacidad de atención sostenida consistente, incluso en entornos con interferencias. Su foco se mantiene estable durante periodos prolongados, lo que le permite finalizar tareas complejas con un estándar de calidad homogéneo y regular.',
                        medio: 'Mantiene un nivel de atención funcional durante la jornada laboral. Logra enfocarse en sus objetivos a pesar de las distracciones comunes, aunque podría presentar leves bajas en su precisión ante tareas monótonas o tras periodos largos de actividad ininterrumpida.',
                        bajo: 'Su umbral de atención tiende a ser variable y puede verse afectado por estímulos externos. Se recomienda un entorno de trabajo organizado y pausas programadas para mantener la calidad operativa y reducir el riesgo de errores por distracción.'
                      },
                      errores_texto: {
                        alto: 'Presenta una agudeza visual y analítica para la detección de anomalías en textos y reportes. Su intervención contribuye a una imagen institucional profesional, reduciendo significativamente el riesgo de malentendidos en la comunicación escrita.',
                        medio: 'Es capaz de producir y revisar textos con un nivel de corrección profesional adecuado. Detecta los errores comunes y mantiene una coherencia narrativa lógica, asegurando que las comunicaciones cumplan con los estándares de calidad de la organización.',
                        bajo: 'Muestra una tendencia a la omisión de errores en la redacción o revisión de informes. Se sugiere el uso de herramientas de corrección automatizada o una revisión final por un tercero para asegurar la consistencia de los documentos escritos.'
                      },
                      errores_numeros: {
                        alto: 'Su precisión en el manejo de cifras y cálculos es destacada. Logra identificar descuadres o errores de carga de datos numéricos con facilidad, aportando seguridad en procesos financieros, estadísticos o de facturación que requieran alta exactitud.',
                        medio: 'Maneja la información cuantitativa con seguridad y criterio. Realiza cálculos y transcripciones numéricas con una tasa de error baja en condiciones normales, contribuyendo a la estabilidad de los reportes de gestión del área.',
                        bajo: 'Puede presentar vulnerabilidad ante la fatiga numérica, tendiendo a cometer errores de transcripción cuando maneja volúmenes moderados de datos. Se recomienda una validación secundaria en tareas que impliquen indicadores críticos.'
                      },
                      metricas_fraude: {
                        alto: 'El perfil muestra una transparencia notable en su autoevaluación. No se detectan sesgos significativos de deseabilidad social, lo que aporta una validez técnica consistente a los resultados del informe y refleja una autopercepción honesta.',
                        medio: 'Sus resultados son coherentes y muestran un ajuste profesional entre la imagen que desea proyectar y sus características. Mantiene un nivel de franqueza que permite confiar en la validez general de la evaluación.',
                        bajo: 'Se observa una tendencia a proyectar una imagen idealizada, lo que podría indicar una autocrítica limitada. Se recomienda validar estos resultados mediante una entrevista por competencias para profundizar en la veracidad de los rasgos declarados.'
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
                const normVal = parseVal(valor, factor)
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
                    <div style={s.factRow}>
                      <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                      <span style={{...s.factLvl, color:clr}}>{Number(normVal.toFixed(1))}/5</span>
                    </div>
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
                const normVal = parseVal(valor, factor)
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
                    <div style={s.factRow}>
                      <span style={s.factName}>{ETQ[factor.toLowerCase()] || factor}</span>
                      <span style={{...s.factLvl, color:clr}}>{Number(normVal.toFixed(1))}/5</span>
                    </div>
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
