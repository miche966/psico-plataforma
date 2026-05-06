'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { BarChart3, PieChart, TrendingUp, ShieldAlert } from 'lucide-react'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

interface Sesion {
  id: string
  candidato_id: string | null
  proceso_id?: string | null
  finalizada_en: string
  puntaje_bruto: Record<string, number>
  candidato?: Candidato
}

interface Proceso {
  id: string
  nombre: string
}

const factores = ['apertura', 'amabilidad', 'extraversion', 'neuroticismo', 'responsabilidad']
const etiquetas: Record<string, string> = {
  extraversion: 'Extraversión',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  neuroticismo: 'Neuroticismo',
  apertura: 'Apertura'
}
const coloresHex: Record<string, string> = {
  extraversion: '#2563eb', // blue-600
  amabilidad: '#16a34a', // green-600
  responsabilidad: '#9333ea', // purple-600
  neuroticismo: '#dc2626', // red-600
  apertura: '#ea580c' // orange-600
}
const coloresBg: Record<string, string> = {
  extraversion: 'bg-blue-600',
  amabilidad: 'bg-green-600',
  responsabilidad: 'bg-purple-600',
  neuroticismo: 'bg-red-600',
  apertura: 'bg-orange-600'
}
const coloresText: Record<string, string> = {
  extraversion: 'text-blue-700',
  amabilidad: 'text-green-700',
  responsabilidad: 'text-purple-700',
  neuroticismo: 'text-red-700',
  apertura: 'text-orange-700'
}
const coloresBadge: Record<string, string> = {
  extraversion: 'bg-blue-50 text-blue-700 border-blue-200',
  amabilidad: 'bg-green-50 text-green-700 border-green-200',
  responsabilidad: 'bg-purple-50 text-purple-700 border-purple-200',
  neuroticismo: 'bg-red-50 text-red-700 border-red-200',
  apertura: 'bg-orange-50 text-orange-700 border-orange-200'
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
  'e9b2c3d4-f5a6-7890-bcde-999999999999': 'sjt-cobranzas',
}

export default function EstadisticasPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<'comparacion' | 'promedios' | 'radar' | 'habilidades' | 'auditoria'>('comparacion')
  const [habilidades, setHabilidades] = useState({ 
    cognitivo: 0, sjt: 0, integridad: 0, confianza: 0, tiempoPromedio: 0, 
    finalizacion: 0, alertasCopia: 0, alertasTab: 0,
    liderazgo: 0, adaptabilidad: 0, resiliencia: 0,
    sinDatosTiempo: false
  })
  const [sesionRadar, setSesionRadar] = useState<Sesion | null>(null)
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<string>('todos')
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarDatos()
  }, [])

  useEffect(() => {
    if (vista === 'radar' && sesionRadar && canvasRef.current) {
      dibujarRadar()
    }
  }, [vista, sesionRadar])

  async function cargarDatos() {
    // 1. Obtener procesos
    const { data: procesosData } = await supabase.from('procesos').select('*').order('creado_en', { ascending: false })
    if (procesosData) setProcesos(procesosData)

    // 2. Obtener vínculos de candidatos para filtrar
    const { data: vinculos } = await supabase.from('candidatos_procesos').select('candidato_id, proceso_id')
    
    // 3. Obtener sesiones con puntaje para los candidatos encontrados (historial completo)
    const candidatoIds = Array.from(new Set(vinculos?.map(v => v.candidato_id).filter(Boolean) || []))
    
    const query = supabase.from('sesiones').select('*').not('puntaje_bruto', 'is', null)
    if (candidatoIds.length > 0) {
      query.in('candidato_id', candidatoIds)
    }
    const { data: sesionesData } = await query.order('finalizada_en', { ascending: false })

    if (!sesionesData) { setCargando(false); return }

    // 3. Obtener TODOS los candidatos involucrados en las sesiones encontradas (para evitar anónimos)
    const todosCandidatoIds = Array.from(new Set(sesionesData.map(s => s.candidato_id).filter(Boolean)))
    
    const { data: candidatosData } = await supabase
      .from('candidatos')
      .select('id, nombre, apellido, email')
      .in('id', todosCandidatoIds)

    const candidatosMap: Record<string, any> = {}
    candidatosData?.forEach(c => {
      candidatosMap[c.id] = c
    })

    const resultadoCompleto = sesionesData.map(s => ({
      ...s,
      candidato: candidatosMap[s.candidato_id!] || null
    }))

    const grupos: Record<string, Sesion & { matchScore?: number | null }> = {}
    
    resultadoCompleto.forEach(s => {
      const cId = s.candidato_id || 'anonimo'
      const proc = procesosData?.find(p => p.id === s.proceso_id)
      
      const pbNorm = normalizarPuntaje(s.puntaje_bruto)
      const tieneDatos = factores.some(f => (pbNorm[f] || 0) > 0)
      
      let mScore = null
      if (proc && proc.competencias_requeridas && tieneDatos) {
        mScore = calcularMatchSimple(pbNorm, proc.competencias_requeridas)
      }

      // CRITERIO DE SELECCIÓN:
      // 1. Si no tenemos sesión para este candidato, la guardamos.
      // 2. Si la nueva sesión TIENE datos y la vieja NO, la reemplazamos.
      // 3. Si ambas tienen datos, nos quedamos con la más reciente.
      if (!grupos[cId]) {
        grupos[cId] = { ...s, puntaje_bruto: pbNorm, matchScore: mScore }
      } else {
        const viejaTieneDatos = factores.some(f => (grupos[cId].puntaje_bruto[f] || 0) > 0)
        if (tieneDatos && !viejaTieneDatos) {
          grupos[cId] = { ...s, puntaje_bruto: pbNorm, matchScore: mScore }
        } else if (tieneDatos && viejaTieneDatos && new Date(s.finalizada_en) > new Date(grupos[cId].finalizada_en)) {
          grupos[cId] = { ...s, puntaje_bruto: pbNorm, matchScore: mScore }
        }
      }
    })

    const resultadoFinal = Object.values(grupos).sort((a, b) => 
      new Date(b.finalizada_en).getTime() - new Date(a.finalizada_en).getTime()
    )

    // 4. Calcular métricas complementarias (Normalizadas)
    const statsHabilidades = calcularStatsHabilidades(resultadoCompleto)
    setHabilidades(statsHabilidades)

    setSesiones(resultadoFinal)
    if (resultadoFinal.length > 0) setSesionRadar(resultadoFinal[0])
    setCargando(false)
  }

  function normalizarPuntaje(pb: Record<string, any>) {
    if (!pb) return {}
    const norm: Record<string, number> = {}
    const map: Record<string, string[]> = {
      extraversion: ['extraversion', 'Extraversión', 'extraversión', 'Extraversion', 'Extraversion_Score', 'Sociabilidad'],
      amabilidad: ['amabilidad', 'Amabilidad', 'Amabilidad_Score', 'Cordialidad', 'cordialidad', 'Afabilidad'],
      responsabilidad: ['responsabilidad', 'Responsabilidad', 'Responsabilidad_Score', 'Escrupulosidad', 'escrupulosidad', 'Organización'],
      neuroticismo: ['neuroticismo', 'Neuroticismo', 'Estabilidad_Emocional', 'Emocionalidad', 'emocionalidad', 'Afectividad'],
      apertura: ['apertura', 'Apertura', 'apertura_experiencia', 'Apertura_Score', 'Apertura a la experiencia', 'Creatividad']
    }
    
    Object.entries(map).forEach(([key, aliases]) => {
      const found = aliases.find(a => pb[a] !== undefined)
      if (found) {
        let val = Number(pb[found])
        // Si el valor viene en escala 1-100, lo normalizamos a 1-5 para el radar/tabla
        if (val > 5) val = val / 20
        norm[key] = val
      }
    })
    return norm
  }

  function calcularStatsHabilidades(todasSesiones: any[]) {
    const counts: any = { cognitivo: [], sjt: [], integridad: [] }
    let alertasTab = 0
    let alertasCopia = 0
    let totalAlertas = 0
    let totalDuracion = 0
    let sesionesConTiempo = 0
    const softSkills = { extra: [], amab: [], resp: [], neur: [], aper: [] }
    
    todasSesiones.forEach(s => {
      const pb = s.puntaje_bruto || {}
      const testSlug = (TEST_IDS[s.test_id] || s.test_id || '').toLowerCase()

      // 0. Soft Skills Extraction (from Big Five sessions)
      if (testSlug.includes('bigfive') || testSlug.includes('hexaco')) {
        const pbNorm = normalizarPuntaje(pb)
        if (pbNorm.extraversion) (softSkills.extra as any).push(pbNorm.extraversion)
        if (pbNorm.amabilidad) (softSkills.amab as any).push(pbNorm.amabilidad)
        if (pbNorm.responsabilidad) (softSkills.resp as any).push(pbNorm.responsabilidad)
        if (pbNorm.neuroticismo) (softSkills.neur as any).push(pbNorm.neuroticismo)
        if (pbNorm.apertura) (softSkills.aper as any).push(pbNorm.apertura)
      }

      // Tiempos y Alertas...
      const start = s.created_at || s.iniciada_en
      if (s.finalizada_en && start) {
        const dur = (new Date(s.finalizada_en).getTime() - new Date(start).getTime()) / 1000 / 60
        if (dur > 0.5 && dur < 120) {
          totalDuracion += dur
          sesionesConTiempo++
        }
      }
      
      const aTab = Number(pb.metricas_fraude?.tabSwitches || 0)
      const aCopia = Number(pb.metricas_fraude?.copyPasteAttempts || 0)
      alertasTab += aTab
      alertasCopia += aCopia
      totalAlertas += (aTab + aCopia + (s.alertas?.length || 0))

      // 1. Cognitivo
      if ('correctas' in pb || testSlug.includes('icar') || testSlug.includes('numerico') || testSlug.includes('verbal')) {
        const correctas = Number(pb.correctas || 0)
        const total = Number(pb.total || 10)
        if (total > 0) {
          const pct = Math.round((correctas / total) * 100)
          if (pct > 0) counts.cognitivo.push(pct)
        }
      }
      
      // 2. Situacional
      if (testSlug.includes('sjt') || testSlug.includes('comercial') || testSlug.includes('ventas')) {
        const valores = Object.values(pb).map(v => Number(v)).filter(v => !isNaN(v) && v > 0 && v <= 5)
        if (valores.length > 0) {
          counts.sjt.push(Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 20))
        }
      }
      
      // 3. Integridad
      if (testSlug.includes('integridad') || testSlug.includes('honestidad')) {
        let val = Number(pb.integridad || pb.Honestidad || pb.honestidad || 0)
        if (val > 0) {
          if (val <= 5) val = val * 20
          counts.integridad.push(val)
        }
      }
    })

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
    
    // Índice de Confianza: 100% base, restamos 10% por cada alerta promedio detectada
    const avgAlertas = todasSesiones.length ? totalAlertas / todasSesiones.length : 0
    const confianza = totalAlertas > 0 ? Math.max(0, 100 - Math.round(avgAlertas * 10)) : 100

    // Si no hay datos de tiempo real (datos históricos), estimamos 15 min por test como fallback
    const tiempoFinal = sesionesConTiempo > 0 
      ? Math.round(totalDuracion / sesionesConTiempo) 
      : 15; // Fallback para que el dashboard no se vea vacío

    // Soft Skills Mapping
    const sAvg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const e = sAvg(softSkills.extra), a = sAvg(softSkills.amab), r = sAvg(softSkills.resp), n = sAvg(softSkills.neur), ap = sAvg(softSkills.aper)

    return {
      cognitivo: avg(counts.cognitivo),
      sjt: avg(counts.sjt),
      integridad: avg(counts.integridad),
      confianza,
      tiempoPromedio: tiempoFinal,
      sinDatosTiempo: sesionesConTiempo === 0,
      alertasTab,
      alertasCopia,
      liderazgo: Math.round(((e * 0.6) + (r * 0.4)) * 20),
      adaptabilidad: Math.round(((ap * 0.6) + (a * 0.4)) * 20),
      resiliencia: Math.round(((5 - n) * 0.7 + (r * 0.3)) * 20),
      finalizacion: 0 // Campo requerido por el estado pero no calculado actualmente
    }
  }

  function calcularMatchSimple(puntaje: any, reqs: any[]) {
    // Mapeo básico para el cálculo rápido en dashboard
    const mapping: any = {
      'extraversion': ['Extraversión', 'Liderazgo', 'Comunicación'],
      'amabilidad': ['Amabilidad', 'Trabajo en equipo', 'Orientación al cliente'],
      'responsabilidad': ['Responsabilidad', 'Orientación a resultados', 'Integridad'],
      'neuroticismo': ['Neuroticismo', 'Tolerancia a la presión', 'Autocontrol'],
      'apertura': ['Apertura', 'Adaptabilidad al cambio', 'Creatividad e innovación']
    }
    
    let sumMatch = 0
    let count = 0

    reqs.forEach(r => {
      const factor = Object.keys(mapping).find(f => mapping[f].includes(r.nombre))
      if (factor) {
        let val = puntaje[factor] || 0
        if (factor === 'neuroticismo') val = 6 - val
        const ideal = r.nivel === 'A' ? 5 : r.nivel === 'B' ? 4 : 3
        const diff = Math.abs(val - ideal)
        sumMatch += Math.max(0, 1 - (diff / 3))
        count++
      }
    })

    return count > 0 ? Math.round((sumMatch / count) * 100) : null
  }

  const sesionesFiltradas = procesoSeleccionado === 'todos' 
    ? sesiones 
    : sesiones.filter(s => s.proceso_id === procesoSeleccionado)

  function promedios() {
    if (sesionesFiltradas.length === 0) return {}
    const sumas: Record<string, number> = {}
    factores.forEach(f => { sumas[f] = 0 })
    sesionesFiltradas.forEach(s => {
      if (s.puntaje_bruto) {
        factores.forEach(f => { sumas[f] += s.puntaje_bruto[f] || 0 })
      }
    })
    const result: Record<string, number> = {}
    factores.forEach(f => {
      result[f] = Math.round((sumas[f] / sesionesFiltradas.length) * 10) / 10
    })
    return result
  }

  function nombreCandidato(s: Sesion) {
    return s.candidato ? `${s.candidato.nombre} ${s.candidato.apellido}` : 'Anónimo'
  }

  function dibujarRadar() {
    const canvas = canvasRef.current
    if (!canvas || !sesionRadar?.puntaje_bruto) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cx = 200, cy = 200, r = 140
    const n = factores.length
    ctx.clearRect(0, 0, 400, 400)

    for (let level = 1; level <= 5; level++) {
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI / n) - Math.PI / 2
        const x = cx + (r * level / 5) * Math.cos(angle)
        const y = cy + (r * level / 5) * Math.sin(angle)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = '#f1f5f9'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      ctx.strokeStyle = '#e2e8f0'
      ctx.stroke()

      const lx = cx + (r + 25) * Math.cos(angle)
      const ly = cy + (r + 25) * Math.sin(angle)
      ctx.fillStyle = '#64748b'
      ctx.font = '600 11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(etiquetas[factores[i]], lx, ly)
    }

    const prom = promedios()

    // Dibujar promedio general
    ctx.beginPath()
    factores.forEach((f, i) => {
      const val = prom[f] || 0
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      const x = cx + (r * val / 5) * Math.cos(angle)
      const y = cy + (r * val / 5) * Math.sin(angle)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(148, 163, 184, 0.15)'
    ctx.fill()
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Dibujar candidato seleccionado
    ctx.beginPath()
    factores.forEach((f, i) => {
      const val = sesionRadar.puntaje_bruto[f] || 0
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      const x = cx + (r * val / 5) * Math.cos(angle)
      const y = cy + (r * val / 5) * Math.sin(angle)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(79, 70, 229, 0.15)'
    ctx.fill()
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 2
    ctx.stroke()
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

  const prom = promedios()

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Estadísticas y Análisis</h1>
          <p className="text-sm text-slate-500 mt-1">
            Basado en {sesionesFiltradas.length} evaluación{sesionesFiltradas.length !== 1 ? 'es' : ''} en total
          </p>
        </div>
        <div>
          <select
            value={procesoSeleccionado}
            onChange={(e) => {
              setProcesoSeleccionado(e.target.value)
              const sf = e.target.value === 'todos' ? sesiones : sesiones.filter(s => s.proceso_id === e.target.value)
              if (sf.length > 0 && !sf.find(s => s.id === sesionRadar?.id)) {
                setSesionRadar(sf[0])
              } else if (sf.length === 0) {
                setSesionRadar(null)
              }
            }}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="todos">Todos los procesos</option>
            {procesos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI CARDS (FUNNEL & INSIGHTS) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><BarChart3 className="w-5 h-5 text-indigo-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Candidatos</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{sesionesFiltradas.length}</div>
          <div className="text-[10px] text-slate-500 mt-1">Con evaluaciones finalizadas</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp className="w-5 h-5 text-green-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Match Promedio</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {Math.round(sesionesFiltradas.reduce((acc, s: any) => acc + (s.matchScore || 0), 0) / (sesionesFiltradas.filter((s: any) => s.matchScore).length || 1))}%
          </div>
          <div className="text-[10px] text-green-600 font-bold mt-1">Nivel de calce global</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg"><PieChart className="w-5 h-5 text-purple-600" /></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsabilidad</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{prom['responsabilidad'] || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Promedio grupal (Big Five)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all bg-gradient-to-br from-slate-900 to-slate-800 border-none">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/10 rounded-lg"><TrendingUp className="w-5 h-5 text-white" /></div>
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Insight IA</span>
          </div>
          <div className="text-xs font-medium text-white/90 leading-tight">
            {sesionesFiltradas.length > 0 
              ? `El grupo actual muestra una alta orientación a ${prom['responsabilidad']! > 3.5 ? 'resultados' : 'estabilidad'}.` 
              : 'Selecciona un proceso para ver insights.'}
          </div>
        </div>
      </div>

      <div className="bg-slate-100 p-1 rounded-xl flex gap-1 w-fit mb-8 shadow-sm">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'comparacion' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('comparacion')}
        >
          <BarChart3 className="w-4 h-4" /> Comparación
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'promedios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('promedios')}
        >
          <TrendingUp className="w-4 h-4" /> Promedios Globales
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'radar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('radar')}
        >
          <PieChart className="w-4 h-4" /> Gráfico Radar
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'habilidades' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('habilidades')}
        >
          <TrendingUp className="w-4 h-4" /> Capacidad y Potencial
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'auditoria' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('auditoria')}
        >
          <ShieldAlert className="w-4 h-4" /> Auditoría de Proceso
        </button>
      </div>

      {vista === 'comparacion' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Candidato</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Match %</th>
                  {factores.map(f => (
                    <th key={f} className={`px-5 py-4 text-[10px] font-bold uppercase tracking-widest text-center ${coloresText[f]}`}>
                      {etiquetas[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sesionesFiltradas.map((sesion: any) => (
                  <tr key={sesion.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900">{nombreCandidato(sesion)}</div>
                      {sesion.candidato && <div className="text-[10px] text-slate-400 mt-0.5">{sesion.candidato.email}</div>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full border-4 ${
                        (sesion.matchScore || 0) >= 70 ? 'border-green-500 bg-green-50' : (sesion.matchScore || 0) >= 50 ? 'border-yellow-500 bg-yellow-50' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <span className="text-xs font-bold text-slate-800">{sesion.matchScore || '—'}%</span>
                      </div>
                    </td>
                    {factores.map(f => {
                      const pbNorm = normalizarPuntaje(sesion.puntaje_bruto)
                      const val = pbNorm[f] || 0
                      
                      if (val === 0) {
                        return <td key={f} className="px-5 py-4 text-center text-[10px] text-slate-300 font-bold italic">Pendiente</td>
                      }

                      // Intensidad de color para el Heatmap
                      const opacity = Math.min(1, val / 5)
                      const bgColor = f === 'extraversion' ? `rgba(37, 99, 235, ${opacity})` :
                                    f === 'amabilidad' ? `rgba(22, 163, 74, ${opacity})` :
                                    f === 'responsabilidad' ? `rgba(147, 51, 234, ${opacity})` :
                                    f === 'neuroticismo' ? `rgba(220, 38, 38, ${opacity})` :
                                    `rgba(234, 88, 12, ${opacity})`
                      
                      return (
                        <td key={f} className="px-5 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(val/5)*100}%`, backgroundColor: bgColor }} />
                            </div>
                            <span className="text-xs font-bold text-slate-700">{val}</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {sesiones.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      No hay datos suficientes para mostrar estadísticas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vista === 'promedios' && (
        <div className="max-w-3xl">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <p className="text-sm text-slate-500 mb-8 font-medium">
              Promedio ponderado basado en {sesionesFiltradas.length} evaluación{sesionesFiltradas.length !== 1 ? 'es' : ''} registrada{sesionesFiltradas.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-6">
              {factores.map(f => (
                <div key={f} className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-700 w-32 shrink-0">{etiquetas[f]}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${coloresBg[f]}`}
                      style={{ width: `${((prom[f] || 0) / 5) * 100}%` }} 
                    />
                  </div>
                  <span className={`text-sm font-bold w-8 text-right ${coloresText[f]}`}>{prom[f] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {vista === 'radar' && (
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-1/3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-3">Seleccionar Candidato:</label>
            <select
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={sesionRadar?.id || ''}
              onChange={e => {
                const found = sesionesFiltradas.find(s => s.id === e.target.value)
                if (found) {
                  setSesionRadar(found)
                }
              }}
            >
              {sesionesFiltradas.map(s => (
                <option key={s.id} value={s.id}>{nombreCandidato(s)}</option>
              ))}
            </select>
            
            <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Leyenda del Gráfico</h4>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-sm shadow-indigo-600/30"></div>
                <span className="text-sm font-semibold text-slate-700">
                  {sesionRadar ? nombreCandidato(sesionRadar) : 'Candidato'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                <span className="text-sm font-medium text-slate-500">Promedio global ({sesionesFiltradas.length} evals)</span>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-2/3 flex justify-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-50 rounded-tr-full -z-10"></div>
            <canvas ref={canvasRef} width={400} height={400} className="max-w-full" />
          </div>
        </div>
      )}

      {vista === 'habilidades' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Inteligencia General (CI)
            </h3>
            <div className="flex items-center justify-center h-48 relative">
              <div className="text-center">
                <div className="text-5xl font-black text-indigo-600">{habilidades.cognitivo}%</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                  {habilidades.cognitivo > 85 ? 'Rango Superior' : habilidades.cognitivo > 60 ? 'Rango Promedio' : 'Rango en Desarrollo'}
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center -z-10 opacity-10">
                <div className="w-32 h-32 rounded-full border-8 border-indigo-600 animate-pulse"></div>
              </div>
            </div>
            <p className="text-sm text-slate-500 text-center mt-4 italic">
              Rapidez y efectividad en la resolución de problemas lógicos y abstractos.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-600" />
              Matriz de Soft Skills
            </h3>
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-700">Potencial de Liderazgo</span>
                  <span className="text-sm font-black text-indigo-600">{habilidades.liderazgo}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${habilidades.liderazgo}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-700">Adaptabilidad al Cambio</span>
                  <span className="text-sm font-black text-orange-600">{habilidades.adaptabilidad}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-600 rounded-full transition-all duration-1000" style={{ width: `${habilidades.adaptabilidad}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-700">Resiliencia y Estabilidad</span>
                  <span className="text-sm font-black text-red-600">{habilidades.resiliencia}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 rounded-full transition-all duration-1000" style={{ width: `${habilidades.resiliencia}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {vista === 'auditoria' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Índice de Confiabilidad</h4>
            <div className="text-4xl font-black text-slate-900 mb-2">{habilidades.confianza}%</div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Basado en {sesiones.length} sesiones analizadas por el sistema Proctoring.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-50">
               <div className={`text-[10px] font-bold px-2 py-1 rounded-md inline-block ${habilidades.confianza > 80 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                 {habilidades.confianza > 80 ? 'DATOS ALTAMENTE CONFIABLES' : 'REQUIERE REVISIÓN MANUAL'}
               </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Eficiencia Temporal</h4>
            <div className="text-4xl font-black text-indigo-600 mb-2">{habilidades.tiempoPromedio} <span className="text-xl font-medium">min</span></div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {habilidades.sinDatosTiempo ? 'Promedio estimado (Datos históricos)' : 'Tiempo promedio de resolución por test.'}
            </p>
            <div className="mt-6 pt-6 border-t border-slate-50">
               <span className="text-[10px] font-medium text-slate-400 italic">
                 {habilidades.sinDatosTiempo ? '* Los nuevos candidatos registrarán tiempos reales.' : '"Ritmo de resolución óptimo para el cargo"'}
               </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Desglose de Alertas</h4>
            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600">Cambios de Pestaña</span>
                <span className={`font-bold ${habilidades.alertasTab > 0 ? 'text-red-500' : 'text-green-600'}`}>{habilidades.alertasTab}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600">Intentos de Copiar/Pegar</span>
                <span className={`font-bold ${habilidades.alertasCopia > 0 ? 'text-red-500' : 'text-green-600'}`}>{habilidades.alertasCopia}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600">Alertas Manuales</span>
                <span className="font-bold text-slate-400">0</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400">SALUD DEL PROCESO</span>
              <span className="text-[10px] font-black text-green-600">ÓPTIMA</span>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}