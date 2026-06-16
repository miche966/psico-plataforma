'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Activity, RefreshCw, AlertCircle, Play, CheckCircle, XCircle, Search, 
  Terminal, ShieldAlert, ShieldCheck, ArrowRight, User, Clock, Info, Trash2
} from 'lucide-react'

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
  'e9b2c3d4-f5a6-7890-bcde-999999999999': 'SJT Cobranzas',
}

interface LogEvent {
  id: string
  candidato_id: string
  candidato: { nombre: string; apellido: string; email: string }
  fecha: string
  tipo: 'test_iniciado' | 'test_completado' | 'test_interrumpido' | 'test_reseteado' | 'video_completado' | 'video_fallido'
  testName: string
  badgeClass: string
  icon: any
  detalles: string
  metadata?: any
  raw: any
}

export default function DiagnosticoRealtime() {
  const [eventos, setEventos] = useState<LogEvent[]>([])
  const [cargando, setCargando] = useState(true)
  const [autoActualizar, setAutoActualizar] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'errores' | 'videos' | 'tests'>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [eventoSeleccionado, setEventoSeleccionado] = useState<LogEvent | null>(null)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const cargarLogs = async () => {
    try {
      // 1. Cargar ultimas sesiones
      const { data: sesiones } = await supabase
        .from('sesiones')
        .select(`
          id,
          test_id,
          estado,
          creado_en,
          finalizada_en,
          candidato_id,
          candidatos (id, nombre, apellido, email),
          procesos (id, nombre, cargo)
        `)
        .order('creado_en', { ascending: false })
        .limit(100)

      // 2. Cargar ultimas respuestas de video
      const { data: videos } = await supabase
        .from('respuestas_video')
        .select(`
          id,
          pregunta_id,
          candidato_id,
          entrevista_id,
          url_video,
          estado,
          transcripcion,
          analisis,
          creado_en,
          candidatos (id, nombre, apellido, email)
        `)
        .order('creado_en', { ascending: false })
        .limit(100)

      const merged: LogEvent[] = []

      // Procesar sesiones
      sesiones?.forEach((s: any) => {
        if (!s.candidatos) return
        
        let tipo: LogEvent['tipo'] = 'test_iniciado'
        let detalles = `Sesión en estado "${s.estado}"`
        let badgeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
        let icon = Play

        if (s.estado === 'finalizado') {
          tipo = 'test_completado'
          detalles = 'Completó la evaluación correctamente'
          badgeClass = 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
          icon = CheckCircle
        } else if (s.estado === 'interrumpido') {
          tipo = 'test_interrumpido'
          detalles = 'Acceso bloqueado por proctoring (cierre/recarga de pestaña)'
          badgeClass = 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
          icon = ShieldAlert
        } else if (s.estado === 'en_progreso') {
          tipo = 'test_reseteado'
          detalles = 'Habilitado por el reclutador para retomar la prueba'
          badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
          icon = ShieldCheck
        }

        merged.push({
          id: s.id,
          candidato_id: s.candidato_id,
          candidato: s.candidatos,
          fecha: s.creado_en,
          tipo,
          testName: TEST_NAMES[s.test_id] || s.test_id,
          badgeClass,
          icon,
          detalles,
          raw: s
        })
      })

      // Procesar videos
      videos?.forEach((v: any) => {
        if (!v.candidatos) return

        let tipo: LogEvent['tipo'] = 'video_completado'
        let detalles = 'Video cargado exitosamente'
        let badgeClass = 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
        let icon = CheckCircle

        if (v.estado === 'error_upload') {
          tipo = 'video_fallido'
          detalles = v.transcripcion || 'Excepción durante la subida al Storage'
          badgeClass = 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
          icon = XCircle
        }

        merged.push({
          id: v.id,
          candidato_id: v.candidato_id,
          candidato: v.candidatos,
          fecha: v.creado_en,
          tipo,
          testName: 'Videoentrevista',
          badgeClass,
          icon,
          detalles,
          metadata: v.analisis,
          raw: v
        })
      })

      // Ordenar por fecha descendente
      merged.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      setEventos(merged)
    } catch (err) {
      console.error('Error cargando logs de diagnóstico:', err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarLogs()
  }, [])

  useEffect(() => {
    if (autoActualizar) {
      timerRef.current = setInterval(() => {
        cargarLogs()
      }, 5000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoActualizar])

  const resetearSesion = async (sesionId: string) => {
    setProcesandoId(sesionId)
    try {
      const { error } = await supabase
        .from('sesiones')
        .update({ estado: 'en_progreso' })
        .eq('id', sesionId)

      if (error) throw error
      alert('Sesión habilitada. El candidato podrá reiniciar esta prueba en cuanto recargue su portal.')
      cargarLogs()
      if (eventoSeleccionado?.id === sesionId) {
        setEventoSeleccionado(null)
      }
    } catch (err: any) {
      alert('Error al habilitar la sesión: ' + err.message)
    } finally {
      setProcesandoId(null)
    }
  }

  const borrarErrorVideo = async (videoId: string) => {
    if (!confirm('¿Seguro de limpiar este registro de fallo? Esto removerá el registro del intento fallido para que el portal del candidato reconozca la prueba como pendiente.')) return
    setProcesandoId(videoId)
    try {
      const { error } = await supabase
        .from('respuestas_video')
        .delete()
        .eq('id', videoId)

      if (error) throw error
      alert('Log de error borrado. El candidato ahora tiene la videoentrevista desbloqueada para volver a intentar.')
      cargarLogs()
      if (eventoSeleccionado?.id === videoId) {
        setEventoSeleccionado(null)
      }
    } catch (err: any) {
      alert('Error al borrar el error de video: ' + err.message)
    } finally {
      setProcesandoId(null)
    }
  }

  const formatearFechaLog = (fecha: string) => {
    if (!fecha) return ''
    const d = new Date(fecha)
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  }

  const eventosFiltrados = eventos.filter(e => {
    // 1. Filtro por Tipo de Suceso
    if (filtro === 'errores') {
      if (e.tipo !== 'video_fallido' && e.tipo !== 'test_interrumpido') return false
    } else if (filtro === 'videos') {
      if (e.tipo !== 'video_completado' && e.tipo !== 'video_fallido') return false
    } else if (filtro === 'tests') {
      if (e.tipo === 'video_completado' || e.tipo === 'video_fallido') return false
    }

    // 2. Filtro por Búsqueda de Texto
    if (busqueda.trim()) {
      const query = busqueda.toLowerCase()
      const matchCandidate = `${e.candidato.nombre} ${e.candidato.apellido} ${e.candidato.email}`.toLowerCase().includes(query)
      const matchTest = e.testName.toLowerCase().includes(query)
      const matchDetail = e.detalles.toLowerCase().includes(query)
      return matchCandidate || matchTest || matchDetail
    }

    return true
  })

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col h-[calc(100vh-220px)] font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Panel Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800 pb-5 mb-6 shrink-0 relative z-10">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2.5 tracking-tight text-white">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Consola de Diagnóstico en Tiempo Real
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitorea el progreso de tests, interrupciones de seguridad y excepciones en la subida de video de forma inmediata.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
            <span className="relative flex h-2.5 w-2.5">
              {autoActualizar && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoActualizar ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
            </span>
            <input 
              type="checkbox" 
              checked={autoActualizar} 
              onChange={() => setAutoActualizar(!autoActualizar)} 
              className="hidden"
            />
            <span className="text-xs font-bold text-slate-300">Monitoreo Activo (5s)</span>
          </label>

          <button 
            onClick={() => { setCargando(true); cargarLogs(); }}
            disabled={cargando}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-indigo-500/10 transition-all active:scale-95"
            title="Refrescar logs ahora"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 shrink-0 relative z-10">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por candidato, test o detalles de error..."
            value={busqueda}
            onChange={(e) => setFiltro('todos') || setBusqueda(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-700 transition-all"
          />
        </div>

        <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          {[
            { key: 'todos', label: 'Todos los Sucesos' },
            { key: 'errores', label: 'Solo Errores' },
            { key: 'videos', label: 'Videoentrevistas' },
            { key: 'tests', label: 'Ejercicios' }
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setFiltro(opt.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filtro === opt.key 
                  ? 'bg-slate-800 text-white shadow-md' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Logs Timeline */}
        <div className={`flex flex-col ${eventoSeleccionado ? 'lg:col-span-7' : 'lg:col-span-12'} bg-slate-950/40 border border-slate-800/80 rounded-2xl overflow-hidden`}>
          <div className="bg-slate-950/60 border-b border-slate-800/60 px-4 py-3 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>Registro Cronológico ({eventosFiltrados.length})</span>
            <span>Estable</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar-visible divide-y divide-slate-900">
            {cargando && eventos.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center gap-3 py-20 text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                <span className="text-sm font-medium">Iniciando consola de logs...</span>
              </div>
            ) : eventosFiltrados.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center py-20 text-slate-500">
                <Info className="w-10 h-10 text-slate-700 mb-3" />
                <span className="text-sm font-medium italic">No se encontraron sucesos de diagnóstico.</span>
              </div>
            ) : (
              eventosFiltrados.map((e) => {
                const IconComponent = e.icon
                const isSelected = eventoSeleccionado?.id === e.id
                return (
                  <div 
                    key={e.id}
                    onClick={() => setEventoSeleccionado(e)}
                    className={`p-4 flex gap-4 hover:bg-slate-800/20 cursor-pointer transition-all ${
                      isSelected ? 'bg-slate-800/35 border-l-4 border-l-indigo-500 pl-3' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                      e.tipo === 'video_fallido' || e.tipo === 'test_interrumpido'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : e.tipo === 'test_reseteado'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {e.candidato.nombre} {e.candidato.apellido}
                          </span>
                          <span className="text-[10px] text-slate-400">{e.candidato.email}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 whitespace-nowrap align-self-start sm:align-self-auto">
                          {formatearFechaLog(e.fecha)}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {e.testName}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          e.tipo === 'video_fallido' || e.tipo === 'test_interrumpido'
                            ? 'bg-red-950/40 text-red-400 border border-red-900/30'
                            : e.tipo === 'test_reseteado'
                            ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30'
                            : 'bg-emerald-950/40 text-emerald-400 border border-emerald-950/30'
                        }`}>
                          {e.tipo.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 mt-2 leading-relaxed truncate font-mono">
                        {e.detalles}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Selected Event Details (Drawer/Panel on the right) */}
        {eventoSeleccionado && (
          <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4 shrink-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                Detalles del Suceso
              </h3>
              <button 
                onClick={() => setEventoSeleccionado(null)} 
                className="text-xs text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-900 rounded"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scrollbar-visible">
              {/* Candidate Card */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Postulante</div>
                <div className="text-sm font-bold text-white">{eventoSeleccionado.candidato.nombre} {eventoSeleccionado.candidato.apellido}</div>
                <div className="text-xs text-slate-400">{eventoSeleccionado.candidato.email}</div>
                <div className="text-[10px] text-slate-500 font-mono select-all">ID: {eventoSeleccionado.candidato_id}</div>
              </div>

              {/* Event Metadata */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Suceso</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-850">
                    <span className="text-[10px] text-slate-500 block mb-0.5">Fecha</span>
                    <span className="font-bold text-slate-300">{formatearFechaLog(eventoSeleccionado.fecha)}</span>
                  </div>
                  <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-850">
                    <span className="text-[10px] text-slate-500 block mb-0.5">Tipo de Evento</span>
                    <span className="font-bold text-indigo-400 uppercase text-[10px]">{eventoSeleccionado.tipo.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Log Output Console */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Consola / Traza del Proceso</div>
                <div className="bg-black/80 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-red-400 whitespace-pre-wrap leading-relaxed max-h-[180px] overflow-y-auto">
                  {eventoSeleccionado.tipo === 'video_fallido' ? (
                    eventoSeleccionado.raw.transcripcion
                  ) : (
                    eventoSeleccionado.detalles
                  )}
                </div>
              </div>

              {/* Client Metadata (Device info on video upload) */}
              {eventoSeleccionado.metadata && (
                <div className="space-y-2 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Metadata de Red & Dispositivo</div>
                  <div className="space-y-1.5 text-xs">
                    {eventoSeleccionado.metadata.blobSize && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tamaño del archivo:</span>
                        <span className="font-semibold text-slate-300">{(eventoSeleccionado.metadata.blobSize / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    )}
                    {eventoSeleccionado.metadata.chunksCount && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Segmentos de Video:</span>
                        <span className="font-semibold text-slate-300">{eventoSeleccionado.metadata.chunksCount} chunks</span>
                      </div>
                    )}
                    {eventoSeleccionado.metadata.userAgent && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-slate-500 block mb-1">Navegador del Candidato:</span>
                        <span className="font-mono text-[10px] text-slate-400 break-all leading-normal block">{eventoSeleccionado.metadata.userAgent}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostic Action Bar */}
            <div className="border-t border-slate-800 pt-4 mt-4 shrink-0 flex gap-2">
              {eventoSeleccionado.tipo === 'test_interrumpido' && (
                <button
                  onClick={() => resetearSesion(eventoSeleccionado.id)}
                  disabled={procesandoId !== null}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-600/10"
                >
                  {procesandoId === eventoSeleccionado.id ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Habilitar Acceso / Resetear Test
                    </>
                  )}
                </button>
              )}

              {eventoSeleccionado.tipo === 'video_fallido' && (
                <button
                  onClick={() => borrarErrorVideo(eventoSeleccionado.id)}
                  disabled={procesandoId !== null}
                  className="flex-1 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-400 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {procesandoId === eventoSeleccionado.id ? (
                    <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Borrar Error (Habilitar Grabar)
                    </>
                  )}
                </button>
              )}

              <a
                href={`/informe?candidato=${eventoSeleccionado.candidato_id}`}
                target="_blank"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                Informe
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
