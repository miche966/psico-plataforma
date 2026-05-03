'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { FileText, Download, X, Search, AlertTriangle, BellRing, Clock, History } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

interface Sesion {
  id: string
  finalizada_en: string
  puntaje_bruto: Record<string, unknown>
  candidato_id: string | null
  candidato?: Candidato
}

const BIG_FIVE_KEYS = ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura']

function esBigFive(pb: Record<string, unknown>): boolean {
  return BIG_FIVE_KEYS.some(k => k in pb)
}

function esCognitivo(pb: Record<string, unknown>): boolean {
  return 'correctas' in pb && 'total' in pb
}

function valoresNumericos(pb: Record<string, unknown>): [string, number][] {
  return Object.entries(pb).filter((e): e is [string, number] => typeof e[1] === 'number')
}

function promedioPuntaje(pb: Record<string, unknown>): number {
  const nums = valoresNumericos(pb).map(([, v]) => v)
  if (!nums.length) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function datosCognitivos(pb: Record<string, unknown>) {
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
  progreso?: {
    total: number
    completados: number
    tests_pendientes: string[]
  }
}

export default function PanelPage() {
  const [candidatosAgrupados, setCandidatosAgrupados] = useState<CandidatoAgrupado[]>([])
  const [cargando, setCargando] = useState(true)
  const [agrupadoSeleccionado, setAgrupadoSeleccionado] = useState<CandidatoAgrupado | null>(null)
  const [sesionSeleccionada, setSesionSeleccionada] = useState<Sesion | null>(null)
  const [filtro, setFiltro] = useState('')
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
  }, [])

  useEffect(() => {
    cargarSesiones()
  }, [])

  async function cargarSesiones() {
    // 1. Cargar todas las sesiones
    const { data: sesionesData } = await supabase
      .from('sesiones')
      .select('*')
      .order('finalizada_en', { ascending: false })

    // 2. Cargar todos los procesos (para saber la batería de tests)
    const { data: procesosData } = await supabase
      .from('procesos')
      .select('id, nombre, cargo, bateria_tests')

    // 3. Cargar todas las videoentrevistas respondidas
    const { data: respuestasVideo } = await supabase
      .from('respuestas_video')
      .select('candidato_id, entrevista_id')

    // 4. Cargar candidatos
    const { data: candidatosData } = await supabase
      .from('candidatos')
      .select('id, nombre, apellido, email')

    const candidatos = candidatosData || []
    const grupos: Record<string, CandidatoAgrupado> = {}
    
    sesionesData?.forEach(sesion => {
      const cId = sesion.candidato_id || 'anonimo'
      const cand = candidatos.find(c => c.id === cId)
      
      if (!grupos[cId]) {
        const proceso = procesosData?.find(p => p.id === sesion.proceso_id)
        
        // Calcular progreso
        let progreso = undefined
        if (proceso && proceso.bateria_tests) {
          const bateria = proceso.bateria_tests as string[]
          const misSesiones = sesionesData?.filter(s => s.candidato_id === cId) || []
          const misVideos = respuestasVideo?.filter(rv => rv.candidato_id === cId) || []
          
          const idsCompletados = [
            ...misSesiones.map(s => (s as any).test_id).filter(Boolean),
            ...misVideos.map(v => `entrevista:${v.entrevista_id}`)
          ]
          
          const unicosCompletados = Array.from(new Set(idsCompletados))
          const pendientes = bateria.filter(tId => !unicosCompletados.includes(tId))
          
          progreso = {
            total: bateria.length,
            completados: bateria.length - pendientes.length,
            tests_pendientes: pendientes
          }
        }

        grupos[cId] = {
          id: cId,
          nombre: cand?.nombre || 'Evaluación',
          apellido: cand?.apellido || 'Anónima',
          email: cand?.email || '',
          sesiones: [],
          ultima_fecha: sesion.finalizada_en,
          proceso_id: sesion.proceso_id,
          proceso_nombre: proceso?.nombre,
          proceso_cargo: proceso?.cargo,
          progreso
        }
      }
      
      grupos[cId].sesiones.push({
        ...sesion,
        candidato: cand
      })
    })

    setCandidatosAgrupados(Object.values(grupos))
    setCargando(false)
  }

  function formatearFecha(fecha: string) {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-AR', {
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

  const candidatosFiltrados = candidatosAgrupados.filter(c => 
    `${c.nombre} ${c.apellido} ${c.proceso_nombre} ${c.proceso_cargo}`.toLowerCase().includes(filtro.toLowerCase()) || 
    c.email.toLowerCase().includes(filtro.toLowerCase())
  )

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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Panel del evaluador</h1>
          <p className="text-sm text-slate-500 mt-1">
            {candidatosAgrupados.length} candidato{candidatosAgrupados.length !== 1 ? 's' : ''} con evaluaciones
          </p>
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre, email o proceso..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      {candidatosAgrupados.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="text-slate-500 mb-4">No hay evaluaciones todavía.</p>
          <a href="/candidatos" className="text-indigo-600 font-medium hover:text-indigo-700">Ir a candidatos →</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LISTA DE CANDIDATOS */}
          <div className="flex flex-col gap-3">
            {candidatosFiltrados.map(c => (
              <div
                key={c.id}
                onClick={() => {
                  setAgrupadoSeleccionado(c)
                  setSesionSeleccionada(c.sesiones[0]) // Seleccionar la más reciente por defecto
                }}
                className={`p-4 rounded-xl border bg-white cursor-pointer transition-all duration-200 hover:shadow-md ${
                  agrupadoSeleccionado?.id === c.id 
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="mt-1">
                      {c.progreso && c.progreso.completados < c.progreso.total && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            enviarRecordatorio(c)
                          }}
                          disabled={enviandoRecordatorio === c.id}
                          className={`p-2 rounded-lg transition-all ${
                            enviandoRecordatorio === c.id
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:scale-110 shadow-sm'
                          }`}
                          title="Enviar recordatorio de tests pendientes"
                        >
                          {enviandoRecordatorio === c.id ? (
                            <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <BellRing className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 leading-tight">{c.nombre} {c.apellido}</div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-1">{c.proceso_nombre || 'Proceso independiente'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{c.email || 'Sin email'}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100 uppercase tracking-wider">
                      {c.sesiones.length} {c.sesiones.length === 1 ? 'test' : 'tests'}
                    </span>
                    {c.progreso && (
                      <div className="flex flex-col items-end gap-1 mt-1">
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full" 
                            style={{ width: `${(c.progreso.completados / c.progreso.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold">{c.progreso.completados}/{c.progreso.total} COMPLETADOS</span>
                      </div>
                    )}
                    <span className="text-[9px] text-slate-300 mt-1">{formatearFecha(c.ultima_fecha)}</span>
                  </div>
                </div>
              </div>
            ))}
            {candidatosFiltrados.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No se encontraron candidatos para la búsqueda.
              </div>
            )}
          </div>

          {/* DETALLE DEL CANDIDATO SELECCIONADO */}
          <div className="sticky top-6">
            {agrupadoSeleccionado ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{agrupadoSeleccionado.nombre} {agrupadoSeleccionado.apellido}</h2>
                    <p className="text-sm text-slate-500">{agrupadoSeleccionado.email}</p>
                  </div>
                  <button onClick={() => setAgrupadoSeleccionado(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tests realizados</p>
                  <div className="flex flex-wrap gap-2">
                    {agrupadoSeleccionado.sesiones.map(s => {
                      const pb = s.puntaje_bruto
                      let label = (s as any).test_id ? TEST_NAMES[(s as any).test_id] : null
                      
                      if (!label) {
                        if (esBigFive(pb)) label = 'Psicográfico'
                        else if (esCognitivo(pb)) label = 'Cognitivo'
                        else label = 'Evaluación'
                      }
                      
                      const isActive = sesionSeleccionada?.id === s.id
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSesionSeleccionada(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            isActive 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {label} ({formatearFecha(s.finalizada_en).split(' ')[0]})
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* DETALLE DEL TEST SELECCIONADO */}
                {sesionSeleccionada && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-700 uppercase">Resultados detallados</div>
                      <a
                        href={`/informe?candidato=${agrupadoSeleccionado.id}`}
                        target="_blank"
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Ver informe completo →
                      </a>
                    </div>

                    <div className="space-y-5 mt-6">
                      {sesionSeleccionada.puntaje_bruto && (() => {
                        const pb = sesionSeleccionada.puntaje_bruto as any
                        const metricas = pb.metricas_fraude
                        const hasFraude = metricas && (metricas.tabSwitches > 0 || metricas.copyPasteAttempts > 0)

                        return (
                          <>
                            {hasFraude && (
                              <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  Alerta Anti-Fraude
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div className="bg-white/50 p-2 rounded-lg border border-red-200">
                                    <span className="text-slate-500 block mb-0.5">Cambios de pestaña</span>
                                    <span className="text-red-700 font-bold text-base">{metricas.tabSwitches}</span>
                                  </div>
                                  <div className="bg-white/50 p-2 rounded-lg border border-red-200">
                                    <span className="text-slate-500 block mb-0.5">Copy/paste</span>
                                    <span className="text-red-700 font-bold text-base">{metricas.copyPasteAttempts}</span>
                                  </div>
                                </div>
                                
                                {metricas.events && metricas.events.length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-red-100">
                                    <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                      <History className="w-3 h-3" />
                                      Diario de incidencias
                                    </p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                      {metricas.events.map((ev: any, idx: number) => {
                                        const hora = new Date(ev.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                        let label = 'Evento'
                                        let color = 'bg-slate-200 text-slate-600'
                                        
                                        if (ev.tipo === 'tab_switch' || ev.tipo === 'blur') {
                                          label = 'Cambio de pestaña / Foco perdido'
                                          color = 'bg-amber-100 text-amber-700 border-amber-200'
                                        } else if (ev.tipo === 'copy_paste') {
                                          label = 'Intento de Copy/Paste'
                                          color = 'bg-red-100 text-red-700 border-red-200'
                                        } else if (ev.tipo === 'context_menu') {
                                          label = 'Click derecho (Menú contextual)'
                                          color = 'bg-purple-100 text-purple-700 border-purple-200'
                                        }

                                        return (
                                          <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border text-[10px] font-medium ${color}`}>
                                            <span>{label}</span>
                                            <span className="font-bold opacity-70">{hora}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {esBigFive(pb) ? valoresNumericos(pb).map(([factor, valor]) => {
                              const tc = textColores[factor] || 'text-indigo-600'
                              const bgc = colores[factor] || 'bg-indigo-600'
                              return (
                                <div key={factor}>
                                  <div className="flex justify-between mb-1.5">
                                    <span className="text-sm font-semibold text-slate-800">{etiquetas[factor] || factor}</span>
                                    <span className={`text-sm font-bold ${tc}`}>{valor} / 5</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                    <div className={`h-full rounded-full transition-all duration-500 ease-out ${bgc}`} style={{ width: `${(valor / 5) * 100}%` }} />
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed">{interpretacion(factor, valor)}</p>
                                </div>
                              )
                            }) : esCognitivo(pb) ? (() => {
                              const { correctas, total, pct } = datosCognitivos(pb)
                              const nivel = pct >= 80 ? 'Alto' : pct >= 60 ? 'Moderado' : 'En desarrollo'
                              const colorBg = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-orange-500' : 'bg-red-500'
                              const colorText = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-orange-600' : 'text-red-600'
                              
                              return (
                                <div>
                                  <div className="flex justify-between mb-1.5">
                                    <span className="text-sm font-semibold text-slate-800">Resultado Cognitivo</span>
                                    <span className={`text-sm font-bold ${colorText}`}>{correctas} / {total} ({pct}%)</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                    <div className={`h-full rounded-full transition-all duration-500 ease-out ${colorBg}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed">Desempeño detectado: {nivel}</p>
                                </div>
                              )
                            })() : (() => {
                              const prom = promedioPuntaje(pb)
                              const colorBg = prom >= 4 ? 'bg-green-500' : prom >= 3 ? 'bg-orange-500' : 'bg-red-500'
                              const colorText = prom >= 4 ? 'text-green-600' : prom >= 3 ? 'text-orange-600' : 'text-red-600'
                              
                              return (
                                <div>
                                  <div className="flex justify-between mb-1.5">
                                    <span className="text-sm font-semibold text-slate-800">Promedio general</span>
                                    <span className={`text-sm font-bold ${colorText}`}>{prom} / 5</span>
                                  </div>
                                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                    <div className={`h-full rounded-full transition-all duration-500 ease-out ${colorBg}`} style={{ width: `${Math.min((prom / 5) * 100, 100)}%` }} />
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed">
                                    {prom >= 4 ? 'Nivel alto' : prom >= 3 ? 'Nivel moderado' : 'En desarrollo'}
                                  </p>
                                </div>
                              )
                            })()}
                          </>
                        )
                      })()}
                    </div>

                    <div className="mt-8 flex gap-3">
                      <button
                        onClick={() => generarPDF(sesionSeleccionada)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-200"
                      >
                        <Download className="w-4 h-4" />
                        Descargar PDF del test
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center h-64">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 mb-1">Ningún candidato seleccionado</h3>
                <p className="text-xs text-slate-500 max-w-[200px]">Selecciona un postulante de la lista para ver el desglose de sus evaluaciones.</p>
              </div>
            )}
          </div>
        </div>
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