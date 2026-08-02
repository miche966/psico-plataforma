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
import { formatearFecha, ordenarPorPostulacionDescendente, ordenarPorPostulacionAscendente } from '@/lib/postulaciones/ordenamiento'
import { TEST_IDS, calcularProgresoEvaluacion } from '@/lib/progresoEvaluacion'


const COMPETENCIAS_MAPPING: Record<string, Partial<Record<string, number>>> = {
  'Orientaci  an al cliente': { amabilidad: 4.5, responsabilidad: 4 },
  'Orientaci  an a resultados': { responsabilidad: 5, extraversion: 4 },
  'Trabajo en equipo': { amabilidad: 5, extraversion: 4 },
  'Adaptabilidad al cambio': { apertura: 5, neuroticismo: 1.5 },
  'Integridad': { responsabilidad: 5, amabilidad: 4 },
  'Iniciativa': { extraversion: 4.5, apertura: 4, responsabilidad: 4 },
  'Liderazgo': { extraversion: 5, responsabilidad: 4.5, neuroticismo: 1.5 },
  'Comunicaci?n': { extraversion: 5, amabilidad: 4 },
  'Negociaci?n': { extraversion: 4.5, amabilidad: 3.5, responsabilidad: 4 },
  'Planificaci  an y organizaci  an': { responsabilidad: 5, apertura: 3.5 },
  'Tolerancia a la presi  an': { neuroticismo: 1, responsabilidad: 4.5 },
  'Pensamiento anal  atico': { apertura: 4.5, responsabilidad: 4 },
  'Creatividad e innovaci  an': { apertura: 5, extraversion: 4 },
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
  estado?: string
  puntaje_bruto: Record<string, any>
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
  extraversion: 'Extraversi  an',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  neuroticismo: 'Neuroticismo',
  apertura: 'Apertura'
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
  'f2a3b4c5-d6e7-8901-fabc-222333444555': 'SJT Resoluci?n de Problemas',
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
  documento?: string
  edad?: string
  sexo?: string
  formacion?: string
  profesion?: string
  mbtiType?: string
  sesiones: Sesion[]
  fecha_postulacion: string
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
      Analiza los resultados de este candidato para un proceso de selecci  an.
      Datos del candidato: ${candidato.nombre} ${candidato.apellido}
      Cargo: ${candidato.proceso_cargo}
      
      Resultados psicom  atricos (Big Five): ${JSON.stringify(candidato.sesiones.find(s => s.test_id.includes('bigfive'))?.puntaje_bruto || {})}
      Resultados de video (Transcripciones): ${JSON.stringify(candidato.sesiones.map(s => (s as any).transcripcion).filter(Boolean))}
      Match Score calculado: ${candidato.matchScore}%
      
      REQUERIMIENTO ESPECIAL: Realiza un ANÁLISIS DEL DISCURSO del candidato basándote en las transcripciones. 
      Eval?a su coherencia, riqueza de vocabulario, seguridad al expresarse y capacidad de estructurar ideas complejas.
      
      Redacta un resumen ejecutivo profesional de 2 p  arrafos. 
      Integra este an  alisis del discurso con sus rasgos de personalidad y su adecuaci  an al cargo.
      Usa un tono corporativo, sobrio y anal  atico. No uses markdown, solo texto plano.
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
  const [tab, setTab] = useState<'evaluaciones' | 'gestion' | 'dashboard' | 'historial' | 'diagnostico'>('evaluaciones')
  const [candidatos, setCandidatos] = useState<CandidatoAgrupado[]>([])
  const [procesos, setProcesos] = useState<any[]>([])
  const [procesoSeleccionadoId, setProcesoSeleccionadoId] = useState<string>('todos')
  const [agrupadoSeleccionado, setAgrupadoSeleccionado] = useState<CandidatoAgrupado | null>(null)
  const [sesionSeleccionada, setSesionSeleccionada] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [ordenFecha, setOrdenFecha] = useState<'desc' | 'asc'>('desc')
  const [videosCandidato, setVideosCandidato] = useState<any[]>([])
  const [sesionesGlobales, setSesionesGlobales] = useState<any[]>([])
  const [itemsAuditoria, setItemsAuditoria] = useState<any[]>([])
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false)
  const [procesandoVideos, setProcesandoVideos] = useState<Record<string, boolean>>({})
  const [velocidadesVideo, setVelocidadesVideo] = useState<Record<number, number>>({})
  const router = useRouter()

  async function procesarVideoConIA(respuestaId: string, urlVideo: string, idx: number) {
    if (procesandoVideos[respuestaId]) return
    setProcesandoVideos(prev => ({ ...prev, [respuestaId]: true }))
    try {
      const res = await fetch('/api/analizar-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url_video: urlVideo, respuesta_id: respuestaId }) })
      const data = await res.json()
      if (!res.ok || !data.analisis) throw new Error(data.error || 'No se pudo analizar el video')
      setVideosCandidato(prev => prev.map((video, i) => i === idx ? { ...video, transcripcion: data.analisis.transcripcion, analisis_ia: data.analisis } : video))
      alert('Análisis de video completado.')
    } catch (error) {
      console.error('Error analizando video:', error)
      alert(error instanceof Error ? error.message : 'No se pudo analizar el video.')
    } finally {
      setProcesandoVideos(prev => ({ ...prev, [respuestaId]: false }))
    }
  }

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
        // Fallback dinámico para sesiones de Roleplay o evaluativas sin   ítems estáticos
        const pb = sesion.puntaje_bruto as any
        const pbStr = JSON.stringify(pb || {}).toLowerCase()

        if (pb && (pb.por_factor || pbStr.includes('transcripcion') || pbStr.includes('mensajes') || pbStr.includes('interaccion'))) {
          const factores = pb.por_factor ? Object.entries(pb.por_factor) : []
          const sinteticos = factores.map(([fact, obj]: [string, any], idx) => ({
            id: `sintetico-${idx}`,
            numItem: idx + 1,
            categoria: fact.toUpperCase(),
            pregunta: `Evaluaci?n de competencia situacional y desempe  ao en factor: ${fact}`,
            opcionSeleccionada: `Rendimiento obtenido: ${obj.correctas || 0} de ${obj.total || 0} (${Math.round(((obj.correctas || 0) / (obj.total || 1)) * 100)}%)`,
            opcionCorrecta: `Desempe  ao esperado: Nivel M  aximo (${obj.total || 0}/${obj.total || 0})`,
            esTextoAbierto: false,
            esCorrecto: (obj.correctas || 0) === (obj.total || 0)
          }))

          setItemsAuditoria(sinteticos.length > 0 ? sinteticos : [
            {
              id: 'sintetico-1',
              numItem: 1,
              categoria: 'EVALUACI  a&SN GLOBAL',
              pregunta: 'Registro de Desempe  ao General del Candidato',
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
      console.error('Error cargando auditor  aa de sesi  an:', e)
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
    console.log("&&a [FRONTEND DIAGNOSTIC] Cargando candidatos con paginación tripartita...")
    // 1. Obtener la totalidad de candidatos registrados (Paginado completo para superar l?mite de PostgREST API)
    let candidatosTodos: any[] = []
    let candPage = 0
    const candPageSize = 1000
    let candHasMore = true

    while (candHasMore) {
      const from = candPage * candPageSize
      const to = from + candPageSize - 1
      const { data: pageCandData, error: errCandPage } = await supabase
        .from('candidatos')
        .select('*')
        .order('creado_en', { ascending: false })
        .range(from, to)

      if (errCandPage || !pageCandData || pageCandData.length === 0) {
        candHasMore = false
      } else {
        candidatosTodos = [...candidatosTodos, ...pageCandData]
        if (pageCandData.length < candPageSize) {
          candHasMore = false
        } else {
          candPage++
        }
      }
    }

    // 2. Obtener los v  anculos activos con procesos en la tabla sesiones (Paginado completo para superar el l?mite de 1000 filas de PostgREST API)
    let sesionesData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1
      const { data: pageData, error: errSesPage } = await supabase
        .from('sesiones')
        .select(`
          *,
          procesos (id, nombre, cargo, competencias_requeridas, bateria_tests)
        `)
        .order('finalizada_en', { ascending: false })
        .range(from, to)

      if (errSesPage || !pageData || pageData.length === 0) {
        hasMore = false
      } else {
        sesionesData = [...sesionesData, ...pageData]
        if (pageData.length < pageSize) {
          hasMore = false
        } else {
          page++
        }
      }
    }

    if (sesionesData.length > 0) setSesionesGlobales(sesionesData)

    // 3. Obtener la totalidad de respuestas de video (Paginado completo para superar l?mite de PostgREST API)
    let respuestasVideo: any[] = []
    let vidPage = 0
    const vidPageSize = 1000
    let vidHasMore = true

    while (vidHasMore) {
      const from = vidPage * vidPageSize
      const to = from + vidPageSize - 1
      const { data: pageVidData } = await supabase
        .from('respuestas_video')
        .select('candidato_id, entrevista_id, pregunta_id, grabada_en')
        .range(from, to)

      if (!pageVidData || pageVidData.length === 0) {
        vidHasMore = false
      } else {
        respuestasVideo = [...respuestasVideo, ...pageVidData]
        if (pageVidData.length < vidPageSize) {
          vidHasMore = false
        } else {
          vidPage++
        }
      }
    }

    const { data: preguntasVideo } = await supabase
      .from('preguntas_video')
      .select('id, entrevista_id')
    const preguntasPorEntrevista: Record<string, number> = {}
    ;(preguntasVideo || []).forEach(p => {
      preguntasPorEntrevista[p.entrevista_id] = (preguntasPorEntrevista[p.entrevista_id] || 0) + 1
    })

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
      
      const procesoNombre = primerSesionProceso?.procesos?.nombre || 'Evaluaci?n Independiente'
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

      const progresoCalculado = calcularProgresoEvaluacion(
        bateria,
        misSesiones,
        Array.from(videosUnicosMap.values()),
        preguntasPorEntrevista
      )

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
        fecha_postulacion: c.creado_en || '',
        ultima_fecha: ultimaFecha,
        proceso_id: procesoId,
        proceso_nombre: procesoNombre,
        proceso_cargo: procesoCargo,
        competencias_requeridas: competenciasReq,
        bateria_tests: bateria,
        progreso: {
          completados: progresoCalculado.completados,
          total: progresoCalculado.total || progresoCalculado.completados || 1,
          tests_pendientes: progresoCalculado.testsPendientes
        },
        matchScore
      }
    }).filter(c => c.sesiones.length > 0 || c.progreso.completados > 0)

    console.log(`&a&S& [FRONTEND RESULT] Total candidatos calculados: ${resultado.length}`)
    const camilaFinal = resultado.find(x => x.email === 'camilamartinezz2801@gmail.com')
    console.log("&aa [FRONTEND CAMILA DAHIANA]:", camilaFinal ? `ENCONTRADA CON ${camilaFinal.sesiones.length} SESIONES` : "a& NO ENCONTRADA")

    setCandidatos(resultado)
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
          pendientes: c.progreso.tests_pendientes.length, candidato_id: c.id, proceso_id: c.proceso_id
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        alert(`Recordatorio enviado con   axito a ${c.nombre}.`)
      } else {
        alert(data.error || 'Hubo un error al enviar el correo. Verifique la configuraci  an del servidor SMTP de Zimbra (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) en el servidor.')
        console.error('Error enviando recordatorio:', data.error)
      }
    } catch (error) {
      console.error(error)
      alert('Error de conexi  an al intentar enviar el recordatorio.')
    } finally {
      setEnviandoRecordatorio(null)
    }
  }

  const candidatosFiltrados = candidatos.filter(c => {
    // 1. Filtro estricto por proceso (Regla de Oro)
    if (procesoSeleccionadoId !== 'todos') {
      if (c.proceso_id !== procesoSeleccionadoId) return false
    }

    // 2. Filtro por b  asqueda de texto resiliente a acentos (normaliza tildes)
    const norm = (str: string) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const searchStr = norm(`${c.nombre} ${c.apellido} ${c.email} ${c.proceso_nombre}`)
    return searchStr.includes(norm(filtro))
  }).sort(ordenFecha === 'desc' ? ordenarPorPostulacionDescendente : ordenarPorPostulacionAscendente)

  function exportarPeopleAnalyticsCSV() {
    if (candidatosFiltrados.length === 0) {
      alert("No hay candidatos disponibles para exportar con los filtros actuales.")
      return
    }

    const headers = [
      "Nombre", "Apellido", "Email", "Documento", "Edad", "Sexo", "Formacion", "Profesion",
      "Proceso", "Cargo", "Avance (Completados/Totales)", "Progreso %", "Match Score (Ajuste) %",
      "Alertas Proctoring (Fraude)", " ?ndice de Probidad (Integridad) (1-5)", "Sinceridad Laboral (1-5)",
      "Perfil de Personalidad (Big Five)", "Tipo de Personalidad (MBTI)", "Aptitud Cognitiva % (Efectividad)",
      "Competencia: Comunicaci?n %", "Competencia: Negociaci?n %", "Competencia: Tolerancia Presi?n %",
      "Riesgo de Agotamiento (Burnout) (1-5)", "Equilibrio Vida-Trabajo (1-5)", "Fecha de Evaluaci?n (  &ltima Actividad)",
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
      "Proceso", "Cargo", "Total Inscritos", "Tasa de Finalizaci  an %", "Match Score Promedio",
      "Recomendados %", "Recomendados con Reservas %", "No Recomendados %", "Alertas Proctoring Totales",
      "Promedio Alertas por Candidato", "Candidatos Cero Alertas %", "Alertas Cr  aticas % (>15)",
      "Tiempo Medio", "Deserci  an por Examen", "Burnout Promedio (1-5)", "Equilibrio Promedio (1-5)"
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
        primer.proceso_nombre || "Proceso de Selecci  an",
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
      ...rows.map(row => row.map((val: any) => `"${String(val).replace(/;/g, ",").replace(/\r?\n|\r/g, " ")}"`).join(";"))
    ].join("\n")

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.setAttribute("download", `Reporte_Macro_Procesos_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

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
            <h2 className="text-lg font-bold text-slate-900">Diagn  ?stico Cualitativo e IA</h2>
            <p className="text-xs text-slate-500">Evaluaci?n consolidada de discurso, perfil MBTI y ajuste competencial</p>
          </div>
          {agrupadoSeleccionado ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm mb-2">{agrupadoSeleccionado.nombre} {agrupadoSeleccionado.apellido}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{agrupadoSeleccionado.resumen_ia || "Generando s  antesis de diagnóstico..."}</p>
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
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evaluaci?n</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Puntaje</th>
                  <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* NOTA DE DISEÑO FUNCIONAL: La pestaña HISTORIAL ordena intencionalmente por ultima_fecha para reflejar la Bitácora de Actividad Reciente de evaluaciones finalizadas */}
                {[...candidatosFiltrados]
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
                              +{testsCompletados.length - 2} m  as
                            </span>
                          )}
                          {testsCompletados.length === 0 && <span className="text-[9px] text-slate-300 italic">Sin tests</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-[10px] font-bold ${c.matchScore && c.matchScore >= 70 ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {c.matchScore ? `${c.matchScore}% Match` : 'aa'}
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
                            title="Ir al an  alisis"
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
                No hay registros en la bit  acora a  an.
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

          <select
            value={ordenFecha}
            onChange={(e) => setOrdenFecha(e.target.value as 'desc' | 'asc')}
            className="flex-1 md:w-48 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
          >
            <option value="desc">Ordenar: Más recientes primero</option>
            <option value="asc">Ordenar: Más antiguas primero</option>
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
          <a href="/candidatos" className="text-indigo-600 font-medium hover:text-indigo-700">Ir a candidatos aa~</a>
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
                  
                  let vids: any[] | null = null
                  const { data: vidsDirect } = await supabase
                    .from('respuestas_video')
                    .select('*')
                    .eq('candidato_id', c.id)
                    .order('grabada_en', { ascending: true })

                  if (vidsDirect && vidsDirect.length > 0) {
                    vids = vidsDirect
                  } else if (c.email) {
                    // Fallback de resiliencia: si los UUIDs fueron regenerados pero las respuestas_video quedaron asociadas a un UUID previo del mismo correo
                    const { data: candsMismoEmail } = await supabase
                      .from('candidatos')
                      .select('id')
                      .eq('email', c.email)
                    
                    const idsEmail = (candsMismoEmail || []).map(x => x.id)
                    if (idsEmail.length > 0) {
                      const { data: vidsByEmail } = await supabase
                        .from('respuestas_video')
                        .select('*')
                        .in('candidato_id', idsEmail)
                        .order('grabada_en', { ascending: true })
                      vids = vidsByEmail
                    }
                  }

                  if (vids && vids.length > 0) {
                    const pregIds = Array.from(new Set(vids.map(x => x.pregunta_id).filter(Boolean)))
                    if (pregIds.length > 0) {
                      const { data: pregsData } = await supabase
                        .from('preguntas_video')
                        .select('id, pregunta')
                        .in('id', pregIds)
                      
                      const pregMap = new Map((pregsData || []).map(p => [p.id, p.pregunta]))
                      vids.forEach(v => {
                        if (!v.preguntas_video && v.pregunta_id) {
                          v.preguntas_video = { pregunta: pregMap.get(v.pregunta_id) }
                        }
                      })
                    }
                  }
                  
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
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-500 truncate">{c.email || 'Sin email'}</span>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded-md">
                        Postulación: {formatearFecha(c.fecha_postulacion)}
                      </span>
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
                            if (!label || label === 'Evaluaci?n') {
                              const pbStr = JSON.stringify(pb || {}).toLowerCase()
                              if (s.test_id === 'e5f6a7b8-c9d0-1234-efab-555555555555') label = 'Simulación Situacional: Cobranzas'
                              else if (pbStr.includes('escucha_activa') || pbStr.includes('manejo_conflicto')) label = 'SJT Atención al Cliente'
                              else if (pbStr.includes('negociacion') || pbStr.includes('etica')) label = 'Simulación Situacional: Cobranzas'
                              else if (pbStr.includes('roleplay') || pbStr.includes('simulacion') || pbStr.includes('mensajes') || pbStr.includes('transcripcion')) label = 'Simulación de Roleplay IA'
                              else if (esBigFive(pb)) label = 'Psicogr?fico (Big Five)'
                              else if (esCognitivo(pb)) label = 'Capacidad Cognitiva'
                              else label = `Evaluaci?n #${sIdx + 1}`
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
                            <h5 className="text-sm font-bold text-slate-800 mb-3">Pregunta {i + 1}: {v.preguntas_video?.pregunta || 'Presentaci  an y Evaluaci?n Competencial de Entrada'}</h5>
                            <video 
                              id={`video-entrevista-${i}`}
                              src={v.url_video} 
                              controls 
                              crossOrigin="anonymous"
                              preload="metadata"
                              className="w-full aspect-video rounded-xl shadow-sm bg-black mb-3" 
                            />
                            <div className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
                              <span className="px-2 text-[9px] font-bold uppercase text-slate-400">Velocidad</span>
                              {[1, 1.25, 1.5, 2].map((vel) => (
                                <button key={vel} onClick={() => { const el = document.getElementById(`video-entrevista-${i}`) as HTMLVideoElement | null; if (el) el.playbackRate = vel; setVelocidadesVideo(prev => ({ ...prev, [i]: vel })) }} className={`rounded px-2 py-0.5 text-[10px] font-bold ${velocidadesVideo[i] === vel || (!velocidadesVideo[i] && vel === 1) ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{vel}x</button>
                              ))}
                            </div>
                            {(!v.transcripcion || !v.analisis_ia) && v.url_video && (
                              <button onClick={() => procesarVideoConIA(v.id, v.url_video, i)} disabled={procesandoVideos[v.id]} className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-2 text-[10px] font-bold text-indigo-700 disabled:opacity-50">
                                {procesandoVideos[v.id] ? 'Generando transcripción...' : 'Generar transcripción y análisis'}
                              </button>
                            )}
                            {v.transcripcion && <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 italic">"{v.transcripcion}"</div>}
                            {v.analisis_ia && (
                              <div className="mt-3 space-y-3">
                                <div className="p-4 bg-white rounded-xl border border-indigo-200 shadow-sm">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-3 h-3 text-indigo-600" />
                                    <span className="block rounded-md bg-slate-800 px-2 py-1 text-sm font-black text-slate-50 tracking-normal shadow-sm">Conducta no verbal</span>
                                  </div>
                                  <p className="text-[12px] text-slate-800 leading-6">
                                    {typeof v.analisis_ia === 'string' ? v.analisis_ia : (v.analisis_ia.actitud || v.analisis_ia.resumen || v.analisis_ia.analisis || 'Sin análisis de conducta no verbal disponible.')}
                                  </p>
                                </div>
                                {typeof v.analisis_ia !== 'string' && v.analisis_ia.analisis_discurso && (
                                  <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                                    <div className="mb-2 inline-block rounded-md bg-slate-800 px-2 py-1 text-sm font-black tracking-normal text-slate-50 shadow-sm">Análisis del discurso</div>
                                    <p className="text-[12px] text-slate-800 leading-6">{v.analisis_ia.analisis_discurso}</p>
                                  </div>
                                )}
                                {typeof v.analisis_ia !== 'string' && Array.isArray(v.analisis_ia.puntos_clave) && v.analisis_ia.puntos_clave.length > 0 && (
                                  <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-sm">
                                    <div className="mb-2 inline-block rounded-md bg-slate-800 px-2 py-1 text-sm font-black tracking-normal text-slate-50 shadow-sm">Puntos clave de la respuesta</div>
                                    <ul className="list-disc space-y-1 pl-4 text-[12px] text-slate-800 leading-5">
                                      {v.analisis_ia.puntos_clave.map((punto: string, puntoIdx: number) => <li key={puntoIdx}>{punto}</li>)}
                                    </ul>
                                  </div>
                                )}
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
                        <a href={`/informe?candidato=${agrupadoSeleccionado.id}`} target="_blank" className="text-[10px] font-bold text-indigo-600 hover:underline">Ver Informe Completo aa~</a>
                      </div>

                      {sesionSeleccionada.puntaje_bruto && (() => {
                        const pb = sesionSeleccionada.puntaje_bruto as any
                        const metricas = pb.metricas_fraude
                        return (
                          <div className="space-y-6">
                            {/* M  aTRICAS DE FRAUDE */}
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

                            {/* GR  aFICOS BIG FIVE */}
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

                            {/* RENDERIZADO ESPECIAL DE ROLEPLAY IA (TRANSCRIPCI  a&SN CHAT EN VIVO) */}
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
                                          {pbRoleplay.acuerdo_alcanzado ? '&a&S Acuerdo Alcanzado' : '&a Sin Acuerdo'}
                                        </span>
                                      )}
                                    </div>

                                    {/* Retroalimentaci  an de la IA con texto oscuro hiperlegible */}
                                    {pbRoleplay.retroalimentacion && (
                                       <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 text-xs text-slate-900 leading-relaxed shadow-sm font-medium">
                                         <span className="font-extrabold text-indigo-700 block mb-1.5 uppercase tracking-wider text-[11px]">
                                           An  alisis Cualitativo de IA:
                                         </span>
                                         <p className="text-slate-900 font-medium">
                                           {pbRoleplay.retroalimentacion}
                                         </p>
                                       </div>
                                     )}

                                    {/* Burbujas del Di  alogo Estilizadas de Alto Contraste */}
                                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar-visible p-3 bg-slate-950 rounded-xl border border-slate-800">
                                      {transcripcion.map((msg: any, mIdx: number) => {
                                        const r = String(msg.rol || msg.role || msg.sender || '').toLowerCase()
                                        // Discriminaci  an estricta de roles: user/candidato vs assistant/model/bot
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
                                                {esCandidato ? `Evaluado (${agrupadoSeleccionado.nombre} ${agrupadoSeleccionado.apellido})` : 'Cliente Moroso (Carlos G  amez - IA)'}
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

                      {/* INTEGRACI  a&SN DE AUDITOR  aA DETALLADA DE RESPUESTAS */}
                      {sesionSeleccionada && (
                        <div className="mt-6">
                          {cargandoAuditoria ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                              Cargando auditor  aa de respuestas...
                            </div>
                          ) : (
                            <AuditoriaRespuestasDetallada 
                              tituloTest={`Auditor  aa de Respuestas: ${TEST_NAMES[sesionSeleccionada.test_id] || 'Evaluaci?n'}`}
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
    : 'Evaluaci?n an  anima'
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
    extraversion: 'Extraversi  an',
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
      alto: 'Persona sociable, en  argica y orientada hacia el mundo externo. Disfruta del trabajo en equipo y los entornos dinámicos.',
      moderado: 'Equilibrio entre sociabilidad y reserva. Se adapta tanto a trabajos en equipo como a tareas individuales.',
      bajo: 'Persona reservada y reflexiva. Prefiere entornos tranquilos y el trabajo independiente.'
    },
    amabilidad: {
      alto: 'Alta orientaci  an hacia los dem  as, cooperativa y emp  atica. Facilita el trabajo en equipo y las relaciones interpersonales.',
      moderado: 'Equilibrio entre cooperaci  an y asertividad. Puede trabajar bien con otros sin perder independencia de criterio.',
      bajo: 'Persona directa y orientada a resultados. Puede ser m  as competitiva que colaborativa.'
    },
    responsabilidad: {
      alto: 'Alta organizaci  an, disciplina y orientaci  an al logro. Cumple compromisos y mantiene altos est  andares de trabajo.',
      moderado: 'Nivel adecuado de organizaci  an y compromiso. Puede adaptarse a distintos niveles de estructura.',
      bajo: 'Estilo flexible y espont  aneo. Puede tener dificultades con tareas que requieren alta planificaci  an.'
    },
    neuroticismo: {
      alto: 'Mayor sensibilidad emocional y tendencia a experimentar estr  as. Puede requerir entornos de trabajo estables.',
      moderado: 'Respuesta emocional equilibrada ante el estr  as. Maneja bien la mayor  aa de las situaciones laborales.',
      bajo: 'Alta estabilidad emocional y resiliencia. Maneja bien la presi  an y los entornos de alta demanda.'
    },
    apertura: {
      alto: 'Alta curiosidad intelectual, creatividad y apertura al cambio. Destaca en roles que requieren innovaci  an.',
      moderado: 'Equilibrio entre creatividad y pragmatismo. Se adapta tanto a entornos estructurados como creativos.',
      bajo: 'Preferencia por m  atodos conocidos y entornos predecibles. Destaca en roles con procesos claros y definidos.'
    }
  }
  return textos[factor]?.[nivel] || ''
}
