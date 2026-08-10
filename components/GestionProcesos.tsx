'use client'

import { useEffect, useState } from 'react'
import { Plus, Check, Link as LinkIcon, Search, FileText, X, Eye, Settings, Clock, CheckCircle2, BellRing, Upload, ClipboardPaste, UserPlus, Download, Video } from 'lucide-react'
import { getAdminHeaders, obtenerLinkEvaluacion } from '@/lib/evaluacionLink'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// navigator.clipboard.writeText exige que el documento tenga foco en el momento exacto en
// que se llama. Como el link se genera con un fetch async antes de copiarlo, el foco se
// puede perder en el medio (cambio de pestaña/ventana) y el navegador lo rechaza con
// NotAllowedError sin mostrar nada util. Ante eso, se ofrece el link en un prompt para
// copiarlo a mano en vez de fallar en silencio.
async function copiarAlPortapapeles(texto: string, mensajeExito?: string) {
  try {
    await navigator.clipboard.writeText(texto)
    if (mensajeExito) alert(mensajeExito)
  } catch {
    window.prompt('No se pudo copiar automáticamente (el navegador perdió el foco). Copiá el link manualmente:', texto)
  }
}

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
  { key: 'dass21', label: 'DASS-21' },
  { key: 'iniciativa-dinamismo', label: 'Iniciativa y Dinamismo' },
  { key: 'frases-incompletas', label: 'Frases Incompletas' },
  { key: 'roleplay', label: 'Role Play: Cobranzas (IA)' },
  { key: 'roleplay_atencion', label: 'Role Play: Atención al Cliente (IA)' },
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
  descripcion_cargo?: string
  competencias_requeridas?: { nombre: string; nivel: string }[]
}

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
  progreso?: { completados: number; total: number; tests: string[] }
}

const SLUG_TO_ID: Record<string, string> = {
  'bigfive': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'icar': 'f6a7b8c9-d0e1-2345-fabc-456789012345',
  'estres-laboral': 'd0e1f2a3-b4c5-6789-defa-000000000001',
  'creatividad': 'e1f2a3b4-c5d6-7890-efab-111222333444',
  'integridad': 'e5f6a7b8-c9d0-1234-efab-345678901234',
  'hexaco': 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'numerico': 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'verbal': 'd4e5f6a7-b8c9-0123-defa-234567890123',
  'sjt-ventas': 'a7b8c9d0-e1f2-3456-abcd-777777777777',
  'tolerancia-frustracion': 'e5f6a7b8-c9d0-1234-efab-555555555555',
  'sjt-problemas': 'f2a3b4c5-d6e7-8901-fabc-222333444555',
  'sjt-legal': 'c9d0e1f2-a3b4-5678-cdef-999999999999',
  'sjt-comercial': 'b2c3d4e5-f6a7-8901-bcde-222222222222',
  'comercial': 'a1b2c3d4-e5f6-7890-abcd-111111111111',
  'atencion-detalle': 'b8c9d0e1-f2a3-4567-bcde-888888888888',
  'sjt-atencion': 'f6a7b8c9-d0e1-2345-fabc-666666666666',
  'sjt-cobranzas': 'e9b2c3d4-f5a6-7890-bcde-999999999999',
  'dass21': '7a8b9c0d-e1f2-4356-abcd-999999999999',
  'iniciativa-dinamismo': '0b6ade42-0c8f-4084-a4a5-9ff7869d73b6',
  'frases-incompletas': 'f7a8b9c0-d1e2-4356-abcd-888888888888',
  'roleplay': 'd8e9f0a1-b2c3-4567-defa-888888888888',
  'roleplay_atencion': 'd8e9f0a1-b2c3-4567-defa-777777777777',
}

export default function GestionProcesos() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [entrevistas, setEntrevistas] = useState<{ id: string, nombre: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<Proceso | null>(null)
  const [candidatosProceso, setCandidatosProceso] = useState<Candidato[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [modoEdicion, setModoEdicion] = useState(false)
  const [form, setForm] = useState({ 
    nombre: '', cargo: '', descripcion: '', descripcion_cargo: '', bateria_tests: [] as string[],
    competencias_requeridas: [] as { nombre: string; nivel: string }[] 
  })
  const [guardando, setGuardando] = useState(false)
  const [agregando, setAgregando] = useState('')
  const [filtro, setFiltro] = useState('')
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState<string | null>(null)
  const [mostrarCargaMasiva, setMostrarCargaMasiva] = useState(false)
  const [procesandoMasivo, setProcesandoMasivo] = useState(false)
  const [tabMasivo, setTabMasivo] = useState<'archivo' | 'texto'>('archivo')
  const [textoMasivo, setTextoMasivo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'completada' | 'en curso' | 'pendiente'>('todos')
  const [busquedaParticipante, setBusquedaParticipante] = useState('')
  const [videoRespuestas, setVideoRespuestas] = useState<any[]>([])
  const [progresoOperativo, setProgresoOperativo] = useState<any[]>([])
  const [exportandoLinks, setExportandoLinks] = useState(false)
  const [recordatorios, setRecordatorios] = useState<any[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function procesarCargaMasiva(datos: any[]) {
    if (!datos.length) return
    setProcesandoMasivo(true)
    
    try {
      const candidatosParaCargar = datos
        .map(d => {
          // Buscador inteligente de columnas
          const nombre = d.nombre || d.Nombre || d.name || d.Name || d['First Name'] || d['Primer Nombre'] || ''
          const apellido = d.apellido || d.Apellido || d.lastname || d.Surname || d.last_name || d.Lastname || ''
          const email = d.email || d.Email || d.mail || d.Mail || d.correo || d.Correo || d['E-mail'] || d['email address'] || ''
          
          return {
            nombre: String(nombre).trim(),
            apellido: String(apellido).trim(),
            email: String(email).toLowerCase().trim()
          }
        })
        .filter(d => d.email && d.nombre)

      if (candidatosParaCargar.length === 0 && datos.length > 0) {
        throw new Error('No se encontraron columnas de "Nombre" o "Email". Asegúrate de que tu archivo tenga estos títulos en la primera fila.')
      }

      const response = await fetch('/api/admin/procesos', {
        method: 'POST',
        headers: await getAdminHeaders(),
        body: JSON.stringify({
          action: 'carga_masiva',
          candidatos: candidatosParaCargar,
          procesoId: procesoSeleccionado?.id || '',
          slugPrimerTest: procesoSeleccionado?.bateria_tests?.[0] || 'control'
        })
      })
      const resultado = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(resultado.error || 'Error en la carga masiva')

      await cargarDatos()
      alert(`Carga completada: ${resultado.total ?? candidatosParaCargar.length} candidatos procesados correctamente.`)
      setMostrarCargaMasiva(false)
      setTextoMasivo('')
    } catch (error: any) {
      alert('Error en la carga masiva: ' + error.message)
    } finally {
      setProcesandoMasivo(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (extension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => procesarCargaMasiva(results.data)
      })
    } else if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (evt) => {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        procesarCargaMasiva(data)
      }
      reader.readAsBinaryString(file)
    } else {
      alert('Formato de archivo no soportado. Usa CSV o Excel (.xlsx, .xls)')
    }
  }

  const handleTextoMasivo = () => {
    const lineas = textoMasivo.split('\n').filter(l => l.trim())
    const datos = lineas.map(l => {
      const partes = l.split(/[,;\t]/).map(p => p.trim())
      if (partes.length >= 3) return { nombre: partes[0], apellido: partes[1], email: partes[2] }
      if (partes.length === 1 && partes[0].includes('@')) return { nombre: partes[0].split('@')[0], apellido: '', email: partes[0] }
      return { nombre: partes[0] || 'Candidato', apellido: partes[1] || '', email: partes[partes.length - 1] }
    })
    procesarCargaMasiva(datos)
  }

  async function guardarProceso() {
    if (!form.nombre || !form.cargo) return
    setGuardando(true)

    if (modoEdicion && procesoSeleccionado) {
      const response = await fetch('/api/admin/procesos', {
        method: 'POST',
        headers: await getAdminHeaders(),
        body: JSON.stringify({ action: 'actualizar_proceso', procesoId: procesoSeleccionado.id, ...form })
      })

      if (response.ok) {
        setProcesoSeleccionado({ ...procesoSeleccionado, ...form })
        setProcesos(procesos.map(p => p.id === procesoSeleccionado.id ? { ...p, ...form } : p))
        setMostrarForm(false)
        setModoEdicion(false)
        alert('Proceso actualizado con éxito.')
      } else {
        const payload = await response.json().catch(() => ({}))
        console.error('Error al actualizar:', payload.error)
        alert('Hubo un error al actualizar el proceso.')
      }
    } else {
      const response = await fetch('/api/admin/procesos', {
        method: 'POST',
        headers: await getAdminHeaders(),
        body: JSON.stringify({ action: 'crear_proceso', ...form })
      })
      const payload = await response.json().catch(() => ({}))

      if (response.ok) {
        setForm({ nombre: '', cargo: '', descripcion: '', descripcion_cargo: '', bateria_tests: [], competencias_requeridas: [] })
        setMostrarForm(false)
        cargarDatos()
        if (payload.proceso) setProcesoSeleccionado(payload.proceso)
      }
    }
    setGuardando(false)
  }

  async function eliminarProceso(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Estás seguro de eliminar este proceso? Los candidatos se desvincularán de esta vacante, pero sus resultados históricos se mantendrán en la base de datos.')) return

    const response = await fetch('/api/admin/procesos', {
      method: 'POST',
      headers: await getAdminHeaders(),
      body: JSON.stringify({ action: 'eliminar_proceso', procesoId: id })
    })

    if (response.ok) {
      if (procesoSeleccionado?.id === id) setProcesoSeleccionado(null)
      cargarDatos()
    } else {
      const payload = await response.json().catch(() => ({}))
      alert('Error al eliminar: ' + (payload.error || 'desconocido'))
    }
  }

  async function toggleEstado(p: Proceso, e: React.MouseEvent) {
    e.stopPropagation()
    const response = await fetch('/api/admin/procesos', {
      method: 'POST',
      headers: await getAdminHeaders(),
      body: JSON.stringify({ action: 'toggle_estado', procesoId: p.id, activo: !p.activo })
    })

    if (response.ok) cargarDatos()
  }

  function iniciarEdicion() {
    if (!procesoSeleccionado) return
    setForm({
      nombre: procesoSeleccionado.nombre,
      cargo: procesoSeleccionado.cargo,
      descripcion: procesoSeleccionado.descripcion || '',
      descripcion_cargo: procesoSeleccionado.descripcion_cargo || '',
      bateria_tests: procesoSeleccionado.bateria_tests || [],
      competencias_requeridas: procesoSeleccionado.competencias_requeridas || []
    })
    setModoEdicion(true)
    setMostrarForm(true)
  }

  async function asignarCandidato(candidatoId: string) {
    if (!procesoSeleccionado) return
    setAgregando(candidatoId)

    const slugPrimerTest = procesoSeleccionado.bateria_tests?.[0] || 'control'

    const response = await fetch('/api/admin/procesos', {
      method: 'POST',
      headers: await getAdminHeaders(),
      body: JSON.stringify({ action: 'asignar_candidato', candidatoId, procesoId: procesoSeleccionado.id, slugPrimerTest })
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      console.error('Error al crear vínculo:', payload.error)
    }

    await cargarDatos()

    try {
      const link = await obtenerLinkEvaluacion(candidatoId, procesoSeleccionado.id)
      await copiarAlPortapapeles(link)
    } catch (err: any) {
      console.error('Error al generar el link firmado:', err.message)
    }
    setTimeout(() => setAgregando(''), 1500)
  }

  async function desvincularCandidato(candidatoId: string) {
    if (!procesoSeleccionado) return
    if (!confirm('¿Estás seguro de desvincular a este candidato de este proceso? Dejará de figurar en esta vacante.')) return

    const response = await fetch('/api/admin/procesos', {
      method: 'POST',
      headers: await getAdminHeaders(),
      body: JSON.stringify({ action: 'desvincular_candidato', candidatoId, procesoId: procesoSeleccionado.id })
    })

    if (response.ok) {
      cargarDatos()
    } else {
      const payload = await response.json().catch(() => ({}))
      console.error('Error al desvincular:', payload.error)
    }
  }

  async function enviarRecordatorio(c: Candidato) {
    if (!procesoSeleccionado) return
    setEnviandoRecordatorio(c.id)
    
    // Calcular pendientes basado en la batería del proceso vs sesiones existentes
    const link = await obtenerLinkEvaluacion(c.id, procesoSeleccionado.id)

    try {
      const res = await fetch('/api/recordatorio', {
        method: 'POST',
        headers: await getAdminHeaders(),
        body: JSON.stringify({ 
          email: c.email, 
          nombre: c.nombre, 
          proceso: procesoSeleccionado.cargo, 
          link, 
          candidato_id: c.id,
          proceso_id: procesoSeleccionado.id,
          pendientes: 'los tests restantes' 
        })
      })
      if (res.ok) alert(`Recordatorio enviado a ${c.nombre}`)
      else alert('Error enviando recordatorio')
    } catch (error) {
      console.error(error)
    } finally {
      setEnviandoRecordatorio(null)
    }
  }

  // Identificar participantes de un proceso de forma ROBUSTA
  useEffect(() => {
    if (procesoSeleccionado) {
      const testsAsignadosSlugs = procesoSeleccionado.bateria_tests || []
      const testsAsignadosIds = testsAsignadosSlugs.map(slug => SLUG_TO_ID[slug] || slug)
      
      // 1. Obtener IDs desde las sesiones (Fuente principal de verdad)
      const idsDesdeSesiones = sesiones
        .filter(s => s.proceso_id === procesoSeleccionado.id)
        .map(s => s.candidato_id)
      
      // 2. Obtener IDs desde videos (Solo si pertenecen a este proceso)
      const idsDesdeVideos = videoRespuestas
        .filter(v => (v as any).proceso_id === procesoSeleccionado.id || idsDesdeSesiones.includes(v.candidato_id))
        .map(v => v.candidato_id)
      
      const todosLosIds = new Set([...idsDesdeSesiones, ...idsDesdeVideos])
      
      // 2. Crear la lista de participantes, incluyendo "Candidatos Virtuales" si no existen en la tabla candidatos
      const vinculados = Array.from(todosLosIds).map(id => {
        const real = candidatos.find(cand => cand.id === id)
        if (real) return real
        
        // Si no existe el candidato real, buscamos su email en las sesiones para mostrar algo útil
        const sesionEjemplo = sesiones.find(s => s.candidato_id === id)
        return {
          id,
          nombre: sesionEjemplo?.email?.split('@')[0] || 'Candidato',
          apellido: '(S/N)',
          email: sesionEjemplo?.email || 'sin@email.com',
          virtual: true
        }
      })
      
      setCandidatosProceso(vinculados as any)
    } else {
      setCandidatosProceso([])
    }
  }, [procesoSeleccionado, sesiones, candidatos, videoRespuestas])

  async function repararVinculos() {
    if (!procesoSeleccionado) return
    setProcesandoMasivo(true)
    try {
      const slugPrimerTest = procesoSeleccionado.bateria_tests?.[0] || 'control'

      const response = await fetch('/api/admin/procesos', {
        method: 'POST',
        headers: await getAdminHeaders(),
        body: JSON.stringify({ action: 'reparar_vinculos', procesoId: procesoSeleccionado.id, slugPrimerTest })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Error al reparar')

      await cargarDatos()
      alert('¡Vínculos restaurados con éxito!')
    } catch (err: any) {
      alert('Error al reparar: ' + err.message)
    } finally {
      setProcesandoMasivo(false)
    }
  }

  async function cargarDatos() {
    setCargando(true)
    try {
      const response = await fetch('/api/admin/procesos', {
        headers: await getAdminHeaders(),
        cache: 'no-store'
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar los procesos')

      const progresoResponse = await fetch('/api/progreso-evaluacion', { headers: await getAdminHeaders() })
      const progresoJson = progresoResponse.ok ? await progresoResponse.json() : { data: [] }

      const recordatoriosResponse = await fetch('/api/recordatorio', { headers: await getAdminHeaders() })
      const recordatoriosJson = recordatoriosResponse.ok ? await recordatoriosResponse.json() : { data: [] }

      console.log('RECUENTO:', {
        p: payload.data?.length || 0,
        c: payload.candidatos?.length || 0,
        s: payload.sesiones?.length || 0
      })

      if (payload.data) setProcesos(payload.data)
      if (payload.candidatos) setCandidatos(payload.candidatos)
      if (payload.entrevistas) setEntrevistas(payload.entrevistas)
      if (payload.sesiones) setSesiones(payload.sesiones)
      if (payload.respuestasVideo) setVideoRespuestas(payload.respuestasVideo)
      setProgresoOperativo(Array.isArray(progresoJson.data) ? progresoJson.data : [])
      setRecordatorios(Array.isArray(recordatoriosJson.data) ? recordatoriosJson.data : [])
    } catch (err) {
      console.error('Falla total:', err)
    } finally {
      setCargando(false)
    }
  }

  const procesosFiltrados = procesos.filter(p => 
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    p.cargo.toLowerCase().includes(filtro.toLowerCase())
  )

  if (cargando) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Gestión de Procesos</h2>
          <p className="text-sm text-slate-500">Configura vacantes y asigna candidatos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarCargaMasiva(true)}
            className="px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4 text-indigo-600" />
            Carga Masiva
          </button>
          <button 
            onClick={() => {
              if (mostrarForm) {
                setMostrarForm(false)
                setModoEdicion(false)
              } else {
                setForm({ nombre: '', cargo: '', descripcion: '', descripcion_cargo: '', bateria_tests: [], competencias_requeridas: [] })
                setModoEdicion(false)
                setMostrarForm(true)
              }
            }}
            className={`px-4 py-2 text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
              mostrarForm ? 'bg-white border border-slate-200 text-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {mostrarForm ? 'Cerrar' : <><Plus className="w-4 h-4" /> Nuevo Proceso</>}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-8 shadow-xl animate-in slide-in-from-top-4 duration-300 ring-2 ring-indigo-500/10">
          <h2 className="text-lg font-bold text-slate-900 mb-6">{modoEdicion ? 'Editar Proceso' : 'Nuevo Proceso de Selección'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre del proceso</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Analista Senior IT"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargo / Vacante</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
                value={form.cargo}
                onChange={e => setForm({ ...form, cargo: e.target.value })}
                placeholder="Ej: Desarrollador Fullstack"
              />
            </div>
          </div>
          
          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batería de Tests</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              {TESTS_DISPONIBLES.map(t => (
                <label key={t.key} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                  <input
                    type="checkbox"
                    checked={form.bateria_tests.includes(t.key)}
                    onChange={e => {
                      const next = e.target.checked ? [...form.bateria_tests, t.key] : form.bateria_tests.filter(k => k !== t.key)
                      setForm({ ...form, bateria_tests: next })
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Video Entrevistas</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              {entrevistas.map(e => (
                <label key={e.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                  <input
                    type="checkbox"
                    checked={form.bateria_tests.includes(`entrevista:${e.id}`)}
                    onChange={ec => {
                      const key = `entrevista:${e.id}`
                      const next = ec.target.checked ? [...form.bateria_tests, key] : form.bateria_tests.filter(k => k !== key)
                      setForm({ ...form, bateria_tests: next })
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-2">
                    <Video className="w-3 h-3 text-indigo-400" />
                    {e.nombre}
                  </span>
                </label>
              ))}
              {entrevistas.length === 0 && (
                <p className="text-[10px] text-slate-400 italic p-2">No hay video entrevistas creadas.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={guardarProceso}
              disabled={guardando || !form.nombre || !form.cargo}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : modoEdicion ? 'Actualizar Proceso' : 'Crear Proceso'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none"
              placeholder="Buscar..."
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
            />
          </div>
          {procesosFiltrados.map(p => (
            <div 
              key={p.id}
              onClick={() => setProcesoSeleccionado(p)}
              className={`p-4 bg-white border rounded-2xl cursor-pointer transition-all group relative ${
                procesoSeleccionado?.id === p.id ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="pr-8">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-800 leading-tight">{p.nombre}</h3>
                    <span 
                      onClick={(e) => toggleEstado(p, e)}
                      className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full cursor-pointer transition-all hover:scale-105 ${
                        p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.activo ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-600 font-bold">{p.cargo}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={(e) => eliminarProceso(p.id, e)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                    {new Set(sesiones.filter(s => s.proceso_id === p.id).map(s => s.candidato_id)).size} cand.
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-8">
          {procesoSeleccionado ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sticky top-6 shadow-sm overflow-y-auto max-h-[calc(100vh-100px)] custom-scrollbar">
              <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{procesoSeleccionado.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span 
                      onClick={(e) => toggleEstado(procesoSeleccionado, e)}
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full cursor-pointer transition-all hover:scale-105 ${
                        procesoSeleccionado.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {procesoSeleccionado.activo ? 'Abierto' : 'Cerrado'}
                    </span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{procesoSeleccionado.cargo}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {procesoSeleccionado.id.slice(0,8)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={iniciarEdicion}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all shadow-md"
                  >
                    <Settings className="w-4 h-4" />
                    CONFIGURAR PROCESO
                  </button>
                  <button
                    disabled={exportandoLinks}
                    onClick={async () => {
                      setExportandoLinks(true)
                      try {
                        const csvData = await Promise.all(candidatosProceso.map(async c => {
                          // Encontrar la sesión para este proceso y obtener su estado/fecha
                          const sesion = sesiones.find(s => s.candidato_id === c.id && s.proceso_id === procesoSeleccionado.id)
                          let linkEvaluacion = ''
                          try {
                            linkEvaluacion = await obtenerLinkEvaluacion(c.id, procesoSeleccionado.id)
                          } catch (err: any) {
                            console.error(`Error al generar link firmado para ${c.email}:`, err.message)
                          }
                          return {
                            Nombre: c.nombre,
                            Apellido: c.apellido,
                            Email: c.email,
                            Estado: sesion?.estado || 'Sin iniciar',
                            Fecha_Asignacion: sesion?.creado_en ? new Date(sesion.creado_en).toLocaleDateString() : 'N/A',
                            Link_Evaluacion: linkEvaluacion
                          }
                        }))
                        const csv = Papa.unparse(csvData)
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                        const link = document.createElement('a')
                        link.href = URL.createObjectURL(blob)
                        link.setAttribute('download', `Links_${procesoSeleccionado.cargo.replace(/\s+/g, '_')}.csv`)
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      } finally {
                        setExportandoLinks(false)
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-[10px] font-bold transition-all border border-slate-200 disabled:opacity-50"
                    title="Exportar lista con links para Gmail"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportandoLinks ? 'GENERANDO...' : 'EXPORTAR LINKS'}
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                {/* BATERIA DE TESTS */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Batería de tests asignada ({procesoSeleccionado.bateria_tests?.length || 0})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {procesoSeleccionado.bateria_tests?.map(tKey => {
                      const tInfo = [...TESTS_DISPONIBLES, ...entrevistas.map(e => ({ key: `entrevista:${e.id}`, label: `🎥 ${e.nombre || 'Videoentrevista / Roleplay'}` }))].find(t => t.key === tKey)
                      const displayLabel = tInfo?.label || (tKey.startsWith('entrevista:') ? '🎥 Roleplay / Videoentrevista' : tKey)
                      return (
                        <span key={tKey} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] rounded-xl font-bold border border-slate-100 flex items-center gap-1.5">
                          {displayLabel}
                        </span>
                      )
                    })}
                    {(!procesoSeleccionado.bateria_tests || procesoSeleccionado.bateria_tests.length === 0) && (
                      <span className="text-xs text-slate-400 italic">Sin tests asignados</span>
                    )}
                  </div>
                </div>

                {/* PARTICIPANTES ACTUALES */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Participantes en este proceso
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={busquedaParticipante}
                        onChange={e => setBusquedaParticipante(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-2 focus:ring-indigo-500/20 outline-none w-48"
                      />
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {[
                          { id: 'todos', label: 'Todos', color: 'text-slate-600' },
                          { id: 'completada', label: 'Comp.', color: 'text-green-600' },
                          { id: 'en curso', label: 'En curso', color: 'text-amber-600' },
                          { id: 'pendiente', label: 'Pend.', color: 'text-slate-400' },
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setFiltroEstado(f.id as any)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              filtroEstado === f.id ? 'bg-white text-indigo-600 shadow-sm' : `${f.color} hover:bg-white/50`
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {candidatosProceso.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                      {candidatosProceso
                        .map(c => {
                          const testsAsignadosSlugs = procesoSeleccionado?.bateria_tests || []
                          const misSesiones = sesiones.filter(s => s.candidato_id === c.id)
                          const misVideos = videoRespuestas.filter(v => v.candidato_id === c.id)
                          
                          const testsCompletadosIds = misSesiones.map(s => s.test_id)
                          const videosCompletadosIds = misVideos.map(v => v.entrevista_id)
                          
                          const uniqueCompletados = new Set<string>()
                          testsAsignadosSlugs.forEach(slug => {
                            if (slug.startsWith('entrevista:')) {
                              const entId = slug.split(':')[1]
                              if (videosCompletadosIds.includes(entId)) uniqueCompletados.add(slug)
                            } else {
                              const id = SLUG_TO_ID[slug]
                              // Verificación redundante para asegurar match
                              if (testsCompletadosIds.includes(slug) || (id && testsCompletadosIds.includes(id))) {
                                uniqueCompletados.add(slug)
                              }
                            }
                          })
                          
                          const numCompletados = uniqueCompletados.size
                          const totalAsignados = testsAsignadosSlugs.length
                          
                          let estado: 'completada' | 'en curso' | 'pendiente' = 'pendiente'
                          const progresoCandidato = progresoOperativo.filter(p => p.candidato_id === c.id && p.proceso_id === procesoSeleccionado?.id)
                           const tieneActividad = progresoCandidato.some(p => ['en_curso', 'pausada'].includes(p.estado))
                           if (numCompletados === 0 && !tieneActividad) estado = 'pendiente'
                          // Si ha completado el 100% de la batería
                          else if (numCompletados >= totalAsignados && totalAsignados > 0) estado = 'completada'
                          else estado = 'en curso'

                          return { ...c, progreso_real: { comp: numCompletados, total: totalAsignados, estado } }
                        })
                        .filter(c => {
                          if (filtroEstado === 'todos') return true
                          return (c as any).progreso_real.estado === filtroEstado
                        })
                        .filter(c => {
                          const q = busquedaParticipante.trim().toLowerCase()
                          if (!q) return true
                          const nombreCompleto = `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase()
                          return nombreCompleto.includes(q) || (c.email || '').toLowerCase().includes(q)
                        })
                        .map(c => (
                        <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center group hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition-all">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-slate-800 truncate">{c.nombre} {c.apellido}</p>
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                c.progreso_real.estado === 'completada' ? 'bg-green-100 text-green-700' :
                                c.progreso_real.estado === 'en curso' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {c.progreso_real.estado}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mb-2">{c.email}</p>
                            {(() => {
                              const ultimoRecordatorio = recordatorios
                                .filter(r => r.candidato_id === c.id && r.proceso_id === procesoSeleccionado?.id)
                                .sort((a, b) => new Date(b.enviado_en).getTime() - new Date(a.enviado_en).getTime())[0]
                              if (!ultimoRecordatorio) return null
                              const fecha = new Date(ultimoRecordatorio.enviado_en).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                              return (
                                <p className={`text-[10px] mb-2 flex items-center gap-1 ${ultimoRecordatorio.estado === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                                  <BellRing className="w-3 h-3" />
                                  {ultimoRecordatorio.estado === 'error' ? 'Recordatorio falló' : 'Último recordatorio'}: {fecha}
                                </p>
                              )
                            })()}

                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${
                                    c.progreso_real.estado === 'completada' ? 'bg-green-500' : 'bg-indigo-500'
                                  }`} 
                                  style={{ width: `${(c.progreso_real.comp / c.progreso_real.total) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                                {c.progreso_real.comp}/{c.progreso_real.total}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-4">
                            <button
                              onClick={async () => {
                                try {
                                  const link = await obtenerLinkEvaluacion(c.id, procesoSeleccionado.id)
                                  await copiarAlPortapapeles(link, 'Link copiado al portapapeles')
                                } catch (err: any) {
                                  alert('No se pudo generar el link: ' + (err.message || err))
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Copiar link de evaluación"
                            >
                              <LinkIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => enviarRecordatorio(c)}
                              disabled={enviandoRecordatorio === c.id}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Enviar recordatorio"
                            >
                              <BellRing className={`w-4 h-4 ${enviandoRecordatorio === c.id ? 'animate-bounce text-indigo-600' : ''}`} />
                            </button>
                            <button 
                              onClick={() => desvincularCandidato(c.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Desvincular del proceso"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-3xl mb-8 flex flex-col items-center gap-4">
                      <p className="text-xs text-slate-400 font-medium text-center">Parece que se perdieron los vínculos de este proceso.</p>
                      <button 
                        onClick={repararVinculos}
                        disabled={procesandoMasivo}
                        className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-all shadow-sm"
                      >
                        {procesandoMasivo ? 'Reparando...' : 'REPARAR VÍNCULOS Y RECUPERAR CANDIDATOS'}
                      </button>
                    </div>
                  )}
                </div>

                {/* ASIGNAR NUEVOS */}
                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Plus className="w-3 h-3" />
                    Asignar más candidatos
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {candidatos
                      .filter(c => (c as any).proceso_id !== procesoSeleccionado.id)
                      .map(c => (
                      <div key={c.id} className="p-3 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors flex justify-between items-center group">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-xs font-bold text-slate-800 truncate">{c.nombre} {c.apellido}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-500 truncate">{c.email}</p>
                            {(c as any).proceso_id && (
                              <span className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100">En otro proceso</span>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => asignarCandidato(c.id)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                            agregando === c.id ? 'bg-green-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                        >
                          {agregando === c.id ? '¡Asignado!' : 'Asignar'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
              <FileText className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm font-bold">Selecciona un proceso para gestionar</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Carga Masiva */}
      {mostrarCargaMasiva && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Carga Masiva de Candidatos</h2>
                <p className="text-xs text-slate-500 mt-0.5">Importa múltiples perfiles en segundos</p>
              </div>
              <button onClick={() => setMostrarCargaMasiva(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
                <button 
                  onClick={() => setTabMasivo('archivo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${tabMasivo === 'archivo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <Upload className="w-4 h-4" />
                  SUBIR ARCHIVO
                </button>
                <button 
                  onClick={() => setTabMasivo('texto')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${tabMasivo === 'texto' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  PEGAR LISTA
                </button>
              </div>

              {tabMasivo === 'archivo' ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-indigo-300 transition-colors bg-slate-50/50 group">
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <FileText className="w-8 h-8 text-indigo-500" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Haz clic para subir tu Excel o CSV</p>
                      <p className="text-xs text-slate-500 mt-1">O arrastra el archivo aquí</p>
                      <div className="mt-4 inline-block px-3 py-1 bg-indigo-50 text-[10px] font-bold text-indigo-600 rounded-lg">
                        COLUMNAS: NOMBRE, APELLIDO, EMAIL
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none font-mono"
                    placeholder="Juan, Perez, juan@email.com&#10;Maria, Lopez, maria@email.com"
                    value={textoMasivo}
                    onChange={(e) => setTextoMasivo(e.target.value)}
                  />
                  <button
                    disabled={!textoMasivo.trim() || procesandoMasivo}
                    onClick={handleTextoMasivo}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {procesandoMasivo ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        PROCESAR LISTA
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {procesoSeleccionado && (
              <div className="px-6 py-4 bg-amber-50 border-t border-amber-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <LinkIcon className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-[11px] text-amber-800 leading-tight">
                  <span className="font-bold">MODO AUTO-VINCULAR:</span> Los candidatos se asignarán automáticamente al proceso <span className="font-bold underline">{procesoSeleccionado.cargo}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
