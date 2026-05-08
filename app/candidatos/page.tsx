'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/components/AppLayout'
import { Plus, Check, Copy, FileText, Search, UserPlus } from 'lucide-react'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
  documento: string
  edad?: number
  sexo?: string
  formacion?: string
  profesion?: string
  creado_en: string
}

export default function CandidatosPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'completado' | 'incompleto' | 'pendiente'>('todos')
  const [sesionesCount, setSesionesCount] = useState<Record<string, number>>({})
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    documento: '',
    edad: '',
    sexo: '',
    formacion: '',
    profesion: ''
  })
  const [guardando, setGuardando] = useState(false)
  const [nivelIcar, setNivelIcar] = useState('3')
  const [rotacionIcar, setRotacionIcar] = useState('si')

  useEffect(() => {
    cargarCandidatos()
  }, [])

  async function cargarCandidatos() {
    const { data, error } = await supabase
      .from('candidatos')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    // Cargar conteo de sesiones para cada candidato
    const { data: sData } = await supabase
      .from('sesiones')
      .select('candidato_id')
    
    const counts: Record<string, number> = {}
    sData?.forEach(s => {
      counts[s.candidato_id] = (counts[s.candidato_id] || 0) + 1
    })

    setSesionesCount(counts)
    setCandidatos(data || [])
    setCargando(false)
  }

  async function guardarCandidato() {
    if (!form.nombres || !form.apellidos || !form.email || !form.documento) return

    setGuardando(true)

    const { error } = await supabase
      .from('candidatos')
      .insert({
        nombre: form.nombres,
        apellido: form.apellidos,
        email: form.email,
        documento: form.documento,
        edad: parseInt(form.edad) || null,
        sexo: form.sexo,
        formacion: form.formacion,
        profesion: form.profesion
      })

    if (error) {
      console.error(error)
      setGuardando(false)
      return
    }

    setForm({ nombres: '', apellidos: '', email: '', documento: '', edad: '', sexo: '', formacion: '', profesion: '' })
    setMostrarForm(false)
    setGuardando(false)
    cargarCandidatos()
  }

  function copiarLink(candidatoId: string, test: string = 'bigfive', opciones?: Record<string, string>) {
    const rutas: Record<string, string> = {
      bigfive: '/test',
      hexaco: '/hexaco',
      numerico: '/numerico',
      verbal: '/verbal',
      integridad: '/integridad',
      icar: '/icar',
      comercial: '/comercial',
      sjt: '/sjt-comercial',
      tolerancia: '/tolerancia-frustracion',
      cobranzas: '/sjt-cobranzas',
      atencion: '/sjt-atencion',
      ventas: '/sjt-ventas',
      detalle: '/atencion-detalle',
      legal: '/sjt-legal',
      estres: '/estres-laboral',
      creatividad: '/creatividad',
      problemas: '/sjt-problemas'
    }
    const ruta = rutas[test] || '/test'
    let url = `${window.location.origin}${ruta}?candidato=${candidatoId}`
    if (opciones) {
      Object.entries(opciones).forEach(([k, v]) => { if (v) url += `&${k}=${v}` })
    }
    navigator.clipboard.writeText(url)
    setLinkCopiado(candidatoId + test)
    setTimeout(() => setLinkCopiado(null), 2000)
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const candidatosFiltrados = candidatos.filter(c => {
    const searchMatch = `${c.nombre} ${c.apellido}`.toLowerCase().includes(filtro.toLowerCase()) || 
      c.email.toLowerCase().includes(filtro.toLowerCase()) ||
      (c.documento && c.documento.includes(filtro))
    
    if (!searchMatch) return false

    const count = sesionesCount[c.id] || 0
    let estado: 'completado' | 'incompleto' | 'pendiente' = 'pendiente'
    if (count === 0) estado = 'pendiente'
    else if (count >= 3) estado = 'completado'
    else estado = 'incompleto'

    if (filtroEstado === 'todos') return true
    return estado === filtroEstado
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Candidatos</h1>
          <p className="text-sm text-slate-500 mt-1">
            {candidatos.length} candidato{candidatos.length !== 1 ? 's' : ''} registrado{candidatos.length !== 1 ? 's' : ''}
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
          {mostrarForm ? 'Cancelar' : <><UserPlus className="w-4 h-4" /> Nuevo candidato</>}
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Agregar nuevo candidato</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Nombres *</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.nombres}
                onChange={e => setForm({ ...form, nombres: e.target.value })}
                placeholder="Juan"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Apellidos *</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.apellidos}
                onChange={e => setForm({ ...form, apellidos: e.target.value })}
                placeholder="Pérez"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Documento *</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.documento}
                onChange={e => setForm({ ...form, documento: e.target.value })}
                placeholder="12345678"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Email *</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="juan@email.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Edad</label>
              <input
                type="number"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.edad}
                onChange={e => setForm({ ...form, edad: e.target.value })}
                placeholder="25"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Sexo</label>
              <select
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.sexo}
                onChange={e => setForm({ ...form, sexo: e.target.value })}
              >
                <option value="">Selecciona...</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Formación</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.formacion}
                onChange={e => setForm({ ...form, formacion: e.target.value })}
                placeholder="Ej: Licenciatura"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Profesión</label>
              <input
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={form.profesion}
                onChange={e => setForm({ ...form, profesion: e.target.value })}
                placeholder="Ej: Contador"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-all text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={guardarCandidato}
              disabled={guardando || !form.nombre || !form.apellido || !form.email}
            >
              {guardando ? 'Guardando...' : 'Guardar candidato'}
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
          placeholder="Buscar candidato por nombre, email o documento..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[
          { id: 'todos', label: 'Todos', color: 'bg-slate-100 text-slate-600' },
          { id: 'completado', label: 'Completados (+3 tests)', color: 'bg-green-100 text-green-700' },
          { id: 'incompleto', label: 'En Proceso (1-2 tests)', color: 'bg-amber-100 text-amber-700' },
          { id: 'pendiente', label: 'Sin Iniciar (0 tests)', color: 'bg-slate-100 text-slate-400' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFiltroEstado(f.id as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              filtroEstado === f.id ? 'border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-50 text-indigo-700' : 'border-transparent bg-white hover:bg-slate-50 text-slate-500'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {candidatos.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 mb-4 font-medium">No hay candidatos registrados todavía.</p>
          <button 
            onClick={() => setMostrarForm(true)}
            className="text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Crear el primer candidato
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Candidato</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Documento</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Links de evaluación (Copiar)</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidatosFiltrados.map(candidato => (
                  <tr key={candidato.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-900">{candidato.nombre} {candidato.apellido}</div>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          (sesionesCount[candidato.id] || 0) >= 3 ? 'bg-green-100 text-green-700' :
                          (sesionesCount[candidato.id] || 0) > 0 ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {(sesionesCount[candidato.id] || 0) === 0 ? 'Pendiente' : 
                           (sesionesCount[candidato.id] || 0) >= 3 ? 'Completado' : 'Incompleto'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{candidato.email}</div>
                      <div className="flex gap-2 mt-1">
                        {candidato.edad && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{candidato.edad} años</span>}
                        {candidato.sexo && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{candidato.sexo}</span>}
                        {candidato.profesion && <span className="text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600">{candidato.profesion}</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Registrado el {formatearFecha(candidato.creado_en)} • {(sesionesCount[candidato.id] || 0)} tests realizados</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {candidato.documento || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2 max-w-[400px]">
                        {[
                          { key: 'bigfive', label: 'Big Five', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                          { key: 'hexaco', label: 'HEXACO', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
                          { key: 'numerico', label: 'Numérico', color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
                          { key: 'verbal', label: 'Verbal', color: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200' },
                          { key: 'integridad', label: 'Integridad', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                          { key: 'comercial', label: 'Comercial', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
                          { key: 'sjt', label: 'SJT', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
                          { key: 'tolerancia', label: 'Tolerancia', color: 'bg-sky-100 text-sky-700 hover:bg-sky-200' },
                          { key: 'cobranzas', label: 'Cobranzas', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
                          { key: 'atencion', label: 'Atención', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
                          { key: 'ventas', label: 'Ventas', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
                          { key: 'detalle', label: 'Detalle', color: 'bg-stone-100 text-stone-700 hover:bg-stone-200' },
                          { key: 'legal', label: 'Legal', color: 'bg-violet-100 text-violet-700 hover:bg-violet-200' },
                          { key: 'estres', label: 'Estrés', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                          { key: 'creatividad', label: 'Creatividad', color: 'bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200' },
                          { key: 'problemas', label: 'Problemas', color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' },
                        ].map(t => (
                          <button
                            key={t.key}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              linkCopiado === candidato.id + t.key ? 'bg-green-600 text-white' : t.color
                            }`}
                            onClick={() => copiarLink(candidato.id, t.key)}
                          >
                            {linkCopiado === candidato.id + t.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {t.label}
                          </button>
                        ))}
                        
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                          <select
                            className="text-[10px] bg-transparent border-none outline-none text-slate-600 font-medium cursor-pointer"
                            value={nivelIcar}
                            onChange={e => setNivelIcar(e.target.value)}
                          >
                            <option value="1">ICAR Básico</option>
                            <option value="2">ICAR Intermedio</option>
                            <option value="3">ICAR Avanzado</option>
                          </select>
                          <div className="w-px h-3 bg-slate-300"></div>
                          <select
                            className="text-[10px] bg-transparent border-none outline-none text-slate-600 font-medium cursor-pointer"
                            value={rotacionIcar}
                            onChange={e => setRotacionIcar(e.target.value)}
                          >
                            <option value="si">+ Rotación</option>
                            <option value="no">Sin rot.</option>
                          </select>
                          <div className="w-px h-3 bg-slate-300"></div>
                          <button
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              linkCopiado === candidato.id + 'icar' ? 'text-green-600' : 'text-slate-700 hover:bg-slate-200'
                            }`}
                            onClick={() => copiarLink(candidato.id, 'icar', { nivel: nivelIcar, rotacion: rotacionIcar === 'no' ? 'no' : undefined } as Record<string, string>)}
                          >
                            {linkCopiado === candidato.id + 'icar' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            Copiar
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={`/informe?candidato=${candidato.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700 transition-colors"
                        title="Ver Informe"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
                {candidatosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                      No se encontraron candidatos que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
// Hack for lucide-react icon fix if Users was missing from import, though I added UserPlus above
import { Users } from 'lucide-react'
