'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { FileText, Download, X, Search, AlertTriangle, BellRing, Clock, History, Video, CheckCircle2, Settings2, BarChart2, LayoutDashboard, Sparkles, Activity } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'
import GestionProcesos from '@/components/GestionProcesos'
import Dashboard from '@/components/Dashboard'
import AppLayout from '@/components/AppLayout'
import DiagnosticoRealtime from '@/components/DiagnosticoRealtime'


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
  'Responsabilidad': { responsabilidad: 5 },
  'Ética profesional': { etica: 5, normas: 5 },
  'Conciencia organizacional': { normas: 4.5, responsabilidad: 4.5 },
  'Flexibilidad': { apertura: 5, amabilidad: 4 }
}

function calcularMatch(puntaje: any, reqs: any[]) {
  if (!puntaje || !reqs || reqs.length === 0) return null
  
  let totalMatch = 0
  let totalComp = 0

  reqs.forEach(req => {
    const mapping = COMPETENCIAS_MAPPING[req.nombre]
    if (!mapping) return

    const valReq = req.nivel === 'A' ? 5 : req.nivel === 'B' ? 4 : req.nivel === 'C' ? 3 : 2
    let matchComp = 0
    let countFactores = 0

    Object.entries(mapping).forEach(([factor, ideal]) => {
      let real = puntaje[factor] || 0
      if (factor === 'neuroticismo' && (ideal as number) < 3) {
        real = 6 - real
        ideal = 6 - (ideal as number)
      }
      const diff = Math.abs(real - (ideal as number))
      const proximidad = Math.max(0, 1 - (diff / 3))
      matchComp += proximidad
      countFactores++
    })

    if (countFactores > 0) {
      totalMatch += (matchComp / countFactores)
      totalComp++
    }
  })

  return totalComp > 0 ? Math.round((totalMatch / totalComp) * 100) : null
}

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

interface Sesion {
  id: string
  test_id: string
  proceso_id?: string
  finalizada_en: string
  puntaje_bruto: Record<string, unknown>
  candidato_id: string | null
  candidato?: Candidato
  estado?: string
}

const BIG_FIVE_KEYS = ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura']

function esBigFive(pb: Record<string, unknown> | null): boolean {
  if (!pb) return false
  return BIG_FIVE_KEYS.some(k => k in pb)
}

function esCognitivo(pb: Record<string, unknown> | null): boolean {
  if (!pb) return false
  return 'correctas' in pb && 'total' in pb
}

function valoresNumericos(pb: Record<string, unknown> | null): [string, number][] {
  if (!pb) return []
  return Object.entries(pb).filter((e): e is [string, number] => typeof e[1] === 'number')
}

function promedioPuntaje(pb: Record<string, unknown> | null): number {
  if (!pb) return 0
  const nums = valoresNumericos(pb).map(([, v]) => v)
  if (!nums.length) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function datosCognitivos(pb: Record<string, unknown> | null) {
  if (!pb) return { correctas: 0, total: 1, pct: 0 }
  const correctas = Number(pb.correctas) || 0
  const total = Number(pb.total) || 1
  const pct = Math.round((correctas / total) * 100)
  return { correctas, total, pct }
}

const etiquetas: Record<string, string> = {
  extraversion: 'Extraversión',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  neuroticismo: 'Neuroticismo',
  apertura: 'Apertura',
  // SJT Problemas
  analisis: 'Análisis de Situación',
  priorizacion: 'Priorización de Tareas',
  inferencia: 'Inferencia Lógica',
  creatividad: 'Creatividad en Soluciones',
  decision: 'Toma de Decisiones',
  pensamiento_critico: 'Pensamiento Crítico',
  // SJT Atención
  empatia: 'Empatía y Orientación al Cliente',
  comunicacion: 'Comunicación Asertiva',
  escucha_activa: 'Escucha Activa',
  resolucion: 'Resolución de Incidencias',
  manejo_conflicto: 'Manejo de Conflictos',
  etica: 'Integridad y Normas',
  // SJT Comercial
  negociacion: 'Negociación y Cierre',
  etica_comercial: 'Ética Comercial',
  organizacion: 'Gestión de Cartera',
  trabajo_equipo: 'Colaboración Comercial',
  manejo_clientes: 'Relacionamiento con Clientes',
  cobranza: 'Gestión de Cobranza',
  proactividad_comercial: 'Proactividad en Ventas',
  orientacion_cliente: 'Enfoque en el Cliente',
  // Atención al Detalle
  documentos: 'Verificación de Documentos',
  comparacion: 'Comparación de Información',
  concentracion: 'Concentración y Foco',
  errores_texto: 'Detección de Errores de Texto',
  errores_numeros: 'Detección de Errores Numéricos',
  // Tolerancia a la Frustración y Emocional
  manejo_emocional: 'Manejo Emocional',
  tolerancia_frustracion: 'Tolerancia a la Frustración'
}

function formatearNombreFactor(factor: string): string {
  if (etiquetas[factor]) return etiquetas[factor]
  const conEspacios = factor.replace(/_/g, ' ')
  return conEspacios
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function esSJT(pb: any): boolean {
  return pb && 'por_factor' in pb
}

const TEST_IDS: Record<string, string> = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': 'bigfive',
  'f6a7b8c9-d0e1-2345-fabc-456789012345': 'icar',
  'd0e1f2a3-b4c5-6789-defa-000000000001': 'estres-laboral',
  'e1f2a3b4-c5d6-7890-efab-111222333444': 'creatividad',
  'e5f6a7b8-c9d0-1234-efab-345678901234': 'integridad',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': 'hexaco',
  'c3d4e5f6-a7b8-9012-cdef-123456789012': 'numerico',
  'd4e5f6a7-b8c9-0123-defa-234567890123': 'verbal',
  'a7b8c9d0-e1f2-3456-abcd-777777777777': 'sjt-ventas',
  'e5f6a7b8-c9d0-1234-efab-555555555555': 'tolerancia-frustracion',
  'f2a3b4c5-d6e7-8901-fabc-222333444555': 'sjt-problemas',
  'c9d0e1f2-a3b4-5678-cdef-999999999999': 'sjt-legal',
  'b2c3d4e5-f6a7-8901-bcde-222222222222': 'sjt-comercial',
  'a1b2c3d4-e5f6-7890-abcd-111111111111': 'comercial',
  'b8c9d0e1-f2a3-4567-bcde-888888888888': 'atencion-detalle',
  'f6a7b8c9-d0e1-2345-fabc-666666666666': 'sjt-atencion',
  '7a8b9c0d-e1f2-4356-abcd-999999999999': 'dass21',
  'e9b2c3d4-f5a6-7890-bcde-999999999999': 'sjt-cobranzas',
  'f7a8b9c0-d1e2-4356-abcd-888888888888': 'frases-incompletas',
  'd8e9f0a1-b2c3-4567-defa-888888888888': 'roleplay',
}

const TEST_NAMES: Record<string, string> = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': 'Big Five (Personalidad)',
  'f6a7b8c9-d0e1-2345-fabc-456789012345': 'ICAR (Capacidad Cognitiva)',
  'd0e1f2a3-b4c5-6789-defa-000000000001': 'Estrés Laboral',
  'e1f2a3b4-c5d6-7890-efab-111222333444': 'Creatividad',
  'e5f6a7b8-c9d0-1234-efab-345678901234': 'Integridad',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': 'HEXACO',
  'c3d4e5f6-a7b8-9012-cdef-123456789012': 'Razonamiento Numérico',
  'd4e5f6a7-b8c9-0123-defa-234567890123': 'Razonamiento Verbal',
  'a7b8c9d0-e1f2-3456-abcd-777777777777': 'SJT Ventas',
  'e5f6a7b8-c9d0-1234-efab-555555555555': 'Tolerancia a la Frustración',
  'f2a3b4c5-d6e7-8901-fabc-222333444555': 'SJT Resolución de Problemas',
  'c9d0e1f2-a3b4-5678-cdef-999999999999': 'SJT Legal',
  'b2c3d4e5-f6a7-8901-bcde-222222222222': 'SJT Comercial',
  'a1b2c3d4-e5f6-7890-abcd-111111111111': 'Perfil Comercial',
  'b8c9d0e1-f2a3-4567-bcde-888888888888': 'Atención al Detalle',
  'f6a7b8c9-d0e1-2345-fabc-666666666666': 'SJT Atención al Cliente',
  'e9b2c3d4-f5a6-7890-bcde-999999999999': 'SJT Cobranzas',
  'f7a8b9c0-d1e2-4356-abcd-888888888888': 'Frases Incompletas',
  'd8e9f0a1-b2c3-4567-defa-888888888888': 'Simulación Interactiva (Role Play)',
}

const colores: Record<string, string> = {
  extraversion: 'bg-blue-600',
  amabilidad: 'bg-green-600',
  responsabilidad: 'bg-purple-600',
  neuroticismo: 'bg-red-600',
  apertura: 'bg-orange-600'
}

const textColores: Record<string, string> = {
  extraversion: 'text-blue-600',
  amabilidad: 'text-green-600',
  responsabilidad: 'text-purple-600',
  neuroticismo: 'text-red-600',
  apertura: 'text-orange-600'
}

interface CandidatoAgrupado {
  id: string
  nombre: string
  apellido: string
  email: string
  documento?: string
  edad?: string
  sexo?: string
  formacion?: string
  profesion?: string
  sesiones: Sesion[]
  ultima_fecha: string
  proceso_id?: string
  proceso_nombre?: string
  proceso_cargo?: string
  competencias_requeridas?: any[]
  bateria_tests?: string[]
  progreso?: {
    total: number
    completados: number
    tests_pendientes: string[]
  }
  matchScore?: number | null
  resumen_ia?: string | null
}

async function generarResumenIA(candidato: CandidatoAgrupado) {
  try {
    const prompt = `
      Analiza los resultados de este candidato para un proceso de selección.
      Datos del candidato: ${candidato.nombre} ${candidato.apellido}
      Cargo: ${candidato.proceso_cargo}
      
      Resultados psicométricos (Big Five): ${JSON.stringify(candidato.sesiones.find(s => s.test_id.includes('bigfive'))?.puntaje_bruto || {})}
      Resultados de video (Transcripciones): ${JSON.stringify(candidato.sesiones.map(s => (s as any).transcripcion).filter(Boolean))}
      Match Score calculado: ${candidato.matchScore}%
      
      REQUERIMIENTO ESPECIAL: Realiza un ANÁLISIS DEL DISCURSO del candidato basándote en las transcripciones. 
      Evalúa su coherencia, riqueza de vocabulario, seguridad al expresarse y capacidad de estructurar ideas complejas.
      
      Redacta un resumen ejecutivo profesional de 2 párrafos. 
      Integra este análisis del discurso con sus rasgos de personalidad y su adecuación al cargo.
      Usa un tono corporativo, sobrio y analítico. No uses markdown, solo texto plano.
    `

    const response = await fetch('/api/ia-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })
    const data = await response.json()
    return data.summary
  } catch (err) {
    console.error("Error generando resumen:", err)
    return "No se pudo generar el resumen en este momento."
  }
}



function obtenerTextoAnalisis(analisis: any): string {
  if (!analisis) return ''
  if (typeof analisis === 'string') return analisis
  
  if (typeof analisis === 'object') {
    if (analisis.actitud) {
      if (typeof analisis.actitud === 'string') return analisis.actitud
      if (typeof analisis.actitud === 'object') {
        return Object.entries(analisis.actitud)
          .map(([key, val]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${val}`)
          .join(' | ')
      }
    }
    if (analisis.resumen && typeof analisis.resumen === 'string') return analisis.resumen
    if (analisis.analisis && typeof analisis.analisis === 'string') return analisis.analisis

    // Fallback: mapear todas las propiedades excluyendo transcripción
    return Object.entries(analisis)
      .filter(([k]) => k !== 'transcripcion')
      .map(([key, val]) => {
        const readableKey = key.replace(/_/g, ' ').toUpperCase()
        const readableVal = typeof val === 'object' ? JSON.stringify(val) : String(val)
        return `${readableKey}: ${readableVal}`
      })
      .join(' | ')
  }
  return String(analisis)
}

function obtenerTimestamp(fecha: string | null | undefined): number {
  if (!fecha) return 0
  const t = new Date(fecha).getTime()
  return isNaN(t) ? 0 : t
}

export default function PanelEvaluador() {
  const [tab, setTab] = useState<'evaluaciones' | 'gestion' | 'dashboard' | 'historial' | 'diagnostico'>('evaluaciones')
  const [candidatos, setCandidatos] = useState<CandidatoAgrupado[]>([])
  const [procesos, setProcesos] = useState<any[]>([])
  const [procesoSeleccionadoId, setProcesoSeleccionadoId] = useState<string>('todos')
  const [agrupadoSeleccionado, setAgrupadoSeleccionado] = useState<CandidatoAgrupado | null>(null)
  const [sesionSeleccionada, setSesionSeleccionada] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [videosCandidato, setVideosCandidato] = useState<any[]>([])
  const [sesionesGlobales, setSesionesGlobales] = useState<any[]>([])
  const [informeCandidato, setInformeCandidato] = useState<any>(null)
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [procesandoLote, setProcesandoLote] = useState(false)
  const [procesandoZip, setProcesandoZip] = useState(false)
  const [dropdownAbierto, setDropdownAbierto] = useState(false)
  const [busquedaDropdown, setBusquedaDropdown] = useState('')
  const [analizandoFrases, setAnalizandoFrases] = useState(false)
  const router = useRouter()
  const [velocidadesVideo, setVelocidadesVideo] = useState<Record<number, number>>({})

  // Helper para cálculo de Ajuste en lote
  function calcularAjusteLote(reqs: any[], sesionesList: any[]) {
    if (!reqs || reqs.length === 0) {
      const todosLosFactores: number[] = []
      sesionesList.forEach(s => {
        const scan = (obj: any) => {
          if (!obj || typeof obj !== 'object') return
          Object.entries(obj).forEach(([k, v]) => {
            const key = k.toLowerCase().trim()
            if (['total', 'correctas', 'porcentaje', 'id', 'created_at'].includes(key)) return
            const valNum = parseFloat(String(v))
            if (!isNaN(valNum)) {
              let val = valNum
              if (val > 5 && val <= 20) val = (val / 20) * 5
              else if (val > 20 && val <= 100) val = (val / 100) * 5
              if (val > 0 && val <= 5) todosLosFactores.push(val)
            }
          })
        }
        scan(s.puntaje_bruto)
      })
      if (todosLosFactores.length === 0) return 0
      const avg = todosLosFactores.reduce((a, b) => a + b, 0) / todosLosFactores.length
      return Math.round((avg / 5) * 100)
    }

    const scores: number[] = []
    reqs.forEach(r => {
      const compName = r.competencia || r.nombre;
      const reqLevelVal = r.nivel === 'A' ? 5 : r.nivel === 'B' ? 4 : r.nivel === 'C' ? 3 : 2;
      let valorCandidato = -1

      for (const s of sesionesList) {
        if (!s.puntaje_bruto || valorCandidato !== -1) continue
        const buscar = (obj: any) => {
          if (!obj || typeof obj !== 'object' || valorCandidato !== -1) return
          Object.entries(obj).forEach(([f, v]: any) => {
            if (valorCandidato !== -1) return
            const keyNormalizada = f?.toLowerCase()?.trim()
            if (keyNormalizada === compName?.toLowerCase()?.trim()) {
              valorCandidato = Number(v)
            }
          })
        }
        buscar(s.puntaje_bruto)
      }
      if (valorCandidato === -1) valorCandidato = 0
      if (valorCandidato > 5) valorCandidato = (valorCandidato / 100) * 5
      
      const pct = Math.min(100, Math.round((valorCandidato / reqLevelVal) * 100))
      scores.push(pct)
    })

    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
  }

  async function analizarSeleccionadosLote() {
    if (procesandoLote) return
    setProcesandoLote(true)

    try {
      let analizadosCount = 0
      for (const cId of seleccionados) {
        const c = candidatos.find(cand => cand.id === cId)
        if (!c) continue

        // Cargar respuestas de video
        const { data: vids } = await supabase
          .from('respuestas_video')
          .select('*')
          .eq('candidato_id', cId)
          .eq('estado', 'completado')
          .order('grabada_en', { ascending: true })

        let mappedVids: any[] = []
        if (vids && vids.length > 0) {
          const preguntaIds = vids.map(v => v.pregunta_id).filter(Boolean)
          let preguntas: any[] = []
          if (preguntaIds.length > 0) {
            const { data: pData } = await supabase
              .from('preguntas_video')
              .select('id, pregunta')
              .in('id', preguntaIds)
            if (pData) preguntas = pData
          }
          mappedVids = vids.map(v => {
            const q = preguntas.find(p => p.id === v.pregunta_id)
            return { ...v, preguntas_video: q ? { pregunta: q.pregunta } : null }
          })
        }

        const vMap = new Map<string, any>()
        mappedVids.forEach(v => {
          const k = `${v.entrevista_id}:${v.pregunta_id}`
          const ex = vMap.get(k)
          if (!ex || new Date(v.grabada_en) > new Date(ex.grabada_en)) vMap.set(k, v)
        })
        const finalVids = Array.from(vMap.values())

        const autoAjuste = calcularAjusteLote(c.competencias_requeridas || [], c.sesiones)

        const res = await fetch('/api/generar-informe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidato: { id: c.id, nombre: c.nombre, apellido: c.apellido, documento: (c as any).documento || '' },
            proceso: { cargo: c.proceso_cargo || 'S/C' },
            sesiones: c.sesiones,
            videos: finalVids,
            actual: { ajusteCargo: { score: autoAjuste, analisis: '' } }
          })
        })

        if (res.ok) {
          const data = await res.json()
          await supabase.from('informes_psicometricos').upsert({
            candidato_id: c.id,
            contenido: data,
            actualizado_en: new Date().toISOString()
          }, { onConflict: 'candidato_id' })
          analizadosCount++
        }
      }

      alert(`Se generaron y guardaron con éxito ${analizadosCount} informes en lote.`);
      setSeleccionados([]);
      router.refresh();
    } catch (err: any) {
      console.error(err)
      alert(`Error en análisis en lote: ${err.message}`)
    } finally {
      setProcesandoLote(false)
    }
  }

  async function descargarSeleccionadosZip() {
    if (procesandoZip) return
    setProcesandoZip(true)

    try {
      const JSZip = (await import('jszip')).default
      const { saveAs } = (await import('file-saver'))
      const { pdf } = await import('@react-pdf/renderer')
      const { InformePDF } = await import('@/components/InformePDF')

      const zip = new JSZip()
      let pdfsCount = 0

      for (const cId of seleccionados) {
        const c = candidatos.find(cand => cand.id === cId)
        if (!c) continue

        const { data: infData } = await supabase
          .from('informes_psicometricos')
          .select('contenido')
          .eq('candidato_id', cId)
          .maybeSingle()

        const inf = infData?.contenido
        if (!inf) {
          console.log(`Candidato ${c.nombre} no tiene informe generado aún.`);
          continue
        }

        const { data: vids } = await supabase
          .from('respuestas_video')
          .select('*')
          .eq('candidato_id', cId)
          .eq('estado', 'completado')
          .order('grabada_en', { ascending: true })

        let mappedVids: any[] = []
        if (vids && vids.length > 0) {
          const preguntaIds = vids.map(v => v.pregunta_id).filter(Boolean)
          let preguntas: any[] = []
          if (preguntaIds.length > 0) {
            const { data: pData } = await supabase
              .from('preguntas_video')
              .select('id, pregunta')
              .in('id', preguntaIds)
            if (pData) preguntas = pData
          }
          mappedVids = vids.map(v => {
            const q = preguntas.find(p => p.id === v.pregunta_id)
            return { ...v, preguntas_video: q ? { pregunta: q.pregunta } : null }
          })
        }

        const vMap = new Map<string, any>()
        mappedVids.forEach(v => {
          const k = `${v.entrevista_id}:${v.pregunta_id}`
          const ex = vMap.get(k)
          if (!ex || new Date(v.grabada_en) > new Date(ex.grabada_en)) vMap.set(k, v)
        })
        const finalVids = Array.from(vMap.values())

        const esHEXACO = (pb: any) => pb && 'honestidad' in pb
        const esBienestar = (pb: any) => pb && 'burnout' in pb

        const hasP = c.sesiones.some(s => esBigFive(s.puntaje_bruto) || esHEXACO(s.puntaje_bruto))
        const hasC = c.sesiones.some(s => esCognitivo(s.puntaje_bruto))
        const hasK = c.sesiones.some(s => esSJT(s.puntaje_bruto))
        const hasV = c.sesiones.some(s => esBienestar(s.puntaje_bruto))

        const sesBF = c.sesiones.find(s => esBigFive(s.puntaje_bruto))
        const sesHX = c.sesiones.find(s => esHEXACO(s.puntaje_bruto))
        const sesCog = c.sesiones.find(s => esCognitivo(s.puntaje_bruto))
        const sesComp = c.sesiones.find(s => esSJT(s.puntaje_bruto))
        const sesBien = c.sesiones.find(s => esBienestar(s.puntaje_bruto))

        const cogData = sesCog ? { correctas: (sesCog.puntaje_bruto as any).correctas || 0, total: (sesCog.puntaje_bruto as any).total || 20, pct: (sesCog.puntaje_bruto as any).porcentaje || 0 } : null

        const blob = await pdf(
          <InformePDF data={{
            candidato: { id: c.id, nombre: c.nombre, apellido: c.apellido, documento: (c as any).documento || '' },
            proceso: { cargo: c.proceso_cargo || 'S/C' },
            sesiones: c.sesiones,
            videos: finalVids,
            inf,
            helpers: {
              hoy: () => new Date().toLocaleDateString(),
              clrOf: (v: number) => v >= 4 ? '#059669' : v >= 3 ? '#2563eb' : v >= 2 ? '#d97706' : '#dc2626',
              hasP, hasC, hasK, hasV, sesBF, sesHX, sesCog, sesComp, sesBien, cogData,
              estimarMBTI: (pb: any) => {
                if (!pb) return 'N/A'
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
                return `${E}${S}${T}${J}`
              },
              MBTI_DESC: {
                'ISTJ': 'Organizado y formal...',
                'ISFJ': 'Comprometido y fiel...',
                'INFJ': 'Analítico e idealista...',
                'INTJ': 'Estratégico e independiente...',
                'ISTP': 'Pragmático y resolutivo...',
                'ISFP': 'Caluroso y adaptativo...',
                'INFP': 'Idealista y empático...',
                'INTP': 'Teórico y lógico...',
                'ESTP': 'Dinámico y pragmático...',
                'ESFP': 'Sociable y entusiasta...',
                'ENFP': 'Creativo y entusiasta...',
                'ENTP': 'Innovador y analítico...',
                'ESTJ': 'Eficiente y directivo...',
                'ESFJ': 'Colaborador y servicial...',
                'ENFJ': 'Líder empático y carismático...',
                'ENTJ': 'Líder estratégico y decidido...'
              },
              ETQ: {
                extraversion: 'Extraversión',
                amabilidad: 'Amabilidad',
                responsabilidad: 'Responsabilidad',
                neuroticismo: 'Neuroticismo',
                apertura: 'Apertura',
                relaciones: 'Relaciones',
                claridad_rol: 'Claridad de Rol',
                burnout: 'Burnout',
                equilibrio: 'Equilibrio'
              },
              DOMINIOS: {
                PERSONALIDAD: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura'],
                COGNITIVO: ['atencion-detalle', 'verbal', 'numerico', 'icar'],
                COMPETENCIAS: ['comunicacion', 'liderazgo', 'trabajo_equipo', 'adaptabilidad', 'resolucion_problemas', 'etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion'],
                BIENESTAR: ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'nivel_estres', 'carga_laboral', 'autonomia', 'expectativas', 'resiliencia', 'manejo_estres', 'autoesteem', 'autoestima']
              }
            }
          }} />
        ).toBlob()

        const filename = `Informe_${c.nombre}_${c.apellido}.pdf`.replace(/\s+/g, '_')
        zip.file(filename, blob)
        pdfsCount++
      }

      if (pdfsCount === 0) {
        alert("Ninguno de los candidatos seleccionados tiene un informe generado aún. Por favor, genéralos primero.");
        return
      }

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `informes_seleccionados_${new Date().toISOString().slice(0, 10)}.zip`)
      setSeleccionados([])
    } catch (err: any) {
      console.error(err)
      alert(`Error de descarga masiva: ${err.message}`)
    } finally {
      setProcesandoZip(false)
    }
  }

  async function analizarFrasesConIA(sesion: any) {
    if (analizandoFrases) return
    setAnalizandoFrases(true)
    try {
      const res = await fetch('/api/analizar-frases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidato: agrupadoSeleccionado,
          proceso: { cargo: agrupadoSeleccionado?.proceso_cargo, nombre: agrupadoSeleccionado?.proceso_nombre },
          respuestas: sesion.puntaje_bruto?.respuestas || sesion.puntaje_bruto
        })
      })
      if (!res.ok) throw new Error('Error al analizar frases')
      const data = await res.json()
      
      const nuevoPuntajeBruto = {
        respuestas: sesion.puntaje_bruto?.respuestas || sesion.puntaje_bruto,
        analisis_ia: data
      }
      
      const { error } = await supabase
        .from('sesiones')
        .update({ puntaje_bruto: nuevoPuntajeBruto })
        .eq('id', sesion.id)
      
      if (error) throw error
      
      setSesionSeleccionada({
        ...sesion,
        puntaje_bruto: nuevoPuntajeBruto
      })
      
      setAgrupadoSeleccionado(prev => {
        if (!prev) return prev
        return {
          ...prev,
          sesiones: prev.sesiones.map(s => s.id === sesion.id ? { ...s, puntaje_bruto: nuevoPuntajeBruto } : s)
        }
      })
      
    } catch (err: any) {
      console.error(err)
      alert("Error al analizar el test: " + err.message)
    } finally {
      setAnalizandoFrases(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    await Promise.all([
      cargarProcesos(),
      cargarCandidatos()
    ])
    setCargando(false)
  }

  async function cargarProcesos() {
    const { data } = await supabase.from('procesos').select('*').order('creado_en', { ascending: false })
    if (data) setProcesos(data)
  }

  async function cargarCandidatos() {
    // 1. Obtener todas las vinculaciones Proceso-Candidato por lotes
    let vinculos: any[] = []
    let offsetVinculos = 0
    const limit = 1000
    let doneVinculos = false

    while (!doneVinculos) {
      const { data, error } = await supabase
        .from('candidatos_procesos')
        .select(`
          candidato_id,
          proceso_id,
          procesos (id, nombre, cargo, competencias_requeridas, bateria_tests),
          candidatos (id, nombre, apellido, email, documento, edad, sexo, formacion, profesion),
          creado_en
        `)
        .range(offsetVinculos, offsetVinculos + limit - 1)

      if (error || !data || data.length === 0) {
        doneVinculos = true
      } else {
        vinculos = [...vinculos, ...data]
        if (data.length < limit) {
          doneVinculos = true
        } else {
          offsetVinculos += limit
        }
      }
    }

    // 2. Obtener todas las sesiones mediante carga recursiva por lotes
    let sesionesData: any[] = []
    let offsetSesiones = 0
    let doneSesiones = false

    while (!doneSesiones) {
      const { data, error } = await supabase
        .from('sesiones')
        .select(`
          id,
          test_id,
          candidato_id,
          proceso_id,
          estado,
          finalizada_en,
          puntaje_bruto,
          candidatos (id, nombre, apellido, email, documento, edad, sexo, formacion, profesion),
          procesos (id, nombre, cargo, competencias_requeridas, bateria_tests)
        `)
        .order('finalizada_en', { ascending: false })
        .range(offsetSesiones, offsetSesiones + limit - 1)

      if (error || !data || data.length === 0) {
        doneSesiones = true
      } else {
        sesionesData = [...sesionesData, ...data]
        if (data.length < limit) {
          doneSesiones = true
        } else {
          offsetSesiones += limit
        }
      }
    }
    
    if (sesionesData) setSesionesGlobales(sesionesData)

    // 3. Obtener respuestas de video
    const { data: respuestasVideo } = await supabase
      .from('respuestas_video')
      .select('candidato_id, entrevista_id, pregunta_id, grabada_en')
      .eq('estado', 'completado')
    // 3.5 Obtener todas las preguntas de video para saber la cantidad de preguntas por entrevista
    const { data: todasPreguntas } = await supabase
      .from('preguntas_video')
      .select('id, entrevista_id, pregunta')

    const preguntasPorEntrevista: Record<string, number> = {}
    todasPreguntas?.forEach(p => {
      preguntasPorEntrevista[p.entrevista_id] = (preguntasPorEntrevista[p.entrevista_id] || 0) + 1
    })

    const grupos: Record<string, CandidatoAgrupado> = {}

    // A. CARGAR ASIGNADOS (Los que están en la tarjeta del proceso)
    vinculos?.forEach((v: any) => {
      const c = v.candidatos
      const p = v.procesos
      if (!c || !p) return

      const key = c.id
      if (!grupos[key]) {
        grupos[key] = {
          id: c.id,
          nombre: c.nombre,
          apellido: c.apellido,
          email: c.email,
          documento: c.documento || '',
          edad: c.edad || '',
          sexo: c.sexo || '',
          formacion: c.formacion || '',
          profesion: c.profesion || '',
          sesiones: [],
          ultima_fecha: v.creado_en || '',
          proceso_id: p.id,
          proceso_nombre: p.nombre,
          proceso_cargo: p.cargo,
          competencias_requeridas: p.competencias_requeridas,
          bateria_tests: p.bateria_tests
        }
      } else {
        // Si ya existe, concatenar nombres de procesos si son distintos
        if (grupos[key].proceso_id !== p.id) {
          grupos[key].proceso_nombre += `, ${p.nombre}`
        }
      }
    })

    // B. CARGAR HISTÓRICOS
    sesionesData?.forEach((s: any) => {
      const c = s.candidatos
      if (!c) return

      const key = c.id

      if (!grupos[key]) {
        grupos[key] = {
          id: c.id,
          nombre: c.nombre,
          apellido: c.apellido,
          email: c.email,
          documento: c.documento || '',
          edad: c.edad || '',
          sexo: c.sexo || '',
          formacion: c.formacion || '',
          profesion: c.profesion || '',
          sesiones: [],
          ultima_fecha: s.finalizada_en || s.creado_en,
          proceso_id: s.proceso_id || undefined,
          proceso_nombre: s.procesos?.nombre || 'Evaluación Independiente',
          proceso_cargo: s.procesos?.cargo || 'Sin cargo asignado',
          competencias_requeridas: s.procesos?.competencias_requeridas,
          bateria_tests: s.procesos?.bateria_tests
        }
      }
      grupos[key].sesiones.push(s)
      const fechaSesion = s.finalizada_en || s.creado_en
      if (fechaSesion && (!grupos[key].ultima_fecha || new Date(fechaSesion) > new Date(grupos[key].ultima_fecha))) {
        grupos[key].ultima_fecha = fechaSesion
      }
    })

    const resultado = Object.values(grupos).map(c => {
      const bateria = c.bateria_tests || []
      const misVideos = respuestasVideo?.filter(rv => rv.candidato_id === c.id) || []
      
      const videosUnicosMap = new Map<string, any>()
      misVideos.forEach(v => {
        const k = `${v.entrevista_id}:${v.pregunta_id}`
        const ex = videosUnicosMap.get(k)
        if (!ex || new Date(v.grabada_en) > new Date(ex.grabada_en)) {
          videosUnicosMap.set(k, v)
        }
      })

      const idsCompletados = new Set<string>()
      c.sesiones.forEach(s => {
        const slug = TEST_IDS[s.test_id] || s.test_id
        if (slug && s.estado === 'finalizado') idsCompletados.add(slug)
      })

      // Contar respuestas válidas por entrevista para este candidato
      const respuestasPorEntrevista: Record<string, number> = {}
      Array.from(videosUnicosMap.values()).forEach(v => {
        respuestasPorEntrevista[v.entrevista_id] = (respuestasPorEntrevista[v.entrevista_id] || 0) + 1
      })

      // Solo marcar la entrevista como completada si el número de respuestas válidas coincide con el total de preguntas de esa entrevista (contemplando bifurcaciones)
      Object.entries(respuestasPorEntrevista).forEach(([entrevistaId, cantRespuestas]) => {
        const preguntasDeEsta = todasPreguntas?.filter(p => p.entrevista_id === entrevistaId) || []
        const comunes = preguntasDeEsta.filter(p => !p.pregunta?.includes('[CON_EXP]') && !p.pregunta?.includes('[SIN_EXP]'))
        const conExp = preguntasDeEsta.filter(p => p.pregunta?.includes('[CON_EXP]'))
        const sinExp = preguntasDeEsta.filter(p => p.pregunta?.includes('[SIN_EXP]'))

        let cantPreguntasRequeridas = preguntasDeEsta.length

        if (conExp.length > 0 || sinExp.length > 0) {
          const respondioConExp = Array.from(videosUnicosMap.values()).some(
            v => v.entrevista_id === entrevistaId && conExp.some(p => p.id === v.pregunta_id)
          )
          const respondioSinExp = Array.from(videosUnicosMap.values()).some(
            v => v.entrevista_id === entrevistaId && sinExp.some(p => p.id === v.pregunta_id)
          )

          if (respondioConExp) {
            cantPreguntasRequeridas = comunes.length + conExp.length
          } else if (respondioSinExp) {
            cantPreguntasRequeridas = comunes.length + sinExp.length
          } else {
            cantPreguntasRequeridas = comunes.length + Math.min(conExp.length, sinExp.length)
          }
        }

        if (cantRespuestas >= cantPreguntasRequeridas && cantPreguntasRequeridas > 0) {
          idsCompletados.add(`entrevista:${entrevistaId}`)
        }
      })

      const totalBateria = bateria.length
      const finalCompletados = totalBateria > 0
        ? bateria.filter(tId => idsCompletados.has(tId)).length
        : idsCompletados.size

      const sesionBigFive = c.sesiones.find(s => TEST_IDS[s.test_id] === 'bigfive')
      const matchScore = calcularMatch(sesionBigFive?.puntaje_bruto, c.competencias_requeridas || [])

      return {
        ...c,
        progreso: {
          completados: finalCompletados,
          total: totalBateria || finalCompletados || 1,
          tests_pendientes: bateria.filter(tId => !idsCompletados.has(tId))
        },
        matchScore
      }
    })

    setCandidatos(resultado)
  }

  function formatearFecha(fecha: string) {
    if (!fecha) return '—'
    const d = new Date(fecha)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function exportarPeopleAnalyticsCSV() {
    if (candidatosFiltrados.length === 0) {
      alert("No hay candidatos disponibles para exportar con los filtros actuales.")
      return
    }

    const headers = [
      "ID Candidato",
      "Nombre",
      "Apellido",
      "Email",
      "Documento",
      "Edad",
      "Sexo",
      "Formacion",
      "Profesion",
      "Proceso",
      "Cargo",
      "Tests Completados",
      "Tests Totales",
      "Progreso %",
      "Match Score %",
      "Alertas Fraude",
      "Estabilidad Emocional (BF)",
      "Amabilidad (BF)",
      "Extraversion (BF)",
      "Responsabilidad (BF)",
      "Apertura (BF)",
      "Efectividad Cognitiva %"
    ]

    const rows = candidatosFiltrados.map(c => {
      // 1. Calcular alertas de fraude acumuladas
      let alertasFraude = 0
      c.sesiones.forEach(s => {
        const m = s.puntaje_bruto?.metricas_fraude as any
        if (m) {
          alertasFraude += (m.tabSwitches || 0) + (m.copyPasteAttempts || 0)
        }
      })

      // 2. Extraer rasgos de Big Five
      const sesionBigFive = c.sesiones.find(s => TEST_IDS[s.test_id] === 'bigfive')
      const bf = (sesionBigFive?.puntaje_bruto || {}) as any
      
      let estabilidadEmocional = "—"
      if (bf.estabilidad_emocional != null) {
        estabilidadEmocional = String(bf.estabilidad_emocional)
      } else if (bf.estabilidad != null) {
        estabilidadEmocional = String(bf.estabilidad)
      } else if (bf.neuroticismo != null) {
        estabilidadEmocional = String(6 - Number(bf.neuroticismo))
      }
      
      const amabilidad = bf.amabilidad != null ? bf.amabilidad : "—"
      const extraversion = bf.extraversion != null ? bf.extraversion : "—"
      const responsabilidad = bf.responsabilidad != null ? bf.responsabilidad : "—"
      const apertura = bf.apertura != null ? bf.apertura : "—"

      // 3. Calcular efectividad cognitiva consolidada
      let correctasCognitivo = 0
      let totalCognitivo = 0

      c.sesiones.forEach(s => {
        const slug = TEST_IDS[s.test_id]
        if (s.estado === 'finalizado' && (slug === 'icar' || slug === 'numerico' || slug === 'verbal' || slug === 'comercial' || slug === 'atencion-detalle')) {
          const correctas = s.puntaje_bruto?.correctas || s.puntaje_bruto?.puntaje || 0
          const total = s.puntaje_bruto?.total || 10
          correctasCognitivo += Number(correctas)
          totalCognitivo += Number(total)
        }
      })

      const efectividadCognitiva = totalCognitivo > 0 
        ? Math.round((correctasCognitivo / totalCognitivo) * 100) 
        : "—"

      const progresoPorcentaje = c.progreso 
        ? Math.round((c.progreso.completados / c.progreso.total) * 100)
        : 0

      return [
        c.id,
        c.nombre || "—",
        c.apellido || "—",
        c.email || "—",
        c.documento || "—",
        c.edad || "—",
        c.sexo || "—",
        c.formacion || "—",
        c.profesion || "—",
        c.proceso_nombre || "—",
        c.proceso_cargo || "—",
        c.progreso?.completados || 0,
        c.progreso?.total || 0,
        `${progresoPorcentaje}%`,
        c.matchScore != null ? `${c.matchScore}%` : "—",
        alertasFraude,
        estabilidadEmocional,
        amabilidad,
        extraversion,
        responsabilidad,
        apertura,
        efectividadCognitiva !== "—" ? `${efectividadCognitiva}%` : "—"
      ]
    })

    // Construir el CSV
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(val => {
        const cleanVal = String(val).replace(/;/g, ",").replace(/\r?\n|\r/g, " ")
        return `"${cleanVal}"`
      }).join(";"))
    ].join("\n")

    // Descarga del archivo con UTF-8 BOM
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `Reporte_People_Analytics_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function abrirRecordatorioOutlook(c: CandidatoAgrupado, link: string, nombreProceso: string) {
    const subject = encodeURIComponent(`Recordatorio: Evaluaciones pendientes para ${nombreProceso}`)
    const body = encodeURIComponent(
      `Hola ${c.nombre},\n\n` +
      `Te contactamos desde el portal de selección para el cargo de ${nombreProceso}.\n\n` +
      `Vemos que todavía tienes ${c.progreso.tests_pendientes.length} evaluaciones pendientes por completar. ` +
      `Para que podamos continuar con tu postulación, es importante que finalices todos los ejercicios.\n\n` +
      `Puedes continuar con tus evaluaciones ingresando al siguiente enlace:\n${link}\n\n` +
      `Quedamos a las órdenes.\n\n` +
      `Saludos,\n` +
      `Equipo de Selección - República Microfinanzas`
    )
    window.location.href = `mailto:${c.email}?subject=${subject}&body=${body}`
  }

  async function enviarRecordatorio(c: CandidatoAgrupado) {
    if (!c.progreso || c.progreso.completados === c.progreso.total) return
    
    setEnviandoRecordatorio(c.id)
    
    const link = c.proceso_id 
      ? `${getBaseUrl()}/evaluacion?candidato=${c.id}&proceso=${c.proceso_id}`
      : `${getBaseUrl()}/evaluacion?candidato=${c.id}`

    const nombreProceso = c.proceso_cargo || c.proceso_nombre || 'Evaluación Psicotécnica Independiente'

    try {
      const res = await fetch('/api/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: c.email,
          nombre: c.nombre,
          proceso: nombreProceso,
          link: link,
          pendientes: c.progreso.tests_pendientes.length
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        alert(`Recordatorio enviado con éxito a ${c.nombre}.`)
      } else {
        console.error('Error enviando recordatorio por servidor:', data.error)
        const confirmarOutlook = confirm(
          `El servidor de correos no pudo enviar el email directo (${data.error || 'Timeout'}).\n\n` +
          `¿Deseas enviar el recordatorio abriendo tu Outlook local ahora mismo?`
        )
        if (confirmarOutlook) {
          abrirRecordatorioOutlook(c, link, nombreProceso)
        }
      }
    } catch (error) {
      console.error(error)
      const confirmarOutlook = confirm(
        `Hubo un error de conexión con el servidor de correo corporativo.\n\n` +
        `¿Deseas abrir tu Outlook local para enviar el recordatorio?`
      )
      if (confirmarOutlook) {
        abrirRecordatorioOutlook(c, link, nombreProceso)
      }
    } finally {
      setEnviandoRecordatorio(null)
    }
  }

  const candidatosFiltrados = candidatos.filter(c => {
    // 1. Filtro estricto por proceso (Regla de Oro)
    if (procesoSeleccionadoId !== 'todos') {
      if (c.proceso_id !== procesoSeleccionadoId) return false
    }

    // 2. Filtro por búsqueda de texto
    const nom = c.nombre || ''
    const ape = c.apellido || ''
    const mail = c.email || ''
    const proc = c.proceso_nombre || ''
    const searchStr = `${nom} ${ape} ${mail} ${proc}`.toLowerCase()
    const query = (filtro || '').toLowerCase()
    return searchStr.includes(query)
  }).sort((a, b) => {
    return obtenerTimestamp(b.ultima_fecha) - obtenerTimestamp(a.ultima_fecha)
  })

  if (cargando) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Centro de Control</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión inteligente de talento y procesos
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'dashboard' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            DASHBOARD
          </button>
          <button
            onClick={() => setTab('evaluaciones')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'evaluaciones' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            ANÁLISIS
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'historial' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" />
            HISTORIAL
          </button>
          <button
            onClick={() => setTab('diagnostico')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'diagnostico' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            DIAGNÓSTICO
          </button>
          <button
            onClick={() => setTab('gestion')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'gestion' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            GESTIÓN PROCESOS
          </button>
        </div>
      </div>

      {tab === 'dashboard' ? (
        <Dashboard />
      ) : tab === 'gestion' ? (
        <GestionProcesos />
      ) : tab === 'diagnostico' ? (
        <DiagnosticoRealtime />
      ) : tab === 'historial' ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bitácora Global</h2>
              <p className="text-xs text-slate-500">Registro cronológico de todas las evaluaciones finalizadas</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar-visible">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Candidato</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proceso</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evaluación</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Puntaje</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {candidatosFiltrados
                  .sort((a, b) => obtenerTimestamp(b.ultima_fecha) - obtenerTimestamp(a.ultima_fecha))
                  .map((c) => {
                  const uniqueTestIds = Array.from(new Set(c.sesiones.map(s => s.test_id)))
                  const testsCompletados = uniqueTestIds.map(tid => TEST_NAMES[tid] || tid)
                  
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatearFecha(c.ultima_fecha)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs font-bold text-slate-800">{c.nombre} {c.apellido}</div>
                        <div className="text-[10px] text-slate-400">{c.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[10px] text-slate-600 truncate max-w-[150px]">{c.proceso_nombre || 'Independiente'}</div>
                        <div className="text-[10px] text-indigo-500 font-bold">{c.proceso_cargo || 'Sin cargo'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {testsCompletados.slice(0, 2).map((t, i) => (
                            <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {t}
                            </span>
                          ))}
                          {testsCompletados.length > 2 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                              +{testsCompletados.length - 2} más
                            </span>
                          )}
                          {testsCompletados.length === 0 && <span className="text-[9px] text-slate-300 italic">Sin tests</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-[10px] font-bold ${c.matchScore && c.matchScore >= 70 ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {c.matchScore ? `${c.matchScore}% Match` : '—'}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {c.progreso?.completados}/{c.progreso?.total} tests
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setAgrupadoSeleccionado(c)
                              setTab('evaluaciones')
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Ir al análisis"
                          >
                            <Search className="w-4 h-4" />
                          </button>
                          <a 
                            href={`/informe?candidato=${c.id}`} 
                            target="_blank"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Ver informe"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sesionesGlobales.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-sm italic">
                No hay registros en la bitácora aún.
              </div>
            )}
          </div>
        </div>
      ) : (
        <>

      {/* BARRA DE HERRAMIENTAS: BUSCADOR + FILTRO POR PROCESO */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-6 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o cargo..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Settings2 className="w-4 h-4 text-slate-400" />
          <select
            value={procesoSeleccionadoId}
            onChange={(e) => {
              setProcesoSeleccionadoId(e.target.value)
              setSeleccionados([]) // Limpiar seleccionados al cambiar filtro
            }}
            className="flex-1 md:w-64 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
          >
            <option value="todos">Todos los procesos</option>
            {procesos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.cargo})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            const todosIds = candidatosFiltrados.map(c => c.id)
            const todosMarcados = todosIds.length === seleccionados.length
            setSeleccionados(todosMarcados ? [] : todosIds)
          }}
          className="px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50/50 hover:bg-slate-50 transition-all shrink-0 w-full md:w-auto"
        >
          {candidatosFiltrados.map(c => c.id).length === seleccionados.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
        </button>

        <button
          onClick={exportarPeopleAnalyticsCSV}
          className="px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50/50 hover:bg-slate-50 transition-all shrink-0 w-full md:w-auto flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 text-indigo-500" />
          Exportar People Analytics
        </button>

        {/* DROPDOWN SELECTOR DE CANDIDATOS */}
        <div className="relative w-full md:w-auto shrink-0">
          <button
            onClick={() => setDropdownAbierto(!dropdownAbierto)}
            className="px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50/50 hover:bg-slate-50 transition-all flex items-center justify-between gap-2 w-full md:w-auto"
          >
            <span>Buscar evaluados ({seleccionados.length})</span>
            <span className="text-[10px] text-slate-400">▼</span>
          </button>

          {dropdownAbierto && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3">
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nombre..."
                  value={busquedaDropdown}
                  onChange={(e) => setBusquedaDropdown(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar-visible pr-1">
                {candidatosFiltrados
                  .filter(c => `${c.nombre} ${c.apellido}`.toLowerCase().includes(busquedaDropdown.toLowerCase()))
                  .map(c => {
                    const isChecked = seleccionados.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-xs font-medium text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSeleccionados(prev => 
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            )
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="truncate">{c.nombre} {c.apellido}</span>
                      </label>
                    )
                  })}
                {candidatosFiltrados.filter(c => `${c.nombre} ${c.apellido}`.toLowerCase().includes(busquedaDropdown.toLowerCase())).length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-400 italic">
                    Sin coincidencias
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {candidatos.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="text-slate-500 mb-4">No hay evaluaciones todavía.</p>
          <a href="/candidatos" className="text-indigo-600 font-medium hover:text-indigo-700">Ir a candidatos →</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-3 h-[calc(100vh-220px)] overflow-y-auto pr-2 custom-scrollbar-visible">
            {candidatosFiltrados.map(c => (
              <div
                key={c.id}
                onClick={async () => {
                  setAgrupadoSeleccionado(c)
                  setSesionSeleccionada(c.sesiones[0])
                  
                  const { data: vids } = await supabase
                    .from('respuestas_video')
                    .select('*')
                    .eq('candidato_id', c.id)
                    .eq('estado', 'completado')
                    .order('grabada_en', { ascending: true })
                  
                  let mappedVids: any[] = []
                  if (vids && vids.length > 0) {
                    const preguntaIds = vids.map(v => v.pregunta_id).filter(Boolean)
                    let preguntas: any[] = []
                    if (preguntaIds.length > 0) {
                      const { data: pData } = await supabase
                        .from('preguntas_video')
                        .select('id, pregunta, orden')
                        .in('id', preguntaIds)
                      if (pData) preguntas = pData
                    }
                    mappedVids = vids.map(v => {
                      const q = preguntas.find(p => p.id === v.pregunta_id)
                      return {
                        ...v,
                        preguntas_video: q ? { pregunta: q.pregunta, orden: q.orden } : null
                      }
                    })
                  }
                  
                  const vMap = new Map<string, any>()
                  mappedVids.forEach(v => {
                    const k = `${v.entrevista_id}:${v.pregunta_id}`
                    const ex = vMap.get(k)
                    if (!ex || new Date(v.grabada_en) > new Date(ex.grabada_en)) {
                      vMap.set(k, v)
                    }
                  })
                  
                  const sortedVids = Array.from(vMap.values()).sort((a, b) => {
                    const ordenA = a.preguntas_video?.orden ?? 0
                    const ordenB = b.preguntas_video?.orden ?? 0
                    return ordenA - ordenB
                  })
                  setVideosCandidato(sortedVids)

                  // Cargar informe psicométrico para entrevista integrada
                  const { data: infData } = await supabase
                    .from('informes_psicometricos')
                    .select('contenido')
                    .eq('candidato_id', c.id)
                    .maybeSingle()
                  
                  setInformeCandidato(infData?.contenido || null)
                }}
                className={`p-4 rounded-xl border bg-white cursor-pointer transition-all duration-200 hover:shadow-md ${
                  agrupadoSeleccionado?.id === c.id 
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex gap-4 items-center w-full overflow-hidden">
                  {/* CHECKBOX DE SELECCION MULTIPLE */}
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(c.id)}
                    onChange={(e) => {
                      e.stopPropagation()
                      setSeleccionados(prev => 
                        prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                      )
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                  />
                  {/* INDICADOR DE ESTADO IZQUIERDO */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      c.progreso && c.progreso.completados === c.progreso.total && c.progreso.total > 0
                        ? 'bg-green-50 border-green-200 text-green-600'
                        : 'bg-slate-50 border-slate-100 text-slate-500'
                    }`}>
                      {c.progreso && c.progreso.completados === c.progreso.total && c.progreso.total > 0 ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        `${c.progreso?.completados || 0}/${c.progreso?.total || 0}`
                      )}
                    </div>
                    {c.matchScore != null && (
                      <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border border-white shadow-sm text-[8px] font-bold text-white ${
                        Number(c.matchScore) >= 80 ? 'bg-emerald-500' : Number(c.matchScore) >= 60 ? 'bg-amber-500' : 'bg-slate-500'
                      }`} title={`Match Score: ${c.matchScore}%`}>
                        {c.matchScore}%
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-bold text-slate-900 leading-tight truncate">{c.nombre} {c.apellido}</div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5 truncate">{c.proceso_nombre || 'Proceso independiente'}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 truncate">{c.email || 'Sin email'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      {c.progreso && c.progreso.completados < c.progreso.total && (
                        <button
                          onClick={(e) => { e.stopPropagation(); enviarRecordatorio(c); }}
                          disabled={enviandoRecordatorio === c.id}
                          className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-all border border-amber-100"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <a href={`/informe?candidato=${c.id}`} target="_blank" onClick={(e) => e.stopPropagation()} className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg border border-indigo-100">
                        <FileText className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* DETALLE DEL CANDIDATO SELECCIONADO CON SCROLL INDEPENDIENTE */}
          <div className="sticky top-0 h-[calc(100vh-220px)] flex flex-col">
            <style jsx>{`
              .custom-scrollbar-visible::-webkit-scrollbar { width: 6px; }
              .custom-scrollbar-visible::-webkit-scrollbar-track { background: #f1f5f9; }
              .custom-scrollbar-visible::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
            {agrupadoSeleccionado ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col h-full overflow-hidden border-indigo-100">
                {/* CABEZAL FIJO */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-white z-20 shrink-0">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{agrupadoSeleccionado.nombre} {agrupadoSeleccionado.apellido}</h2>
                    <p className="text-sm text-slate-500">{agrupadoSeleccionado.email}</p>
                  </div>
                  <button onClick={() => { setAgrupadoSeleccionado(null); setInformeCandidato(null); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* CONTENIDO DESPLAZABLE */}
                <div className="flex-1 overflow-y-scroll p-6 custom-scrollbar-visible">
                  {/* RESUMEN EJECUTIVO IA */}
                  <div className="mb-8 p-5 bg-gradient-to-br from-indigo-50/50 to-white rounded-2xl border border-indigo-100 shadow-sm relative">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                        <h3 className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Resumen Ejecutivo IA</h3>
                      </div>
                      <button
                        onClick={async () => {
                          const res = await generarResumenIA(agrupadoSeleccionado)
                          setAgrupadoSeleccionado({ ...agrupadoSeleccionado, resumen_ia: res })
                        }}
                        className="text-[9px] font-bold bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700 transition-all"
                      >
                        {agrupadoSeleccionado.resumen_ia ? 'Regenerar' : 'Generar Informe'}
                      </button>
                    </div>
                    {agrupadoSeleccionado.resumen_ia ? (
                      <div className="text-xs text-slate-600 leading-relaxed space-y-2">{agrupadoSeleccionado.resumen_ia}</div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Analiza todos los tests y videos para generar un resumen profesional.</p>
                    )}
                  </div>

                  {/* ANÁLISIS DE ENTREVISTA INTEGRADA (SI EXISTE) */}
                  {informeCandidato?.analisisEntrevista && (
                    <div className="mb-8 p-5 bg-gradient-to-br from-teal-50/40 to-white rounded-2xl border border-teal-100/70 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-pulse" />
                        <h3 className="text-[10px] font-bold text-teal-900 uppercase tracking-widest">Entrevista Conductual Integrada</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-bold text-teal-700 uppercase tracking-wide">1. Trayectoria y Motivación</p>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{informeCandidato.analisisEntrevista.trayectoriaMotivacion}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-teal-700 uppercase tracking-wide">2. Estilo de Trabajo y Autoridad</p>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{informeCandidato.analisisEntrevista.estiloTrabajoAutoridad}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-teal-700 uppercase tracking-wide">3. Gestión de Conflictos</p>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{informeCandidato.analisisEntrevista.gestionConflictos}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-teal-700 uppercase tracking-wide">4. Resiliencia y Afrontamiento</p>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{informeCandidato.analisisEntrevista.resilienciaFrustracion}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-teal-700 uppercase tracking-wide">5. Autoconcepto y Metas</p>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{informeCandidato.analisisEntrevista.autoconceptoMetas}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Historial de Evaluaciones (Test por Test)</p>
                    <div className="flex flex-wrap gap-2">
                      {agrupadoSeleccionado.sesiones
                        .sort((a, b) => new Date(b.finalizada_en || 0).getTime() - new Date(a.finalizada_en || 0).getTime())
                        .map((s, idx) => {
                          const pb = s.puntaje_bruto
                          let label = (s as any).test_id ? TEST_NAMES[(s as any).test_id] : null
                          if (!label) {
                            if (esBigFive(pb)) label = 'Psicográfico'
                            else if (esCognitivo(pb)) label = 'Cognitivo'
                            else label = 'Evaluación'
                          }
                          const isActive = sesionSeleccionada?.id === s.id
                          const fecha = s.finalizada_en ? new Date(s.finalizada_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'S/F'
                          
                          return (
                            <button 
                              key={s.id} 
                              onClick={() => setSesionSeleccionada(s)} 
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border flex flex-col items-start gap-0.5 ${
                                isActive 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span className="truncate max-w-[120px]">{label}</span>
                              <span className={`text-[9px] ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>{fecha}</span>
                            </button>
                          )
                        })}
                    </div>
                  </div>

                  {/* VIDEO ENTREVISTAS */}
                  {videosCandidato.length > 0 && (
                    <div className="mb-8">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Video className="w-3 h-3" /> Video Entrevistas
                      </p>
                      <div className="space-y-4">
                        {videosCandidato.map((v, i) => (
                          <div key={i} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                              <h5 className="text-sm font-bold text-slate-800">Pregunta {i + 1}: {v.preguntas_video?.pregunta}</h5>
                              
                              {/* SELECTOR DE VELOCIDAD DE REPRODUCCIÓN */}
                              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shrink-0 self-start sm:self-auto shadow-sm">
                                <span className="text-[9px] font-bold text-slate-400 px-1.5 uppercase">Velocidad</span>
                                {[1, 1.25, 1.5, 2].map((vel) => {
                                  const selectVel = velocidadesVideo[i] || 1
                                  const esActivo = selectVel === vel
                                  return (
                                    <button
                                      key={vel}
                                      onClick={() => {
                                        const videoEl = document.getElementById(`video-entrevista-${i}`) as HTMLVideoElement
                                        if (videoEl) {
                                          videoEl.playbackRate = vel
                                          setVelocidadesVideo(prev => ({ ...prev, [i]: vel }))
                                        }
                                      }}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                                        esActivo 
                                          ? 'bg-indigo-600 text-white shadow-sm scale-105' 
                                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                      }`}
                                    >
                                      {vel}x
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                            <video id={`video-entrevista-${i}`} src={v.url_video} controls className="w-full aspect-video rounded-xl shadow-sm bg-black mb-3" />
                            {v.transcripcion && <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 italic">"{v.transcripcion}"</div>}
                            {v.analisis_ia && (
                               <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                 <div className="flex items-center gap-2 mb-2">
                                   <Sparkles className="w-3 h-3 text-indigo-600" />
                                   <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest">Análisis de Actitud e IA</span>
                                 </div>
                                 <p className="text-[11px] text-slate-600 leading-relaxed">
                                   {obtenerTextoAnalisis(v.analisis_ia)}
                                 </p>
                               </div>
                             )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RESULTADOS DETALLADOS DEL TEST */}
                  {sesionSeleccionada && (
                    <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in duration-500">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Resultados del Test</h4>
                        <a href={`/informe?candidato=${agrupadoSeleccionado.id}`} target="_blank" className="text-[10px] font-bold text-indigo-600 hover:underline">Ver Informe Completo →</a>
                      </div>

                      {sesionSeleccionada.puntaje_bruto && (() => {
                        const pb = sesionSeleccionada.puntaje_bruto as any
                        const metricas = pb.metricas_fraude
                        if (sesionSeleccionada.test_id === 'f7a8b9c0-d1e2-4356-abcd-888888888888') {
                          return renderFrasesIncompletas(sesionSeleccionada, analizarFrasesConIA)
                        }
                        return (
                          <div className="space-y-6">
                            {/* MÉTRICAS DE FRAUDE */}
                            {metricas && (
                              <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">Fugas de Foco</p>
                                  <p className="text-lg font-bold text-slate-800">{metricas.tabSwitches || 0}</p>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">Copia/Pega</p>
                                  <p className="text-lg font-bold text-slate-800">{metricas.copyPasteAttempts || 0}</p>
                                </div>
                              </div>
                            )}

                            {/* GRÁFICOS Y RESULTADOS ESPECÍFICOS */}
                            {esBigFive(pb) ? valoresNumericos(pb).map(([factor, valor]) => (
                              <div key={factor} className="space-y-1.5 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-700">{formatearNombreFactor(factor)}</span>
                                  <span className="text-xs font-black text-indigo-600">{valor} / 5</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${colores[factor] || 'bg-indigo-500'} transition-all duration-700`} style={{ width: `${(valor / 5) * 100}%` }} />
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                  {interpretacion(factor, valor)}
                                </p>
                              </div>
                            )) : esSJT(pb) ? Object.entries((pb as any).por_factor || {}).map(([factor, info]: any) => {
                              const valor = Math.round(((info.correctas / info.total) * 5) * 10) / 10
                              return (
                                <div key={factor} className="mb-4 last:mb-0">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="font-semibold text-slate-700">{formatearNombreFactor(factor)}</span>
                                    <span className="text-slate-500">{valor} / 5</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-1">
                                    <div 
                                      className="h-full bg-amber-500 rounded-full" 
                                      style={{ width: `${(valor / 5) * 100}%` }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-slate-500 leading-relaxed">
                                    {interpretacion(factor, valor)}
                                  </p>
                                </div>
                              )
                            }) : esCognitivo(pb) ? (() => {
                              const { correctas, total, pct } = datosCognitivos(pb)
                              const nivel = pct >= 80 ? 'Superior' : pct >= 60 ? 'Promedio' : 'Bajo'
                              const colorBg = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                              const colorText = pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'
                              
                              return (
                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-slate-700">Efectividad Cognitiva</span>
                                    <span className={`text-xs font-black ${colorText}`}>{correctas} / {total} ({pct}%)</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-3">
                                    <div className={`h-full ${colorBg} transition-all duration-1000`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${colorBg}`} />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nivel {nivel}</span>
                                  </div>
                                </div>
                              )
                            })() : (() => {
                              const prom = promedioPuntaje(pb)
                              const colorBg = prom >= 4 ? 'bg-indigo-500' : prom >= 3 ? 'bg-indigo-400' : 'bg-indigo-300'
                              
                              return (
                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-slate-700">Puntaje General</span>
                                    <span className="text-xs font-black text-indigo-600">{prom} / 5</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                                    <div className={`h-full ${colorBg} transition-all duration-1000`} style={{ width: `${(prom / 5) * 100}%` }} />
                                  </div>
                                  <p className="text-[10px] text-slate-400 italic">Desglose de competencia situacional</p>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      })()}

                      <button onClick={() => generarPDF(sesionSeleccionada)} className="w-full mt-8 flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all">
                        <Download className="w-4 h-4" /> Descargar PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full">
                <Search className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">Selecciona un candidato para analizar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BARRA DE ACCIONES MASIVAS FLOTANTE */}
      {seleccionados.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-bounce-short">
          <div className="flex items-center gap-3 border-r border-slate-800 pr-6">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-[10px] font-black flex items-center justify-center">
              {seleccionados.length}
            </div>
            <span className="text-xs font-bold text-slate-300">perfiles seleccionados</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => analizarSeleccionadosLote()}
              disabled={procesandoLote}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              {procesandoLote ? 'Analizando...' : '✦ Analizar en Lote'}
            </button>
            
            <button
              onClick={() => descargarSeleccionadosZip()}
              disabled={procesandoZip}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-1.5"
            >
              {procesandoZip ? 'Generando ZIP...' : '📥 Descargar PDFs (.zip)'}
            </button>
            
            <button
              onClick={() => setSeleccionados([])}
              className="px-3 py-2 hover:bg-slate-800 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )}
    </AppLayout>
  )
}

async function generarPDF(sesion: Sesion) {
  const nombre = sesion.candidato
    ? `${sesion.candidato.nombre} ${sesion.candidato.apellido}`
    : 'Evaluación anónima'
  const fecha = new Date(sesion.finalizada_en).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  const coloresRGB: Record<string, [number, number, number]> = {
    extraversion: [37, 99, 235],
    amabilidad: [22, 163, 74],
    responsabilidad: [147, 51, 234],
    neuroticismo: [220, 38, 38],
    apertura: [234, 88, 12]
  }

  const etiquetasPDF: Record<string, string> = {
    extraversion: 'Extraversión',
    amabilidad: 'Amabilidad',
    responsabilidad: 'Responsabilidad',
    neuroticismo: 'Neuroticismo',
    apertura: 'Apertura'
  }

  const pdfData = {
    sesion, nombre, fecha,
    helpers: {
      esBigFive, esCognitivo, esSJT, valoresNumericos, promedioPuntaje, datosCognitivos,
      coloresRGB, etiquetasPDF: etiquetas, interpretacion
    }
  }

  try {
    const { pdf } = await import('@react-pdf/renderer')
    const { SimplePDF } = await import('@/components/SimplePDF')

    const blob = await pdf(<SimplePDF data={pdfData} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe-${nombre.replace(/ /g, '-').toLowerCase()}-${fecha.replace(/\//g, '-')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error generando PDF:', err)
    alert('Hubo un error al generar el PDF simple.')
  }
}

function interpretacion(factor: string, valor: number): string {
  const nivel = valor >= 4 ? 'alto' : valor >= 3 ? 'moderado' : 'bajo'
  const textos: Record<string, Record<string, string>> = {
    extraversion: {
      alto: 'Persona sociable, enérgica y orientada hacia el mundo externo. Disfruta del trabajo en equipo y los entornos dinámicos.',
      moderado: 'Equilibrio entre sociabilidad y reserva. Se adapta tanto a trabajos en equipo como a tareas individuales.',
      bajo: 'Persona reservada y reflexiva. Prefiere entornos tranquilos y el trabajo independiente.'
    },
    amabilidad: {
      alto: 'Alta orientación hacia los demás, cooperativa y empática. Facilita el trabajo en equipo y las relaciones interpersonales.',
      moderado: 'Equilibrio entre cooperación y asertividad. Puede trabajar bien con otros sin perder independencia de criterio.',
      bajo: 'Persona directa y orientada a resultados. Puede ser más competitiva que colaborativa.'
    },
    responsabilidad: {
      alto: 'Alta organización, disciplina y orientación al logro. Cumple compromisos y mantiene altos estándares de trabajo.',
      moderado: 'Nivel adecuado de organización y compromiso. Puede adaptarse a distintos niveles de estructura.',
      bajo: 'Estilo flexible y espontáneo. Puede tener dificultades con tareas que requieren alta planificación.'
    },
    neuroticismo: {
      alto: 'Mayor sensibilidad emocional y tendencia a experimentar estrés. Puede requerir entornos de trabajo estables.',
      moderado: 'Respuesta emocional equilibrada ante el estrés. Maneja bien la mayoría de las situaciones laborales.',
      bajo: 'Alta estabilidad emocional y resiliencia. Maneja bien la presión y los entornos de alta demanda.'
    },
    apertura: {
      alto: 'Alta curiosidad intelectual, creatividad y apertura al cambio. Destaca en roles que requieren innovación.',
      moderado: 'Equilibrio entre creatividad y pragmatismo. Se adapta tanto a entornos estructurados como creativos.',
      bajo: 'Preferencia por métodos conocidos y entornos predecibles. Destaca en roles con procesos claros y definidos.'
    },
    // SJT Análisis
    analisis: {
      alto: 'Excelente capacidad para desglosar situaciones complejas en componentes manejables, identificando la raíz del problema de forma lógica.',
      moderado: 'Capacidad adecuada para analizar problemas estándar. Puede requerir apoyo en escenarios de ambigüedad extrema.',
      bajo: 'Tiende a ver los problemas de forma superficial. Puede tener dificultades para identificar causas raíz en procesos complejos.'
    },
    priorizacion: {
      alto: 'Gran habilidad para jerarquizar urgencias y recursos, optimizando el tiempo de respuesta ante múltiples demandas simultáneas.',
      moderado: 'Organiza sus tareas de forma efectiva en condiciones normales. Bajo presión extrema, la jerarquización puede verse afectada.',
      bajo: 'Dificultad para discernir entre lo urgente y lo importante. Puede dispersar energía en tareas de bajo impacto.'
    },
    inferencia: {
      alto: 'Destaca en conectar puntos de información aparentemente aislados para anticipar consecuencias y escenarios futuros con precisión.',
      moderado: 'Capacidad lógica estándar. Realiza deducciones correctas basadas en hechos evidentes.',
      bajo: 'Le cuesta anticipar consecuencias a largo plazo. Prefiere trabajar con información explícita y directa.'
    },
    creatividad: {
      alto: 'Alta disposición para proponer soluciones fuera de los marcos convencionales, buscando la eficiencia a través de la innovación disruptiva.',
      moderado: 'Propone mejoras incrementales sobre procesos conocidos. Mantiene un equilibrio entre lo nuevo y lo probado.',
      bajo: 'Estilo de resolución conservador. Prefiere seguir protocolos establecidos y métodos tradicionales.'
    },
    // SJT Atención
    empatia: {
      alto: 'Capacidad genuina de sintonizar con la necesidad del cliente, validando su emoción antes de proceder a la solución técnica.',
      moderado: 'Mantiene un trato cordial y profesional. Logra entender la necesidad del cliente sin involucramiento emocional profundo.',
      bajo: 'Trato funcional y distante. Puede ser percibido como poco sensible ante la frustración o el problema del usuario.'
    },
    comunicacion: {
      alto: 'Habilidad superior para transmitir información de forma clara y amable, manteniendo la calma incluso en situaciones de alta demanda.',
      moderado: 'Comunicación clara en situaciones habituales. Puede perder fluidez en interacciones de alta tensión.',
      bajo: 'Comunicación limitada o excesivamente técnica. Puede generar malentendidos por falta de claridad o tono inadecuado.'
    },
    escucha_activa: {
      alto: 'Procesamiento profundo del mensaje del usuario, asegurando que se entiende el problema real antes de intervenir o sugerir.',
      moderado: 'Escucha lo suficiente para dar una respuesta estándar. Puede omitir detalles sutiles en conversaciones largas.',
      bajo: 'Tiende a interrumpir o a presuponer la solución antes de que el cliente termine de exponer su caso.'
    },
    resolucion: {
      alto: 'Orientación pragmática a dar respuesta efectiva y oportuna, cerrando el ciclo de la consulta con un alto estándar de satisfacción.',
      moderado: 'Logra resolver la mayoría de los casos dentro de los tiempos esperados. Puede demorar ante excepciones.',
      bajo: 'Falta de agilidad en la resolución. Tiende a derivar problemas simples o a quedar atrapado en la burocracia del proceso.'
    },
    manejo_conflicto: {
      alto: 'Gran temple para navegar interacciones difíciles, transformando una queja o reclamo en una oportunidad de fidelización estratégica.',
      moderado: 'Maneja situaciones tensas con profesionalismo. Evita el conflicto directo pero puede ceder ante presión excesiva.',
      bajo: 'Dificultad para manejar críticas o enojos. Puede reaccionar de forma defensiva o evitar la interacción conflictiva.'
    },
    etica: {
      alto: 'Adherencia inquebrantable a los protocolos y valores de la organización, asegurando un trato justo y transparente para todos.',
      moderado: 'Sigue las normas generales de la empresa. Puede flexibilizar criterios menores si la situación lo amerita.',
      bajo: 'Riesgo de omitir protocolos en favor de la rapidez o la comodidad personal. Falta de consistencia ética.'
    },
    // SJT Comercial
    negociacion: {
      alto: 'Habilidad táctica superior para encontrar el equilibrio entre los intereses del cliente y los objetivos de rentabilidad corporativa.',
      moderado: 'Capacidad de persuasión básica. Logra acuerdos en condiciones de mercado estándar.',
      bajo: 'Dificultad para defender márgenes o condiciones. Tiende a ceder rápidamente o a perder cierres por falta de firmeza.'
    },
    etica_comercial: {
      alto: 'Compromiso total con la honestidad en la venta, priorizando la relación a largo plazo y la confianza sobre el beneficio inmediato.',
      moderado: 'Venta transparente bajo los estándares del sector. Evita malas prácticas evidentes.',
      bajo: 'Prioriza el cierre a toda costa. Riesgo de omitir información relevante o de sobrevender capacidades reales.'
    },
    organizacion: {
      alto: 'Disciplina excepcional en la gestión de cartera y seguimiento de prospectos, asegurando que ninguna oportunidad quede al azar.',
      moderado: 'Mantiene un orden básico de sus contactos y agenda. Puede mejorar en la sistematicidad del seguimiento.',
      bajo: 'Gestión comercial desorganizada. Pérdida de oportunidades por falta de seguimiento o mala planificación de rutas.'
    },
    trabajo_equipo: {
      alto: 'Colaboración proactiva con otras áreas para potenciar la oferta comercial y asegurar que la promesa de venta sea cumplida.',
      moderado: 'Participa en reuniones de equipo y colabora cuando se le solicita explícitamente.',
      bajo: 'Estilo de trabajo individualista. Puede generar fricciones con áreas operativas por falta de comunicación.'
    },
    // Atención al Detalle
    documentos: {
      alto: 'Excelente velocidad y precisión en el cotejo de datos complejos y verificación documental, asegurando cero fallos de información.',
      moderado: 'Capacidad de verificación estándar. Realiza comprobaciones eficientes en condiciones habituales.',
      bajo: 'Velocidad de verificación reducida o propensión a pasar por alto discrepancias sutiles en la documentación.'
    },
    comparacion: {
      alto: 'Alta agudeza visual para contrastar múltiples fuentes de datos de forma paralela sin cometer errores de transcripción.',
      moderado: 'Compara información de manera satisfactoria, con un ritmo de trabajo estable.',
      bajo: 'Dificultad para detectar inconsistencias menores al cruzar bases de datos o listados extensos.'
    },
    concentracion: {
      alto: 'Gran resistencia a la fatiga cognitiva, manteniendo un nivel de foco constante durante tareas repetitivas y prolongadas.',
      moderado: 'Mantiene un nivel de concentración adecuado durante la jornada laboral estándar.',
      bajo: 'Nivel de dispersión elevado ante tareas rutinarias o estímulos distractores en el ambiente.'
    },
    errores_texto: {
      alto: 'Excepcional capacidad para identificar fallas tipográficas, ortográficas o de redacción en documentos críticos.',
      moderado: 'Identifica los errores ortográficos o gramaticales más evidentes en textos estándares.',
      bajo: 'Tiende a pasar por alto errores de escritura o inconsistencias textuales.'
    },
    errores_numeros: {
      alto: 'Alta precisión y velocidad mental para identificar discrepancias en cifras, códigos o montos financieros.',
      moderado: 'Detecta errores numéricos evidentes. Puede requerir más tiempo para revisar planillas complejas.',
      bajo: 'Propensión a pasar por alto errores de codificación o valores numéricos incorrectos.'
    },
    // Tolerancia a la Frustración y Emocional
    manejo_emocional: {
      alto: 'Excelente autocontrol de sus propias emociones en momentos críticos, permitiendo respuestas racionales y empáticas.',
      moderado: 'Mantiene una estabilidad emocional adecuada frente a las demandas habituales de los clientes.',
      bajo: 'Dificultad para canalizar la frustración, pudiendo verse afectado su desempeño ante interacciones difíciles.'
    },
    tolerancia_frustracion: {
      alto: 'Gran capacidad para sobreponerse rápidamente a rechazos o metas no alcanzadas, manteniendo la motivación intacta.',
      moderado: 'Maneja la frustración de forma estándar. Requiere períodos de recuperación tras experiencias muy negativas.',
      bajo: 'Se desmotiva con facilidad ante obstáculos o negativas reiteradas por parte de los clientes.'
    }
  }
  return textos[factor]?.[nivel] || ''
}

function renderFrasesIncompletas(sesion: any, analizarFrasesConIA: any) {
  const pb = sesion.puntaje_bruto || {}
  const respuestas = pb.respuestas || pb
  const analisis = pb.analisis_ia

  const FRASES_ESTIMULO: Record<number, string> = {
    1: 'Siempre me gustó',
    2: 'Cuando me enfrento a varias opciones',
    3: 'Lo más importante en la vida es',
    4: 'Siempre me preocupó',
    5: 'Creo que soy hábil para',
    6: 'Lo más difícil para mí es',
    7: 'Controlarme es muy difícil para mí cuando',
    8: 'Cuando las cosas no se dan como yo esperaba',
    9: 'En un grupo yo',
    10: 'En el futuro me veo',
    11: 'Nunca imaginé que yo',
    12: 'Me fastidia',
    13: 'No sé explicar por qué todos dicen',
    14: 'No estoy de acuerdo',
    15: 'Me aburre',
    16: 'El mayor cambio de mi vida',
    17: 'Cuando me enfrento a un cambio',
    18: 'Este cargo significa para mí',
    19: 'Mis jefes',
    20: 'Me gusta trabajar con',
    21: 'Mi mayor desafío ha sido',
    22: 'En síntesis, yo'
  }

  const errorDetalles = analisis?.auditoriaOrtografica?.detalles || []

  return (
    <div className="space-y-6 font-sans">
      
      {/* LISTADO DE RESPUESTAS CUALITATIVAS */}
      <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 space-y-4">
        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Frases Completadas por el Candidato</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
          {Object.entries(FRASES_ESTIMULO).map(([idStr, estimulo]) => {
            const id = Number(idStr)
            const resp = respuestas[id] || ''
            return (
              <div key={id} className="p-3 bg-white border border-slate-100 rounded-xl">
                <p className="text-[10px] text-slate-400 font-bold">Frase {id}</p>
                <p className="text-xs text-slate-800 leading-relaxed mt-1">
                  <span className="font-bold text-indigo-700">{estimulo}...</span> {resp || <span className="text-rose-400 italic">No completada</span>}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ACCIÓN DE ANÁLISIS POR IA */}
      {!analisis ? (
        <div className="text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-xs text-slate-500 mb-4">La IA de Gemini puede realizar un análisis psicométrico y ortográfico profundo de este test.</p>
          <button
            onClick={() => analizarFrasesConIA(sesion)}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
          >
            ✦ Analizar con IA
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* AUDITORÍA ORTOGRÁFICA */}
          <div className={`p-5 rounded-2xl border ${analisis.auditoriaOrtografica?.tieneErrores ? 'bg-rose-50/30 border-rose-100' : 'bg-emerald-50/30 border-emerald-100'}`}>
            <h5 className={`text-xs font-bold uppercase tracking-wider mb-3 ${analisis.auditoriaOrtografica?.tieneErrores ? 'text-rose-700' : 'text-emerald-700'}`}>
              Auditoría Ortográfica
            </h5>
            {analisis.auditoriaOrtografica?.tieneErrores ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">Se identificaron <strong>{analisis.auditoriaOrtografica.conteoErrores}</strong> errores ortográficos o de sintaxis:</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-rose-100 text-left text-xs">
                    <thead>
                      <tr className="text-rose-800 font-bold">
                        <th className="py-2 pr-3">Frase</th>
                        <th className="py-2 px-3">Escrito</th>
                        <th className="py-2 px-3">Corrección</th>
                        <th className="py-2 pl-3">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50 text-slate-600">
                      {errorDetalles.map((det: any, i: number) => (
                        <tr key={i}>
                          <td className="py-2 pr-3 font-semibold">Frase {det.frase}</td>
                          <td className="py-2 px-3 line-through text-rose-500">{det.original}</td>
                          <td className="py-2 px-3 font-semibold text-emerald-600">{det.corregida}</td>
                          <td className="py-2 pl-3"><span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold">{det.tipo}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs text-emerald-600">✓ No se encontraron errores ortográficos ni de sintaxis en las respuestas del candidato. Redacción óptima.</p>
            )}
          </div>

          {/* ANÁLISIS PSICOMÉTRICO */}
          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Análisis de Proyección Psicométrica</h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Dinámica Intelectual y Laboral</p>
                <p className="text-xs text-slate-600 leading-relaxed">{analisis.analisisClinico?.dinamicaLaboral}</p>
              </div>
              <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Actitud Interpersonal y Autoridad</p>
                <p className="text-xs text-slate-600 leading-relaxed">{analisis.analisisClinico?.interpersonal}</p>
              </div>
              <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Manejo Emocional y Resiliencia</p>
                <p className="text-xs text-slate-600 leading-relaxed">{analisis.analisisClinico?.emocional}</p>
              </div>
              <div className="bg-white p-4 border border-slate-100 rounded-xl shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Autoconcepto y Valores</p>
                <p className="text-xs text-slate-600 leading-relaxed">{analisis.analisisClinico?.autoconcepto}</p>
              </div>
            </div>
          </div>

          {/* CONCLUSIÓN EJECUTIVA */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Conclusiones del Evaluador</h5>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider ${
                analisis.conclusion?.veredicto?.includes('RESERVAS') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                analisis.conclusion?.veredicto?.includes('NO') ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {analisis.conclusion?.veredicto}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">🟢 Fortalezas Claras</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {analisis.conclusion?.fortalezas?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-amber-400 flex items-center gap-1.5">🟡 Áreas de Atención</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  {analisis.conclusion?.areasAtencion?.map((a: string, i: number) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            </div>

            {analisis.conclusion?.recomendacionGestion && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mt-2">
                <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Guía de Gestión de Liderazgo</p>
                <p className="text-xs text-slate-300 leading-relaxed">{analisis.conclusion.recomendacionGestion}</p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  )
}