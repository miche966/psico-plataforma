'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Check, Link as LinkIcon, Search, FileText, X, Eye, Settings, Clock, CheckCircle2, BellRing, Upload, ClipboardPaste, UserPlus, Download } from 'lucide-react'
import { getBaseUrl } from '@/lib/utils'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

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
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState<string | null>(null)
  const [mostrarCargaMasiva, setMostrarCargaMasiva] = useState(false)
  const [procesandoMasivo, setProcesandoMasivo] = useState(false)
  const [tabMasivo, setTabMasivo] = useState<'archivo' | 'texto'>('archivo')
  const [textoMasivo, setTextoMasivo] = useState('')

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

      // 2. Obtener candidatos existentes (perfil completo)
      const emails = candidatosParaCargar.map(c => c.email)
      const { data: existentes } = await supabase
        .from('candidatos')
        .select('*')
        .in('email', emails)

      const emailsExistentes = new Set(existentes?.map(e => e.email) || [])
      const nuevosParaInsertar = candidatosParaCargar.filter(c => !emailsExistentes.has(c.email))

      let todosLosCandidatos = existentes || []

      // Insertar los nuevos
      if (nuevosParaInsertar.length > 0) {
        const { data: insertados, error: errorI } = await supabase
          .from('candidatos')
          .insert(nuevosParaInsertar)
          .select()
        
        if (errorI) throw errorI
        if (insertados) todosLosCandidatos = [...todosLosCandidatos, ...insertados]
      }

      // 3. Vincular al proceso seleccionado
      if (procesoSeleccionado && todosLosCandidatos.length > 0) {
        const slugPrimerTest = procesoSeleccionado.bateria_tests?.[0] || 'control'
        let testIdFinal = slugPrimerTest
        if (slugPrimerTest.startsWith('entrevista:')) testIdFinal = slugPrimerTest.split(':')[1]
        else if (SLUG_TO_ID[slugPrimerTest]) testIdFinal = SLUG_TO_ID[slugPrimerTest]

        const { data: sesionesActuales } = await supabase
          .from('sesiones')
          .select('candidato_id')
          .eq('proceso_id', procesoSeleccionado.id)
        
        const idsConSesion = new Set(sesionesActuales?.map(s => s.candidato_id) || [])
        
        const sesionesNuevas = todosLosCandidatos
          .filter(c => !idsConSesion.has(c.id))
          .map(c => ({
            candidato_id: c.id,
            proceso_id: procesoSeleccionado.id,
            test_id: testIdFinal,
            estado: 'pendiente'
          }))

        if (sesionesNuevas.length > 0) {
          const { error: errorS } = await supabase
            .from('sesiones')
            .insert(sesionesNuevas)
          
          if (errorS) throw errorS
        }
      }

      await cargarDatos()
      alert(`Carga completada: ${todosLosCandidatos.length} candidatos procesados correctamente.`)
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
    const { error } = await supabase.from('procesos').insert({
      nombre: form.nombre, cargo: form.cargo, descripcion: form.descripcion,
      descripcion_cargo: form.descripcion_cargo, competencias_requeridas: form.competencias_requeridas,
      activo: true, bateria_tests: form.bateria_tests
    })
    if (!error) {
      setForm({ nombre: '', cargo: '', descripcion: '', descripcion_cargo: '', bateria_tests: [], competencias_requeridas: [] })
      setMostrarForm(false)
      cargarDatos()
    }
    setGuardando(false)
  }

  async function asignarCandidato(candidatoId: string) {
    if (!procesoSeleccionado) return
    setAgregando(candidatoId)
    
    const slugPrimerTest = procesoSeleccionado.bateria_tests?.[0] || 'control'
    let testIdFinal = slugPrimerTest

    // Traducir slug a UUID si existe en el mapa
    if (slugPrimerTest.startsWith('entrevista:')) {
      testIdFinal = slugPrimerTest.split(':')[1]
    } else if (SLUG_TO_ID[slugPrimerTest]) {
      testIdFinal = SLUG_TO_ID[slugPrimerTest]
    }
    
    // 1. Verificar si ya existe el vínculo (sesión)
    const { data: existe } = await supabase
      .from('sesiones')
      .select('id')
      .eq('candidato_id', candidatoId)
      .eq('proceso_id', procesoSeleccionado.id)
      .limit(1)

    // 2. Si no existe, crear la sesión inicial con el ID real (UUID)
    if (!existe || existe.length === 0) {
      const { error } = await supabase
        .from('sesiones')
        .insert({
          candidato_id: candidatoId,
          proceso_id: procesoSeleccionado.id,
          test_id: testIdFinal,
          estado: 'pendiente'
        })
      
      if (error) {
        console.error('Error al crear vínculo:', error.message)
      }
    }

    await cargarDatos()

    const link = `${getBaseUrl()}/evaluacion?candidato=${candidatoId}&proceso=${procesoSeleccionado.id}`
    navigator.clipboard.writeText(link)
    setTimeout(() => setAgregando(''), 1500)
  }

  async function desvincularCandidato(candidatoId: string) {
    if (!procesoSeleccionado) return
    if (!confirm('¿Estás seguro de desvincular a este candidato de este proceso? Dejará de figurar en esta vacante.')) return
    
    // En lugar de borrar (que daría error 409 si hay resultados), desvinculamos el proceso
    const { error } = await supabase
      .from('sesiones')
      .update({ proceso_id: null })
      .eq('candidato_id', candidatoId)
      .eq('proceso_id', procesoSeleccionado.id)

    if (!error) {
      cargarDatos()
    } else {
      console.error('Error al desvincular:', error.message)
    }
  }

  async function enviarRecordatorio(c: Candidato) {
    if (!procesoSeleccionado) return
    setEnviandoRecordatorio(c.id)
    
    // Calcular pendientes basado en la batería del proceso vs sesiones existentes
    const link = `${getBaseUrl()}/evaluacion?candidato=${c.id}&proceso=${procesoSeleccionado.id}`

    try {
      const res = await fetch('/api/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: c.email, 
          nombre: c.nombre, 
          proceso: procesoSeleccionado.cargo, 
          link, 
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

  // Identificar participantes de un proceso basado en sesiones
  useEffect(() => {
    if (procesoSeleccionado) {
      const idsParticipantes = new Set(sesiones.filter(s => s.proceso_id === procesoSeleccionado.id).map(s => s.candidato_id))
      const vinculados = candidatos.filter(c => idsParticipantes.has(c.id))
      setCandidatosProceso(vinculados)
    } else {
      setCandidatosProceso([])
    }
  }, [procesoSeleccionado, sesiones, candidatos])

  async function repararVinculos() {
    if (!procesoSeleccionado) return
    setProcesandoMasivo(true)
    try {
      const slugPrimerTest = procesoSeleccionado.bateria_tests?.[0] || 'control'
      let testIdFinal = slugPrimerTest
      if (slugPrimerTest.startsWith('entrevista:')) testIdFinal = slugPrimerTest.split(':')[1]
      else if (SLUG_TO_ID[slugPrimerTest]) testIdFinal = SLUG_TO_ID[slugPrimerTest]

      // Vincular a TODOS los candidatos que no tengan proceso_id o que estén huérfanos
      const sesionesNuevas = candidatos.map(c => ({
        candidato_id: c.id,
        proceso_id: procesoSeleccionado.id,
        test_id: testIdFinal,
        estado: 'pendiente'
      }))

      const { error } = await supabase
        .from('sesiones')
        .upsert(sesionesNuevas, { onConflict: 'candidato_id,proceso_id' })
      
      if (error) throw error
      
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
      // Cargamos por separado para que si uno falla no bloquee al resto
      const { data: pData, error: pe } = await supabase.from('procesos').select('*').order('creado_en', { ascending: false })
      const { data: cData, error: ce } = await supabase.from('candidatos').select('id, nombre, apellido, email').order('creado_en', { ascending: false })
      const { data: eData, error: ee } = await supabase.from('entrevistas_video').select('id, nombre').order('creada_en', { ascending: false })
      const { data: sData, error: se } = await supabase.from('sesiones').select('*')

      if (pe) console.error('Error Procesos:', pe)
      if (ce) console.error('Error Candidatos:', ce)
      if (se) console.error('Error Sesiones:', se)

      console.log('RECUENTO:', {
        p: pData?.length || 0,
        c: cData?.length || 0,
        s: sData?.length || 0
      })

      if (pData) setProcesos(pData)
      if (cData) setCandidatos(cData)
      if (eData) setEntrevistas(eData)
      if (sData) setSesiones(sData)
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
            onClick={() => setMostrarForm(!mostrarForm)}
            className={`px-4 py-2 text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
              mostrarForm ? 'bg-white border border-slate-200 text-slate-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {mostrarForm ? 'Cerrar' : <><Plus className="w-4 h-4" /> Nuevo Proceso</>}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-8 shadow-xl animate-in slide-in-from-top-4 duration-300">
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

          <div className="flex justify-end">
            <button
              onClick={guardarProceso}
              disabled={guardando || !form.nombre || !form.cargo}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Crear Proceso'}
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
              className={`p-4 bg-white border rounded-2xl cursor-pointer transition-all ${
                procesoSeleccionado?.id === p.id ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800">{p.nombre}</h3>
                  <p className="text-xs text-indigo-600 font-bold">{p.cargo}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
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
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{procesoSeleccionado.cargo}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {procesoSeleccionado.id.slice(0,8)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const csvData = candidatosProceso.map(c => {
                        // Encontrar la sesión para este proceso y obtener su estado/fecha
                        const sesion = sesiones.find(s => s.candidato_id === c.id && s.proceso_id === procesoSeleccionado.id)
                        return {
                          Nombre: c.nombre,
                          Apellido: c.apellido,
                          Email: c.email,
                          Estado: sesion?.estado || 'Sin iniciar',
                          Fecha_Asignacion: sesion?.creado_en ? new Date(sesion.creado_en).toLocaleDateString() : 'N/A',
                          Link_Evaluacion: `${getBaseUrl()}/evaluacion?candidato=${c.id}&proceso=${procesoSeleccionado.id}`
                        }
                      })
                      const csv = Papa.unparse(csvData)
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                      const link = document.createElement('a')
                      link.href = URL.createObjectURL(blob)
                      link.setAttribute('download', `Links_${procesoSeleccionado.cargo.replace(/\s+/g, '_')}.csv`)
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-bold transition-all"
                    title="Exportar lista con links para Gmail"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORTAR LINKS
                  </button>
                  {/* Botones de acción del proceso si se necesitan en el futuro */}
                </div>
              </div>

              <div className="space-y-8">
                {/* PARTICIPANTES ACTUALES */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Participantes en este proceso
                    </h4>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {candidatosProceso.length} total
                    </span>
                  </div>
                  
                  {candidatosProceso.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                      {candidatosProceso.map(c => (
                        <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center group hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 transition-all">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{c.nombre} {c.apellido}</p>
                            <p className="text-[10px] text-slate-500 truncate">{c.email}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-4">
                            <button 
                              onClick={() => {
                                const link = `${getBaseUrl()}/evaluacion?candidato=${c.id}&proceso=${procesoSeleccionado.id}`
                                navigator.clipboard.writeText(link)
                                alert('Link copiado al portapapeles')
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
