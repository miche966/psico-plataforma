'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { Plus, Check, Link as LinkIcon, Search, FileText, X, Video, Eye, Settings } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'

const TESTS_DISPONIBLES = [
  { key: 'bigfive', label: 'Big Five' },
  { key: 'hexaco', label: 'HEXACO' },
  { key: 'numerico', label: 'Numérico' },
  { key: 'verbal', label: 'Verbal' },
  { key: 'integridad', label: 'Integridad' },
  { key: 'icar', label: 'ICAR' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'sjt-comercial', label: 'SJT Comercial' },
  { key: 'tolerancia-frustracion', label: 'Tol. Frustración' },
  { key: 'sjt-cobranzas', label: 'SJT Cobranzas' },
  { key: 'sjt-atencion', label: 'SJT Atención' },
  { key: 'sjt-ventas', label: 'SJT Ventas' },
  { key: 'atencion-detalle', label: 'At. Detalle' },
  { key: 'sjt-legal', label: 'SJT Legal' },
  { key: 'estres-laboral', label: 'Estrés Laboral' },
  { key: 'creatividad', label: 'Creatividad' },
  { key: 'sjt-problemas', label: 'SJT Problemas' },
]

const COMPETENCIAS_ALLES = [
  'Orientación al cliente', 'Orientación a resultados', 'Trabajo en equipo', 'Adaptabilidad al cambio',
  'Integridad', 'Iniciativa', 'Liderazgo', 'Comunicación', 'Negociación', 'Planificación y organización',
  'Tolerancia a la presión', 'Pensamiento analítico', 'Creatividad e innovación', 'Desarrollo de relaciones',
  'Autocontrol', 'Orientación al logro', 'Flexibilidad', 'Conciencia organizacional', 'Responsabilidad', 'Ética profesional'
]

interface Proceso {
  id: string
  nombre: string
  cargo: string
  descripcion: string
  activo: boolean
  creado_en: string
  bateria_tests?: string[]
  total_candidatos?: number
  descripcion_cargo?: string
  competencias_requeridas?: { nombre: string; nivel: string }[]
}

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

export default function ProcesosPage() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [entrevistas, setEntrevistas] = useState<{ id: string, nombre: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<Proceso | null>(null)
  const [candidatosProceso, setCandidatosProceso] = useState<Candidato[]>([])
  const [editandoBateria, setEditandoBateria] = useState(false)
  const [bateriaEdit, setBateriaEdit] = useState<string[]>([])
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [form, setForm] = useState({ 
    nombre: '', cargo: '', descripcion: '', descripcion_cargo: '', bateria_tests: [] as string[],
    competencias_requeridas: [] as { nombre: string; nivel: string }[] 
  })
  const [guardando, setGuardando] = useState(false)
  const [agregando, setAgregando] = useState('')
  const [filtro, setFiltro] = useState('')
  const [previewEntrevista, setPreviewEntrevista] = useState<{ nombre: string, preguntas: any[] } | null>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: procesosData } = await supabase
      .from('procesos')
      .select('*')
      .order('creado_en', { ascending: false })

    const { data: candidatosData } = await supabase
      .from('candidatos')
      .select('id, nombre, apellido, email')
      .order('creado_en', { ascending: false })

    // Intento con ordenamiento
    let { data: entrevistasData, error: entError } = await supabase
      .from('entrevistas_video')
      .select('id, nombre')
      .order('created_at', { ascending: false })

    // Fallback si falla el ordenamiento
    if (entError) {
      console.warn('Fallo ordenamiento de entrevistas, reintentando simple...');
      const { data: simpleData } = await supabase.from('entrevistas_video').select('id, nombre')
      entrevistasData = simpleData
    }

    setProcesos(procesosData || [])
    setCandidatos(candidatosData || [])
    setEntrevistas(entrevistasData || [])
    setCargando(false)
  }

  async function guardarProceso() {
    if (!form.nombre || !form.cargo) return
    setGuardando(true)

    const { error } = await supabase
      .from('procesos')
      .insert({
        nombre: form.nombre,
        cargo: form.cargo,
        descripcion: form.descripcion,
        descripcion_cargo: form.descripcion_cargo,
        competencias_requeridas: form.competencias_requeridas,
        activo: true,
        bateria_tests: form.bateria_tests
      })

    if (!error) {
      setForm({ nombre: '', cargo: '', descripcion: '', descripcion_cargo: '', bateria_tests: [], competencias_requeridas: [] })
      setMostrarForm(false)
      cargarDatos()
    }
    setGuardando(false)
  }

  async function guardarEdicionBateria() {
    if (!procesoSeleccionado) return
    setGuardandoEdicion(true)

    const { error } = await supabase
      .from('procesos')
      .update({ bateria_tests: bateriaEdit })
      .eq('id', procesoSeleccionado.id)

    if (!error) {
      setProcesoSeleccionado({ ...procesoSeleccionado, bateria_tests: bateriaEdit })
      setProcesos(procesos.map(p => p.id === procesoSeleccionado.id ? { ...p, bateria_tests: bateriaEdit } : p))
      setEditandoBateria(false)
    }
    setGuardandoEdicion(false)
  }

  async function verCandidatosProceso(proceso: Proceso) {
    setProcesoSeleccionado(proceso)
    setEditandoBateria(false)

    const { data: sesiones } = await supabase
      .from('sesiones')
      .select('candidato_id')
      .eq('proceso_id', proceso.id)
      .not('candidato_id', 'is', null)

    const ids = sesiones?.map(s => s.candidato_id) || []

    if (ids.length > 0) {
      const { data } = await supabase
        .from('candidatos')
        .select('id, nombre, apellido, email')
        .in('id', ids)
      setCandidatosProceso(data || [])
    } else {
      setCandidatosProceso([])
    }
  }

  async function asignarCandidato(candidatoId: string) {
    if (!procesoSeleccionado) return
    setAgregando(candidatoId)

    const link = `${getBaseUrl()}/evaluacion?candidato=${candidatoId}&proceso=${procesoSeleccionado.id}`
    navigator.clipboard.writeText(link)

    const ya = candidatosProceso.find(c => c.id === candidatoId)
    if (!ya) {
      const candidato = candidatos.find(c => c.id === candidatoId)
      if (candidato) setCandidatosProceso(prev => [...prev, candidato])
    }

    setTimeout(() => setAgregando(''), 1500)
  }

  async function verPreviewEntrevista(id: string, nombre: string) {
    setCargandoPreview(true)
    const { data } = await supabase
      .from('preguntas_video')
      .select('*')
      .eq('entrevista_id', id)
      .order('orden')
    
    setPreviewEntrevista({ nombre, preguntas: data || [] })
    setCargandoPreview(false)
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  const procesosFiltrados = procesos.filter(p => 
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    p.cargo.toLowerCase().includes(filtro.toLowerCase())
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Procesos de selección</h1>
          <p className="text-sm text-slate-500 mt-1">
            {procesos.length} proceso{procesos.length !== 1 ? 's' : ''} registrado{procesos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button 
          onClick={() => setMostrarForm(!mostrarForm)}
          className={`px-4 py-2 font-medium rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2 ${
            mostrarForm 
              ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' 
              : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent'
          }`}
        >
          {mostrarForm ? 'Cancelar' : <><Plus className="w-4 h-4" /> Nuevo proceso</>}
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Nuevo proceso de selección</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre del proceso *</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Selección Analistas Q2 2026"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Cargo *</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.cargo}
                onChange={e => setForm({ ...form, cargo: e.target.value })}
                placeholder="Ej: Analista de Crédito"
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 mb-4">
            <label className="text-sm font-medium text-slate-700">Descripción corta</label>
            <input
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción opcional del proceso"
            />
          </div>

          <div className="flex flex-col gap-1.5 mb-6">
            <label className="text-sm font-medium text-slate-700">Misión del puesto y responsabilidades</label>
            <textarea
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px] resize-y"
              value={form.descripcion_cargo}
              onChange={e => setForm({ ...form, descripcion_cargo: e.target.value })}
              placeholder="Describa la misión principal y las tareas clave..."
            />
          </div>

          <div className="flex flex-col gap-1.5 mb-6">
            <label className="text-sm font-medium text-slate-700">Competencias requeridas (Martha Alles)</label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              {COMPETENCIAS_ALLES.map(comp => {
                const selected = form.competencias_requeridas.find(c => c.nombre === comp)
                return (
                  <div key={comp} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer min-w-[160px]">
                      <input 
                        type="checkbox" 
                        checked={!!selected}
                        onChange={e => {
                          if (e.target.checked) {
                            setForm({ ...form, competencias_requeridas: [...form.competencias_requeridas, { nombre: comp, nivel: 'B' }] })
                          } else {
                            setForm({ ...form, competencias_requeridas: form.competencias_requeridas.filter(c => c.nombre !== comp) })
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">{comp}</span>
                    </label>
                    {selected && (
                      <select
                        className="px-2 py-0.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-indigo-500"
                        value={selected.nivel}
                        onChange={e => {
                          const val = e.target.value
                          setForm({
                            ...form,
                            competencias_requeridas: form.competencias_requeridas.map(c => c.nombre === comp ? { ...c, nivel: val } : c)
                          })
                        }}
                      >
                        <option value="A">A (Excelente)</option>
                        <option value="B">B (Bueno)</option>
                        <option value="C">C (Mínimo)</option>
                        <option value="D">D (No rq.)</option>
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-6">
            <label className="text-sm font-medium text-slate-700 flex justify-between items-end">
              Batería de tests *
              <div className="flex gap-2">
                <button 
                  onClick={() => router.push('/entrevista-video')}
                  className="text-xs font-medium text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" /> Gestionar Librería
                </button>
                {form.bateria_tests.length > 0 && (
                  <span className="text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {form.bateria_tests.length} seleccionado{form.bateria_tests.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </label>
            
            <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tests Psicometricos</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {TESTS_DISPONIBLES.map(t => (
                    <label key={t.key} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded-md transition-colors border border-transparent hover:border-slate-100">
                      <input
                        type="checkbox"
                        checked={form.bateria_tests.includes(t.key)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...form.bateria_tests, t.key]
                            : form.bateria_tests.filter(k => k !== t.key)
                          setForm({ ...form, bateria_tests: next })
                        }}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                  Videoentrevistas (Plantillas de Librería)
                  {entrevistas.length === 0 && (
                    <button onClick={() => router.push('/entrevista-video/crear')} className="text-indigo-600 normal-case font-medium hover:underline">+ Crear nueva plantilla</button>
                  )}
                </h4>
                {entrevistas.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No hay plantillas creadas en la librería.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {entrevistas.map(e => (
                      <div key={e.id} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={form.bateria_tests.includes(`entrevista:${e.id}`)}
                            onChange={() => {}} // Manejado por onClick para evitar conflictos con el objeto de evento
                            onClick={() => {
                              const key = `entrevista:${e.id}`
                              if (form.bateria_tests.includes(key)) {
                                setForm({ ...form, bateria_tests: form.bateria_tests.filter(k => k !== key) })
                              } else {
                                setForm({ ...form, bateria_tests: [...form.bateria_tests, key] })
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer"
                            readOnly
                          />
                          <span className="text-xs font-medium text-slate-700 truncate">🎥 {e.nombre}</span>
                        </label>
                        <button 
                          onClick={(ev) => { ev.preventDefault(); verPreviewEntrevista(e.id, e.nombre) }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Previsualizar preguntas"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={guardarProceso}
              disabled={guardando || !form.nombre || !form.cargo}
            >
              {guardando ? 'Guardando...' : 'Guardar proceso'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar proceso por nombre o cargo..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 flex flex-col gap-3">
          {procesosFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 mb-4 font-medium">No hay procesos que coincidan.</p>
            </div>
          ) : (
            procesosFiltrados.map(proceso => (
              <div
                key={proceso.id}
                onClick={() => verCandidatosProceso(proceso)}
                className={`p-5 rounded-2xl border bg-white cursor-pointer transition-all duration-200 hover:shadow-md ${
                  procesoSeleccionado?.id === proceso.id 
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{proceso.nombre}</h3>
                    <p className="text-sm font-medium text-indigo-600 mt-0.5">{proceso.cargo}</p>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide ${
                    proceso.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {proceso.activo ? 'Activo' : 'Cerrado'}
                  </span>
                </div>
                {proceso.descripcion && (
                  <p className="text-sm text-slate-500 mt-2 mb-3">{proceso.descripcion}</p>
                )}
                <div className="flex items-center text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                  Creado el {formatearFecha(proceso.creado_en)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-2 sticky top-6">
          {procesoSeleccionado ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{procesoSeleccionado.nombre}</h2>
                  <p className="text-sm font-medium text-indigo-600 mt-0.5">{procesoSeleccionado.cargo}</p>
                </div>
                <button onClick={() => setProcesoSeleccionado(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batería de tests ({procesoSeleccionado.bateria_tests?.length || 0})</h4>
                  <button
                    onClick={() => {
                      setEditandoBateria(!editandoBateria)
                      setBateriaEdit(procesoSeleccionado.bateria_tests || [])
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {editandoBateria ? 'Cancelar' : 'Editar tests'}
                  </button>
                </div>
                
                {editandoBateria ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tests Psicometricos</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {TESTS_DISPONIBLES.map(t => (
                          <label key={t.key} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded-md transition-colors">
                            <input
                              type="checkbox"
                              checked={bateriaEdit.includes(t.key)}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...bateriaEdit, t.key]
                                  : bateriaEdit.filter(k => k !== t.key)
                                setBateriaEdit(next)
                              }}
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer"
                            />
                            <span className="text-[10px] font-medium text-slate-700 truncate">{t.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Videoentrevistas</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {entrevistas.map(e => {
                          const key = `entrevista:${e.id}`
                          return (
                            <div key={e.id} className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-slate-100">
                              <label className="flex items-center gap-2 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={bateriaEdit.includes(key)}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...bateriaEdit, key]
                                      : bateriaEdit.filter(k => k !== key)
                                    setBateriaEdit(next)
                                  }}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer"
                                />
                                <span className="text-[10px] font-medium text-slate-700 truncate">🎥 {e.nombre}</span>
                              </label>
                              <button 
                                onClick={(ev) => { ev.preventDefault(); verPreviewEntrevista(e.id, e.nombre) }}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={guardarEdicionBateria}
                        disabled={guardandoEdicion}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                      >
                        {guardandoEdicion ? 'Guardando...' : 'Guardar batería'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {procesoSeleccionado.bateria_tests?.map(tKey => {
                      const tInfo = [...TESTS_DISPONIBLES, ...entrevistas.map(e => ({ key: `entrevista:${e.id}`, label: `🎥 ${e.nombre}` }))].find(t => t.key === tKey)
                      return (
                        <span key={tKey} className="px-2 py-1 bg-slate-100 text-slate-600 text-[11px] rounded-md font-medium border border-slate-200 flex items-center gap-1">
                          {tInfo?.label || tKey}
                        </span>
                      )
                    })}
                    {(!procesoSeleccionado.bateria_tests || procesoSeleccionado.bateria_tests.length === 0) && (
                      <span className="text-xs text-slate-400">Sin tests asignados</span>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-8">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Asignar Candidato</h4>
                <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                  {candidatos.map(candidato => (
                    <div key={candidato.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{candidato.nombre} {candidato.apellido}</div>
                        <div className="text-xs text-slate-500">{candidato.email}</div>
                      </div>
                      <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          agregando === candidato.id 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                        onClick={() => asignarCandidato(candidato.id)}
                      >
                        {agregando === candidato.id ? <><Check className="w-3 h-3" /> Copiado</> : <><LinkIcon className="w-3 h-3" /> Copiar Link</>}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {candidatosProceso.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Evaluados en este proceso ({candidatosProceso.length})
                  </h4>
                  <div className="flex flex-col gap-2">
                    {candidatosProceso.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-700">{c.nombre} {c.apellido}</span>
                        <a href="/panel" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Ver panel →</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center h-64">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900 mb-1">Ningún proceso seleccionado</h3>
              <p className="text-xs text-slate-500 max-w-[200px]">Selecciona un proceso para asignar candidatos y ver resultados.</p>
            </div>
          )}
        </div>
      </div>
      {/* Modal Preview Entrevista */}
      {previewEntrevista && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{previewEntrevista.nombre}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">Previsualización de preguntas</p>
                </div>
              </div>
              <button onClick={() => setPreviewEntrevista(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {previewEntrevista.preguntas.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm italic">Esta plantilla no tiene preguntas configuradas.</p>
              ) : (
                <div className="space-y-4">
                  {previewEntrevista.preguntas.map((p, i) => (
                    <div key={p.id} className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">{i + 1}</span>
                      <div>
                        <p className="text-sm text-slate-800 font-medium leading-relaxed">{p.pregunta}</p>
                        <div className="flex gap-3 mt-2">
                          <span className="text-[10px] text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded">Prep: {p.tiempo_preparacion}s</span>
                          <span className="text-[10px] text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded">Resp: {p.tiempo_respuesta}s</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setPreviewEntrevista(null)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}