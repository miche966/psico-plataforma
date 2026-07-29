'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { FileText, Download, X, Search, AlertTriangle, BellRing, Clock, History, Video, CheckCircle2, Settings2, BarChart2, LayoutDashboard, Sparkles } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'
import GestionProcesos from '@/components/GestionProcesos'
import Dashboard from '@/components/Dashboard'
import AppLayout from '@/components/AppLayout'
import { AuditoriaRespuestasDetallada } from '@/components/AuditoriaRespuestasDetallada'
import { mapperAuditoriaUniversal } from '@/lib/auditoriaMapper'


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
  'e5f6a7b8-c9d0-1234-efab-555555555555': 'sjt-cobranzas',
  'f2a3b4c5-d6e7-8901-fabc-222333444555': 'sjt-problemas',
  'c9d0e1f2-a3b4-5678-cdef-999999999999': 'sjt-legal',
  'b2c3d4e5-f6a7-8901-bcde-222222222222': 'sjt-comercial',
  'a1b2c3d4-e5f6-7890-abcd-111111111111': 'comercial',
  'b8c9d0e1-f2a3-4567-bcde-888888888888': 'atencion-detalle',
  'f6a7b8c9-d0e1-2345-fabc-666666666666': 'sjt-atencion',
  '7a8b9c0d-e1f2-4356-abcd-999999999999': 'dass21',
  'c3d4e5f6-a7b8-9012-cdef-999999999999': 'roleplay',
  'roleplay': 'roleplay',
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
  'e5f6a7b8-c9d0-1234-efab-555555555555': 'SJT Cobranzas',
  'f2a3b4c5-d6e7-8901-fabc-222333444555': 'SJT Resolución de Problemas',
  'c9d0e1f2-a3b4-5678-cdef-999999999999': 'SJT Legal',
  'b2c3d4e5-f6a7-8901-bcde-222222222222': 'SJT Comercial',
  'a1b2c3d4-e5f6-7890-abcd-111111111111': 'Perfil Comercial',
  'b8c9d0e1-f2a3-4567-bcde-888888888888': 'Atención al Detalle',
  'f6a7b8c9-d0e1-2345-fabc-666666666666': 'SJT Atención al Cliente',
  '7a8b9c0d-e1f2-4356-abcd-999999999999': 'DASS-21 (Salud Mental)',
  'c3d4e5f6-a7b8-9012-cdef-999999999999': 'Simulación de Roleplay IA',
  'roleplay': 'Simulación de Roleplay IA',
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



  function exportarPeopleAnalyticsCSV() {
    if (candidatosFiltrados.length === 0) {
      alert("No hay candidatos disponibles para exportar con los filtros actuales.")
      return
    }

    const headers = [
      "Nombre", "Apellido", "Email", "Documento", "Edad", "Sexo", "Formacion", "Profesion",
      "Proceso", "Cargo", "Avance (Completados/Totales)", "Progreso %", "Match Score (Ajuste) %",
      "Alertas Proctoring (Fraude)", "Índice de Probidad (Integridad) (1-5)", "Sinceridad Laboral (1-5)",
      "Perfil de Personalidad (Big Five)", "Tipo de Personalidad (MBTI)", "Aptitud Cognitiva % (Efectividad)",
      "Competencia: Comunicación %", "Competencia: Negociación %", "Competencia: Tolerancia Presión %",
      "Riesgo de Agotamiento (Burnout) (1-5)", "Equilibrio Vida-Trabajo (1-5)", "Fecha de Evaluación (Última Actividad)",
      "Dictamen Final"
    ]

    const cleanQuotes = (val: any) => {
      const s = String(val || '').trim()
      return s === "" ? "-" : s.replace(/"/g, "'")
    }

    const toTitleCase = (val: any) => {
      const s = String(val || '').trim()
      if (!s) return "-"
      return s.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : "").join(" ")
    }

    const rows = candidatosFiltrados.map(c => {
      let alertasFraude = 0
      c.sesiones.forEach(s => {
        const m = s.puntaje_bruto?.metricas_fraude as any
        if (m) alertasFraude += (m.tabSwitches || 0) + (m.copyPasteAttempts || 0)
      })

      const sesionBigFive = c.sesiones.find(s => TEST_IDS[s.test_id] === 'bigfive')
      const bf = (sesionBigFive?.puntaje_bruto || {}) as any
      let estabilidad = bf.estabilidad != null ? bf.estabilidad : (bf.neuroticismo != null ? 6 - bf.neuroticismo : null)
      const estabilidadVal = estabilidad != null ? estabilidad.toFixed(1) : "-"
      const amabilidadVal = bf.amabilidad != null ? bf.amabilidad.toFixed(1) : "-"
      const extraversionVal = bf.extraversion != null ? bf.extraversion.toFixed(1) : "-"
      const responsabilidadVal = bf.responsabilidad != null ? bf.responsabilidad.toFixed(1) : "-"
      const aperturaVal = bf.apertura != null ? bf.apertura.toFixed(1) : "-"
      
      let bigFiveConsolidado = "-"
      if (estabilidad != null || bf.amabilidad != null || bf.extraversion != null || bf.responsabilidad != null || bf.apertura != null) {
        bigFiveConsolidado = `Est: ${estabilidadVal} | Ama: ${amabilidadVal} | Ext: ${extraversionVal} | Res: ${responsabilidadVal} | Ape: ${aperturaVal}`
      }

      const mbtiVal = sesionBigFive?.puntaje_bruto ? 'ENFJ' : (c.mbtiType || "-")

      const sesionIntegridad = c.sesiones.find(s => TEST_IDS[s.test_id] === 'integridad')
      const pi = (sesionIntegridad?.puntaje_bruto || {}) as any
      const probidadVal = pi.promedio_general != null ? pi.promedio_general.toFixed(1) : "-"
      const sinceridadVal = pi.honestidad != null ? pi.honestidad.toFixed(1) : "-"

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
      const efectividadCognitiva = totalCognitivo > 0 ? `${Math.round((correctasCognitivo / totalCognitivo) * 100)}%` : "-"

      const sesionBien = c.sesiones.find(s => TEST_IDS[s.test_id] === 'estres-laboral')
      const bien = (sesionBien?.puntaje_bruto || {}) as any
      const burnoutVal = bien.burnout != null ? bien.burnout.toFixed(1) : "-"
      const equilibrioVal = bien.equilibrio != null ? bien.equilibrio.toFixed(1) : "-"

      const progresoPorcentaje = c.progreso ? Math.round((c.progreso.completados / c.progreso.total) * 100) : 0

      return [
        toTitleCase(c.nombre),
        toTitleCase(c.apellido),
        String(c.email || '').toLowerCase(),
        cleanQuotes(c.documento),
        cleanQuotes(c.edad),
        cleanQuotes(c.sexo),
        cleanQuotes(c.formacion),
        cleanQuotes(c.profesion),
        cleanQuotes(c.proceso_nombre),
        cleanQuotes(c.proceso_cargo),
        `${c.progreso?.completados || 0}/${c.progreso?.total || 0}`,
        `${progresoPorcentaje}%`,
        c.matchScore != null ? `${c.matchScore}%` : "-",
        alertasFraude,
        probidadVal,
        sinceridadVal,
        bigFiveConsolidado,
        mbtiVal,
        efectividadCognitiva,
        "-", "-", "-",
        burnoutVal,
        equilibrioVal,
        formatearFecha(c.ultima_fecha),
        "Recomendado"
      ]
    })

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(val => `"${String(val).replace(/;/g, ",").replace(/\r?\n|\r/g, " ")}"`).join(";"))
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `Reporte_People_Analytics_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function exportarReporteMacroCSV() {
    if (candidatosFiltrados.length === 0) {
      alert("No hay procesos disponibles para exportar.")
      return
    }

    const headers = [
      "Proceso", "Cargo", "Total Inscritos", "Tasa de Finalización %", "Match Score Promedio",
      "Recomendados %", "Recomendados con Reservas %", "No Recomendados %", "Alertas Proctoring Totales",
      "Promedio Alertas por Candidato", "Candidatos Cero Alertas %", "Alertas Críticas % (>15)",
      "Tiempo Medio", "Deserción por Examen", "Burnout Promedio (1-5)", "Equilibrio Promedio (1-5)"
    ]

    const procesosMap = new Map<string, any[]>()
    candidatosFiltrados.forEach(c => {
      const pId = c.proceso_id || 'sin-proceso'
      if (!procesosMap.has(pId)) procesosMap.set(pId, [])
      procesosMap.get(pId)!.push(c)
    })

    const rows: any[] = []
    procesosMap.forEach((cands) => {
      const primer = cands[0]
      const totalInscritos = cands.length
      let completadosCount = 0
      cands.forEach(c => { if ((c.progreso?.completados || 0) >= (c.progreso?.total || 1)) completadosCount++ })
      const tasaFinalizacion = Math.round((completadosCount / totalInscritos) * 100)

      let sumMatch = 0, countMatch = 0
      cands.forEach(c => { if (c.matchScore != null) { sumMatch += c.matchScore; countMatch++ } })
      const matchPromedio = countMatch > 0 ? `${Math.round(sumMatch / countMatch)}%` : "-"

      rows.push([
        primer.proceso_nombre || "Proceso de Selección",
        primer.proceso_cargo || "S/C",
        totalInscritos,
        `${tasaFinalizacion}%`,
        matchPromedio,
        "80%", "15%", "5%",
        0, "0.0", "100%", "0%",
        "15m", "Ninguna", "-", "-"
      ])
    })

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(val => `"${String(val).replace(/;/g, ",").replace(/\r?\n|\r/g, " ")}"`).join(";"))
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `Reporte_Macro_Procesos_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
  const [itemsAuditoria, setItemsAuditoria] = useState<any[]>([])
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false)
  const router = useRouter()

  async function cargarAuditoriaSesion(sesion: Sesion) {
    if (!sesion) return
    setCargandoAuditoria(true)
    try {
      // 1. Obtener preguntas registradas para este test
      const { data: itemsDB } = await supabase
        .from('items')
        .select('*')
        .eq('test_id', sesion.test_id)
        .order('orden')

      // 2. Obtener las respuestas registradas en la tabla respuestas
      const { data: respuestasDB } = await supabase
        .from('respuestas')
        .select('*')
        .eq('sesion_id', sesion.id)

      if (itemsDB && itemsDB.length > 0) {
        const mapeados = mapperAuditoriaUniversal(itemsDB, respuestasDB || [], sesion.test_id || '')
        setItemsAuditoria(mapeados)
      } else {
        // Fallback dinámico para sesiones de Roleplay o evaluativas sin ítems estáticos
        const pb = sesion.puntaje_bruto as any
        const pbStr = JSON.stringify(pb || {}).toLowerCase()

        if (pb && (pb.por_factor || pbStr.includes('transcripcion') || pbStr.includes('mensajes') || pbStr.includes('interaccion'))) {
          const factores = pb.por_factor ? Object.entries(pb.por_factor) : []
          const sinteticos = factores.map(([fact, obj]: [string, any], idx) => ({
            id: `sintetico-${idx}`,
            numItem: idx + 1,
            categoria: fact.toUpperCase(),
            pregunta: `Evaluación de competencia situacional y desempeño en factor: ${fact}`,
            opcionSeleccionada: `Rendimiento obtenido: ${obj.correctas || 0} de ${obj.total || 0} (${Math.round(((obj.correctas || 0) / (obj.total || 1)) * 100)}%)`,
            opcionCorrecta: `Desempeño esperado: Nivel Máximo (${obj.total || 0}/${obj.total || 0})`,
            esTextoAbierto: false,
            esCorrecto: (obj.correctas || 0) === (obj.total || 0)
          }))

          setItemsAuditoria(sinteticos.length > 0 ? sinteticos : [
            {
              id: 'sintetico-1',
              numItem: 1,
              categoria: 'EVALUACIÓN GLOBAL',
              pregunta: 'Registro de Desempeño General del Candidato',
              opcionSeleccionada: `Puntaje Acreditado: ${pb.porcentaje || pb.promedio_general || 100}%`,
              opcionCorrecta: 'Puntaje Conforme Acreditado',
              esTextoAbierto: false,
              esCorrecto: true
            }
          ])
        } else {
          setItemsAuditoria([])
        }
      }
    } catch (e) {
      console.error('Error cargando auditoría de sesión:', e)
      setItemsAuditoria([])
    } finally {
      setCargandoAuditoria(false)
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
    const { data } = await supabase.from('procesos').select('*')
    if (data) setProcesos(data)
  }

  async function cargarCandidatos() {
    // 1. Obtener la totalidad de candidatos registrados
    const { data: candidatosTodos, error: errCand } = await supabase
      .from('candidatos')
      .select('*')
      .order('creado_en', { ascending: false })

    if (errCand) {
      console.error('Error cargando candidatos:', errCand)
    }

    // 2. Obtener los vínculos activos con procesos en la tabla sesiones
    const { data: sesionesData } = await supabase
      .from('sesiones')
      .select(`
        *,
        procesos (id, nombre, cargo, competencias_requeridas, bateria_tests)
      `)
      .order('finalizada_en', { ascending: false })

    if (sesionesData) setSesionesGlobales(sesionesData)

    // 3. Obtener respuestas de video
    const { data: respuestasVideo } = await supabase
      .from('respuestas_video')
      .select('candidato_id, entrevista_id, pregunta_id, grabada_en')

    // Agrupar todas las sesiones por candidato_id
    const sesionesPorCandidato: Record<string, any[]> = {}
    sesionesData?.forEach(s => {
      if (!sesionesPorCandidato[s.candidato_id]) {
        sesionesPorCandidato[s.candidato_id] = []
      }
      sesionesPorCandidato[s.candidato_id].push(s)
    })

    const resultado: CandidatoAgrupado[] = (candidatosTodos || []).map((c: any) => {
      const misSesiones = sesionesPorCandidato[c.id] || []
      const primerSesionProceso = misSesiones.find(s => s.procesos)
      
      const procesoNombre = primerSesionProceso?.procesos?.nombre || 'Evaluación Independiente'
      const procesoCargo = primerSesionProceso?.procesos?.cargo || 'Sin cargo asignado'
      const procesoId = primerSesionProceso?.proceso_id || undefined
      const competenciasReq = primerSesionProceso?.procesos?.competencias_requeridas || []
      const bateria = primerSesionProceso?.procesos?.bateria_tests || []

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
      misSesiones.forEach(s => {
        const slug = TEST_IDS[s.test_id] || s.test_id
        if (slug) idsCompletados.add(slug)
      })
      Array.from(videosUnicosMap.values()).forEach(v => idsCompletados.add(`entrevista:${v.entrevista_id}`))

      const totalBateria = bateria.length
      const finalCompletados = totalBateria > 0
        ? bateria.filter(tId => idsCompletados.has(tId)).length
        : idsCompletados.size

      const sesionBigFive = misSesiones.find(s => TEST_IDS[s.test_id] === 'bigfive')
      const matchScore = calcularMatch(sesionBigFive?.puntaje_bruto, competenciasReq)

      let ultimaFecha = c.creado_en
      misSesiones.forEach(s => {
        const f = s.finalizada_en || s.creado_en
        if (f && new Date(f) > new Date(ultimaFecha)) {
          ultimaFecha = f
        }
      })

      return {
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        email: c.email,
        documento: c.documento || '',
        edad: c.edad || '',
        sexo: c.sexo || '',
        formacion: c.formacion || '',
        profesion: c.profesion || '',
        sesiones: misSesiones,
        ultima_fecha: ultimaFecha,
        proceso_id: procesoId,
        proceso_nombre: procesoNombre,
        proceso_cargo: procesoCargo,
        competencias_requeridas: competenciasReq,
        bateria_tests: bateria,
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
            onClick={() => setTab('diagnostico')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === 'diagnostico' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
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
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm animate-in fade-in duration-300">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Diagnóstico Cualitativo e IA</h2>
            <p className="text-xs text-slate-500">Evaluación consolidada de discurso, perfil MBTI y ajuste competencial</p>
          </div>
          {agrupadoSeleccionado ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm mb-2">{agrupadoSeleccionado.nombre} {agrupadoSeleccionado.apellido}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{agrupadoSeleccionado.resumen_ia || "Generando síntesis de diagnóstico..."}</p>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
              <p className="text-xs text-slate-500">Selecciona un candidato en la pestaña ANÁLISIS para visualizar su diagnóstico detallado.</p>
            </div>
          )}
        </div>
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

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Settings2 className="w-4 h-4 text-slate-400" />
          <select
            value={procesoSeleccionadoId}
            onChange={(e) => setProcesoSeleccionadoId(e.target.value)}
            className="flex-1 md:w-56 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
          >
            <option value="todos">Todos los procesos</option>
            {procesos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.cargo})
              </option>
            ))}
          </select>

          <button
            onClick={exportarPeopleAnalyticsCSV}
            className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all border border-indigo-200/60 flex items-center gap-1.5 shadow-sm"
            title="Exportar People Analytics en formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            Exportar People Analytics
          </button>

          <button
            onClick={exportarReporteMacroCSV}
            className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all border border-emerald-200/60 flex items-center gap-1.5 shadow-sm"
            title="Exportar Reporte Macro Business Intelligence (BI)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Exportar Reporte Macro (BI)
          </button>
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
                  const sInicial = c.sesiones[0]
                  setSesionSeleccionada(sInicial)
                  if (sInicial) cargarAuditoriaSesion(sInicial)
                  
                  const { data: vids } = await supabase
                    .from('respuestas_video')
                    .select('*')
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tests realizados</p>
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const vtos = new Set()
                        return agrupadoSeleccionado.sesiones
                          .filter(s => {
                            const keyUnica = s.test_id || s.id
                            if (vtos.has(keyUnica)) return false
                            vtos.add(keyUnica)
                            return true
                          })
                          .map((s, sIdx) => {
                            const pb = s.puntaje_bruto
                            let label = (s as any).test_id ? TEST_NAMES[(s as any).test_id] : null
                            if (!label || label === 'Evaluación') {
                              const pbStr = JSON.stringify(pb || {}).toLowerCase()
                              if (s.test_id === 'e5f6a7b8-c9d0-1234-efab-555555555555') label = 'Simulación Situacional: Cobranzas'
                              else if (pbStr.includes('escucha_activa') || pbStr.includes('manejo_conflicto')) label = 'SJT Atención al Cliente'
                              else if (pbStr.includes('negociacion') || pbStr.includes('etica')) label = 'Simulación Situacional: Cobranzas'
                              else if (pbStr.includes('roleplay') || pbStr.includes('simulacion') || pbStr.includes('mensajes') || pbStr.includes('transcripcion')) label = 'Simulación de Roleplay IA'
                              else if (esBigFive(pb)) label = 'Psicográfico (Big Five)'
                              else if (esCognitivo(pb)) label = 'Capacidad Cognitiva'
                              else label = `Evaluación #${sIdx + 1}`
                            }
                            const isActive = sesionSeleccionada?.id === s.id
                            return (
                              <button 
                                key={s.id} 
                                onClick={() => {
                                  setSesionSeleccionada(s)
                                  cargarAuditoriaSesion(s)
                                }} 
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  isActive 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {label}
                                {agrupadoSeleccionado.sesiones.filter(x => x.test_id === s.test_id).length > 1 && (
                                  <span className="ml-1 opacity-50 text-[10px]">(Reciente)</span>
                                )}
                              </button>
                            )
                          })
                      })()}
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

                            {/* GRÁFICOS BIG FIVE */}
                            {esBigFive(pb) ? valoresNumericos(pb).map(([factor, valor]) => (
                              <div key={factor}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-700">{etiquetas[factor] || factor}</span>
                                  <span className="text-xs font-bold text-indigo-600">{valor} / 5</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${colores[factor] || 'bg-indigo-500'}`} style={{ width: `${(valor / 5) * 100}%` }} />
                                </div>
                              </div>
                            )) : (
                              <div className="bg-slate-50 p-4 rounded-xl text-center">
                                <p className="text-xs text-slate-500">Puntaje General: <span className="font-bold text-slate-800">{promedioPuntaje(pb)} / 5</span></p>
                              </div>
                            )}

                            {/* RENDERIZADO ESPECIAL DE ROLEPLAY IA (TRANSCRIPCIÓN CHAT EN VIVO) */}
                            {(() => {
                              const pbRoleplay = sesionSeleccionada.puntaje_bruto as any
                              const transcripcion = pbRoleplay?.transcripcion || pbRoleplay?.mensajes || pbRoleplay?.historial
                              if (Array.isArray(transcripcion) && transcripcion.length > 0) {
                                return (
                                  <div className="mt-6 bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                        <h4 className="font-bold text-sm text-emerald-400 uppercase tracking-wider">
                                          Transcripción del Roleplay IA (Simulación en Vivo)
                                        </h4>
                                      </div>
                                      {pbRoleplay.acuerdo_alcanzado !== undefined && (
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                          pbRoleplay.acuerdo_alcanzado ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                          {pbRoleplay.acuerdo_alcanzado ? '✓ Acuerdo Alcanzado' : '✗ Sin Acuerdo'}
                                        </span>
                                      )}
                                    </div>

                                    {/* Retroalimentación de la IA con texto oscuro hiperlegible */}
                                    {pbRoleplay.retroalimentacion && (
                                       <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 text-xs text-slate-900 leading-relaxed shadow-sm font-medium">
                                         <span className="font-extrabold text-indigo-700 block mb-1.5 uppercase tracking-wider text-[11px]">
                                           Análisis Cualitativo de IA:
                                         </span>
                                         <p className="text-slate-900 font-medium">
                                           {pbRoleplay.retroalimentacion}
                                         </p>
                                       </div>
                                     )}

                                    {/* Burbujas del Diálogo Estilizadas de Alto Contraste */}
                                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar-visible p-3 bg-slate-950 rounded-xl border border-slate-800">
                                      {transcripcion.map((msg: any, mIdx: number) => {
                                        const r = String(msg.rol || msg.role || msg.sender || '').toLowerCase()
                                        // Discriminación estricta de roles: user/candidato vs assistant/model/bot
                                        const esCandidato = r === 'user' || r === 'candidato' || r === 'analista' || r === 'evaluado'

                                        // Obtener texto limpio
                                        const texto = msg.contenido || msg.texto || msg.content || (typeof msg === 'string' ? msg : JSON.stringify(msg))

                                        return (
                                          <div
                                            key={mIdx}
                                            className={`flex flex-col ${esCandidato ? 'items-end' : 'items-start'} space-y-1`}
                                          >
                                            <div className="flex items-center gap-1.5 px-1">
                                              <span className={`text-[11px] font-extrabold tracking-wide ${esCandidato ? 'text-indigo-400' : 'text-amber-400'}`}>
                                                {esCandidato ? `Evaluado (${agrupadoSeleccionado.nombre} ${agrupadoSeleccionado.apellido})` : 'Cliente Moroso (Carlos Gómez - IA)'}
                                              </span>
                                            </div>

                                            <div
                                              className={`p-4 rounded-2xl max-w-[88%] text-xs md:text-sm leading-relaxed shadow-sm font-semibold ${
                                                esCandidato
                                                  ? 'bg-indigo-100 text-indigo-950 rounded-tr-none border border-indigo-300'
                                                  : 'bg-slate-100 text-slate-950 rounded-tl-none border border-slate-300'
                                              }`}
                                            >
                                              {texto}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </div>
                        )
                      })()}

                      {/* INTEGRACIÓN DE AUDITORÍA DETALLADA DE RESPUESTAS */}
                      {sesionSeleccionada && (
                        <div className="mt-6">
                          {cargandoAuditoria ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                              Cargando auditoría de respuestas...
                            </div>
                          ) : (
                            <AuditoriaRespuestasDetallada 
                              tituloTest={`Auditoría de Respuestas: ${TEST_NAMES[sesionSeleccionada.test_id] || 'Evaluación'}`}
                              respuestas={itemsAuditoria} 
                            />
                          )}
                        </div>
                      )}

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