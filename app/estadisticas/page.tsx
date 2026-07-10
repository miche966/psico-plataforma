'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { 
  Users, CheckCircle2, TrendingUp, AlertTriangle, 
  Search, ArrowUpDown, ExternalLink, Award, Video
} from 'lucide-react'

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
  test_id: string
  estado: string
  finalizada_en: string
  puntaje_bruto: any
}

interface Proceso {
  id: string
  nombre: string
  bateria_tests?: string[]
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
  '7a8b9c0d-e1f2-4356-abcd-999999999999': 'dass21',
  'f7a8b9c0-d1e2-4356-abcd-888888888888': 'frases-incompletas',
}

export default function EstadisticasPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])
  const [respuestasVideo, setRespuestasVideo] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  
  // Filtros y ordenamiento
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState<string>('')
  const [ordenCriterio, setOrdenCriterio] = useState<'match' | 'progreso' | 'alertas' | 'nombre'>('match')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      // 1. Obtener procesos
      const { data: pData } = await supabase.from('procesos').select('*').order('creado_en', { ascending: false })
      if (pData) setProcesos(pData)

      // 2. Obtener vínculos
      const { data: cpData } = await supabase.from('candidatos_procesos').select('candidato_id, proceso_id')
      if (cpData) setVinculos(cpData)

      // 3. Obtener respuestas de video
      const { data: vData } = await supabase.from('respuestas_video').select('candidato_id, id')
      if (vData) setRespuestasVideo(vData)

      // 4. Obtener candidatos
      const { data: cData } = await supabase.from('candidatos').select('id, nombre, apellido, email')
      if (cData) setCandidatos(cData)

      // 5. Obtener sesiones con puntaje
      const { data: sData } = await supabase.from('sesiones').select('*')
      if (sData) setSesiones(sData)

    } catch (err) {
      console.error('Error cargando ranking de candidatos:', err)
    } finally {
      setCargando(false)
    }
  }

  // Métricas y Cálculos de la Tabla
  const rankingList = candidatos.map(c => {
    // Buscar proceso asociado al candidato
    const vinculo = vinculos.find(v => v.candidato_id === c.id)
    const procId = vinculo?.proceso_id
    const proc = procesos.find(p => p.id === procId)
    const bateria = proc?.bateria_tests || []

    // 1. Progreso de Batería
    let completadosCount = 0
    bateria.forEach((slug: string) => {
      // Encontrar si hay sesión finalizada para este test_id o slug
      const tId = Object.keys(TEST_IDS).find(k => TEST_IDS[k] === slug)
      const finalizado = sesiones.some(s => 
        s.candidato_id === c.id && 
        (s.test_id === tId || TEST_IDS[s.test_id] === slug) && 
        s.estado === 'finalizado'
      )
      if (finalizado) completadosCount++
    })
    const totalBateria = bateria.length
    const progresoPct = totalBateria > 0 ? Math.round((completadosCount / totalBateria) * 100) : 0

    // 2. Match Score (Big Five Match)
    const sBF = sesiones.find(s => s.candidato_id === c.id && TEST_IDS[s.test_id] === 'bigfive')
    const matchScore = sBF && sBF.puntaje_bruto ? calcularMatch(sBF.puntaje_bruto, proc) : null

    // 3. Role Play Score (sjt-cobranzas o sjt-atencion)
    const sRP = sesiones.find(s => 
      s.candidato_id === c.id && 
      (TEST_IDS[s.test_id] === 'sjt-cobranzas' || TEST_IDS[s.test_id] === 'sjt-atencion')
    )
    let scoreRP = 'Pendiente'
    if (sRP && sRP.estado === 'finalizado') {
      const factoresRP = Object.values(sRP.puntaje_bruto?.por_factor || {})
      if (factoresRP.length > 0) {
        const suma = factoresRP.reduce((acc: number, val: any) => acc + (Number(val) || 0), 0)
        const promRP = suma / factoresRP.length
        const escalaRP = promRP > 5 ? (promRP / 20) : promRP
        scoreRP = `${(Math.round(escalaRP * 10) / 10).toFixed(1)} / 5`
      } else if (sRP.puntaje_bruto?.puntaje !== undefined) {
        const p = Number(sRP.puntaje_bruto.puntaje)
        const escalaRP = p > 5 ? (p / 20) : p
        scoreRP = `${(Math.round(escalaRP * 10) / 10).toFixed(1)} / 5`
      } else {
        scoreRP = 'Completado'
      }
    }

    // 4. Videoentrevistas
    const tieneVideo = respuestasVideo.some(v => v.candidato_id === c.id)

    // 5. Alertas de Proctoring
    let totalAlertas = 0
    sesiones.filter(s => s.candidato_id === c.id).forEach(s => {
      const m = s.puntaje_bruto?.metricas_fraude as any
      if (m) {
        totalAlertas += (m.tabSwitches || 0) + (m.copyPasteAttempts || 0)
      }
    })

    return {
      ...c,
      procesoId: procId || 'ninguno',
      procesoNombre: proc?.nombre || 'Sin Proceso',
      progresoTexto: `${completadosCount} / ${totalBateria}`,
      progresoPct,
      matchScore,
      scoreRP,
      tieneVideo,
      totalAlertas
    }
  })

  // Helper para calcular match score basado en competencias del cargo
  function calcularMatch(pb: any, proc: any) {
    if (!pb || !proc || !proc.competencias_requeridas) return null
    
    // Mapeo básico para el cálculo rápido
    const mapping: any = {
      'extraversion': ['Extraversión', 'Liderazgo', 'Comunicación'],
      'amabilidad': ['Amabilidad', 'Trabajo en equipo', 'Orientación al cliente'],
      'responsabilidad': ['Responsabilidad', 'Orientación a resultados', 'Integridad'],
      'neuroticismo': ['Neuroticismo', 'Tolerancia a la presión', 'Autocontrol'],
      'apertura': ['Apertura', 'Adaptabilidad al cambio', 'Creatividad e innovación']
    }

    const norm: Record<string, number> = {}
    const aliasesMap: Record<string, string[]> = {
      extraversion: ['extraversion', 'Extraversión', 'extraversión', 'Extraversion', 'Extraversion_Score', 'Sociabilidad'],
      amabilidad: ['amabilidad', 'Amabilidad', 'Amabilidad_Score', 'Cordialidad', 'cordialidad', 'Afabilidad'],
      responsabilidad: ['responsabilidad', 'Responsabilidad', 'Responsabilidad_Score', 'Escrupulosidad', 'escrupulosidad', 'Organización'],
      neuroticismo: ['neuroticismo', 'Neuroticismo', 'Estabilidad_Emocional', 'Emocionalidad', 'emocionalidad', 'Afectividad'],
      apertura: ['apertura', 'Apertura', 'apertura_experiencia', 'Apertura_Score', 'Apertura a la experiencia', 'Creatividad']
    }

    Object.entries(aliasesMap).forEach(([key, aliases]) => {
      const found = aliases.find(a => pb[a] !== undefined)
      if (found) {
        let val = Number(pb[found])
        if (val > 5) val = val / 20
        norm[key] = val
      }
    })
    
    let sumMatch = 0
    let count = 0

    proc.competencias_requeridas.forEach((r: any) => {
      const factor = Object.keys(mapping).find(f => mapping[f].includes(r.nombre))
      if (factor) {
        let val = norm[factor] || 0
        if (factor === 'neuroticismo') val = 6 - val
        const ideal = r.nivel === 'A' ? 5 : r.nivel === 'B' ? 4 : 3
        const diff = Math.abs(val - ideal)
        sumMatch += Math.max(0, 1 - (diff / 3))
        count++
      }
    })

    return count > 0 ? Math.round((sumMatch / count) * 100) : null
  }

  // Filtrado de candidatos
  const listaFiltrada = rankingList.filter(item => {
    // Filtro por proceso
    if (procesoSeleccionado !== 'todos' && item.procesoId !== procesoSeleccionado) return false
    
    // Filtro por búsqueda
    if (busqueda) {
      const b = busqueda.toLowerCase()
      const nombreCompleto = `${item.nombre} ${item.apellido}`.toLowerCase()
      return nombreCompleto.includes(b) || item.email.toLowerCase().includes(b)
    }

    return true
  })

  // Ordenamiento de candidatos
  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    if (ordenCriterio === 'match') {
      return (b.matchScore || 0) - (a.matchScore || 0)
    }
    if (ordenCriterio === 'progreso') {
      return b.progresoPct - a.progresoPct
    }
    if (ordenCriterio === 'alertas') {
      return b.totalAlertas - a.totalAlertas
    }
    if (ordenCriterio === 'nombre') {
      return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    }
    return 0
  })

  // Métricas para tarjetas superiores
  const totalCandidatosProc = listaFiltrada.length
  
  const matchesFiltrados = listaFiltrada.map(c => c.matchScore).filter(Boolean) as number[]
  const calcePromedioProc = matchesFiltrados.length > 0 
    ? Math.round(matchesFiltrados.reduce((a, b) => a + b, 0) / matchesFiltrados.length) 
    : 0

  const completadosProc = listaFiltrada.filter(c => c.progresoPct >= 100).length

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
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ranking de Encaje y Avance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Visualiza y clasifica a los postulantes ordenados por nivel de calce (match) y progreso de evaluaciones
          </p>
        </div>

        <select
          value={procesoSeleccionado}
          onChange={(e) => setProcesoSeleccionado(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white shadow-sm hover:border-slate-300 outline-none transition-all"
        >
          <option value="todos">Todos los procesos</option>
          {procesos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tarjetas de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600"><Users className="w-6 h-6" /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Postulantes en Proceso</span>
            <span className="text-2xl font-bold text-slate-900 block mt-1">{totalCandidatosProc}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Calce (Match) Promedio</span>
            <span className="text-2xl font-bold text-slate-900 block mt-1">{calcePromedioProc}%</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-purple-50 rounded-2xl text-purple-600"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Baterías Finalizadas</span>
            <span className="text-2xl font-bold text-slate-900 block mt-1">{completadosProc} <span className="text-xs font-medium text-slate-400">candidatos</span></span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros de la Tabla */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Buscador */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Criterio de Orden */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <span className="text-xs font-bold text-slate-450 uppercase tracking-wider flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5" /> Ordenar por:</span>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {[
              { id: 'match', label: 'Match %' },
              { id: 'progreso', label: 'Progreso' },
              { id: 'alertas', label: 'Fraudes' },
              { id: 'nombre', label: 'Nombre' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setOrdenCriterio(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  ordenCriterio === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de Ranking de Candidatos */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Puesto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidato</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Progreso Batería</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Match Encaje</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Simulación Role Play</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Videoentrevista</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Alertas Integridad</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaOrdenada.map((item, idx) => {
                const esMatchAlto = item.matchScore && item.matchScore >= 75
                const esMatchBajo = item.matchScore && item.matchScore < 50
                const esAlertaCritica = item.totalAlertas >= 10

                return (
                  <tr key={item.id} className="hover:bg-slate-50/40 transition-colors group">
                    {/* Puesto / Ranking */}
                    <td className="px-6 py-4.5">
                      <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center">
                        #{idx + 1}
                      </span>
                    </td>

                    {/* Candidato Info */}
                    <td className="px-6 py-4.5">
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {item.nombre} {item.apellido}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.email}</div>
                    </td>

                    {/* Progreso de la Batería */}
                    <td className="px-6 py-4.5 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">{item.progresoTexto} tests</span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                            style={{ width: `${item.progresoPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Match Encaje */}
                    <td className="px-6 py-4.5 text-center">
                      {item.matchScore !== null ? (
                        <div className={`inline-flex items-center justify-center w-11 h-11 rounded-full border-4 font-bold text-xs ${
                          esMatchAlto ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 
                          esMatchBajo ? 'border-amber-400 bg-amber-50 text-amber-700' : 
                          'border-indigo-400 bg-indigo-50 text-indigo-700'
                        }`}>
                          {item.matchScore}%
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">—</span>
                      )}
                    </td>

                    {/* Simulación Role Play */}
                    <td className="px-6 py-4.5 text-center">
                      {item.scoreRP !== 'Pendiente' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl">
                          <Award className="w-3.5 h-3.5 text-indigo-600" /> {item.scoreRP}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-350 italic font-bold">Pendiente</span>
                      )}
                    </td>

                    {/* Videoentrevista */}
                    <td className="px-6 py-4.5 text-center">
                      {item.tieneVideo ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl uppercase tracking-wider">
                          <Video className="w-3.5 h-3.5" /> Completada
                        </span>
                      ) : (
                        <span className="text-xs text-slate-350 italic font-bold">Pendiente</span>
                      )}
                    </td>

                    {/* Alertas Integridad */}
                    <td className="px-6 py-4.5 text-center">
                      {item.totalAlertas > 0 ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl ${
                          esAlertaCritica ? 'bg-red-50 text-red-700 border border-red-100 animate-pulse' : 'bg-amber-50 text-amber-700'
                        }`}>
                          <AlertTriangle className="w-3.5 h-3.5" /> {item.totalAlertas}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-100">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                          Seguro
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4.5 text-right">
                      <button
                        onClick={() => router.push(`/panel?candidato=${item.id}`)}
                        className="p-2 bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1 text-xs font-bold ml-auto"
                        title="Ver Ficha y descargar PDF"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver Ficha
                      </button>
                    </td>
                  </tr>
                )
              })}
              {listaOrdenada.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    No se encontraron candidatos que coincidan con la búsqueda o proceso seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}