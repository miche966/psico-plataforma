'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { FileText, Download, X, Search, AlertTriangle, BellRing, Clock, History, Video, CheckCircle2, Settings2, BarChart2, LayoutDashboard, Sparkles } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'
import GestionProcesos from '@/components/GestionProcesos'
import Dashboard from '@/components/Dashboard'
import AppLayout from '@/components/AppLayout'


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
  apertura: 'Apertura'
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
  '7a8b9c0d-e1f2-4356-abcd-999999999999': 'DASS-21 (Salud Mental)',
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



export default function PanelEvaluador() {
  const [tab, setTab] = useState<'evaluaciones' | 'gestion' | 'dashboard' | 'historial'>('evaluaciones')
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
  const router = useRouter()

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
    // 1. Obtener todas las vinculaciones Proceso-Candidato
    const { data: vinculos } = await supabase
      .from('candidatos_procesos')
      .select(`
        candidato_id,
        proceso_id,
        procesos (id, nombre, cargo, competencias_requeridas, bateria_tests),
        candidatos (id, nombre, apellido, email),
        creado_en
      `)

    // 2. Obtener todas las sesiones (Históricas y actuales)
    const { data: sesionesData } = await supabase
      .from('sesiones')
      .select(`
        *,
        candidatos (id, nombre, apellido, email),
        procesos (id, nombre, cargo, competencias_requeridas, bateria_tests)
      `)
      .order('finalizada_en', { ascending: false })
    
    if (sesionesData) setSesionesGlobales(sesionesData)

    // 3. Obtener respuestas de video
    const { data: respuestasVideo } = await supabase
      .from('respuestas_video')
      .select('candidato_id, entrevista_id, pregunta_id, grabada_en')

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
        if (slug) idsCompletados.add(slug)
      })
      Array.from(videosUnicosMap.values()).forEach(v => idsCompletados.add(`entrevista:${v.entrevista_id}`))

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

  async function enviarRecordatorio(c: CandidatoAgrupado) {
    if (!c.progreso || c.progreso.completados === c.progreso.total) return
    if (!c.proceso_id) return
    
    setEnviandoRecordatorio(c.id)
    
    const link = `${getBaseUrl()}/evaluacion?candidato=${c.id}&proceso=${c.proceso_id}`

    try {
      const res = await fetch('/api/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: c.email,
          nombre: c.nombre,
          proceso: c.proceso_cargo || c.proceso_nombre,
          link: link,
          pendientes: c.progreso.tests_pendientes.length
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        alert(`Recordatorio enviado con éxito a ${c.nombre}.`)
      } else {
        alert('Hubo un error al enviar el correo. Verifica tu configuración de Resend.')
        console.error('Error enviando recordatorio:', data.error)
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexión al intentar enviar el recordatorio.')
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
    const searchStr = `${c.nombre} ${c.apellido} ${c.email} ${c.proceso_nombre}`.toLowerCase()
    return searchStr.includes(filtro.toLowerCase())
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
                  .sort((a, b) => new Date(b.ultima_fecha).getTime() - new Date(a.ultima_fecha).getTime())
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
            onChange={(e) => setProcesoSeleccionadoId(e.target.value)}
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
                    .select('*, preguntas_video(pregunta)')
                    .eq('candidato_id', c.id)
                    .order('grabada_en', { ascending: true })
                  
                  const vMap = new Map<string, any>()
                  vids?.forEach(v => {
                    const k = `${v.entrevista_id}:${v.pregunta_id}`
                    const ex = vMap.get(k)
                    if (!ex || new Date(v.grabada_en) > new Date(ex.grabada_en)) {
                      vMap.set(k, v)
                    }
                  })
                  
                  setVideosCandidato(Array.from(vMap.values()))
                }}
                className={`p-4 rounded-xl border bg-white cursor-pointer transition-all duration-200 hover:shadow-md ${
                  agrupadoSeleccionado?.id === c.id 
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex gap-4 items-center w-full overflow-hidden">
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
                  <button onClick={() => setAgrupadoSeleccionado(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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
                            <h5 className="text-sm font-bold text-slate-800 mb-3">Pregunta {i + 1}: {v.preguntas_video?.pregunta}</h5>
                            <video src={v.url_video} controls className="w-full aspect-video rounded-xl shadow-sm bg-black mb-3" />
                            {v.transcripcion && <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 italic">"{v.transcripcion}"</div>}
                            {v.analisis_ia && (
                               <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                 <div className="flex items-center gap-2 mb-2">
                                   <Sparkles className="w-3 h-3 text-indigo-600" />
                                   <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest">Análisis de Actitud e IA</span>
                                 </div>
                                 <p className="text-[11px] text-slate-600 leading-relaxed">
                                   {typeof v.analisis_ia === 'string' ? v.analisis_ia : (v.analisis_ia.actitud || v.analisis_ia.resumen || v.analisis_ia.analisis)}
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
                                  <span className="text-xs font-bold text-slate-700">{etiquetas[factor] || factor}</span>
                                  <span className="text-xs font-black text-indigo-600">{valor} / 5</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${colores[factor] || 'bg-indigo-500'} transition-all duration-700`} style={{ width: `${(valor / 5) * 100}%` }} />
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                  {interpretacion(factor, valor)}
                                </p>
                              </div>
                            )) : esCognitivo(pb) ? (() => {
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
      esBigFive, esCognitivo, valoresNumericos, promedioPuntaje, datosCognitivos,
      coloresRGB, etiquetasPDF, interpretacion
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
    }
  }
  return textos[factor]?.[nivel] || ''
}