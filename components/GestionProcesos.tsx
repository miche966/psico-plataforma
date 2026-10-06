'use client'

import { useEffect, useRef, useState } from 'react'
import { Link as LinkIcon, FileText, X, BellRing, Upload, ClipboardPaste, UserPlus, Download, Video } from 'lucide-react'
import { getAdminHeaders, obtenerLinkEvaluacion } from '@/lib/evaluacionLink'
import { useAdminRole } from '@/lib/useAdminRole'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'
import { EsqueletoLista } from '@/components/Esqueleto'
import { calcularProgresoEvaluacion } from '@/lib/progresoEvaluacion'

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
  const { role } = useAdminRole()
  const esViewer = role === 'viewer'
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
  const [preguntasVideo, setPreguntasVideo] = useState<any[]>([])
  const [busquedaAsignar, setBusquedaAsignar] = useState('')
  const [error, setError] = useState(false)
  const primeraCarga = useRef(true)   // el esqueleto solo se muestra la primera vez: al asignar o editar la lista no tiene que parpadear
  const botonCerrarMasivoRef = useRef<HTMLButtonElement>(null)

  // La carga masiva se cierra con Escape, el foco entra al abrirla y vuelve al botón que la abrió
  useEffect(() => {
    if (!mostrarCargaMasiva) return
    const abridor = document.activeElement as HTMLElement | null
    botonCerrarMasivoRef.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setMostrarCargaMasiva(false) }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      abridor?.focus?.()
    }
  }, [mostrarCargaMasiva])

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
      const omitidos = resultado.omitidos ? `\n\nSe omitieron ${resultado.omitidos} fila(s) por tener un correo inválido o estar repetidas en el archivo.` : ''
      alert(`Carga completada: ${resultado.total ?? candidatosParaCargar.length} candidatos procesados correctamente.${omitidos}`)
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
    if (primeraCarga.current) setCargando(true)
    setError(false)
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

      if (payload.data) setProcesos(payload.data)
      if (payload.candidatos) setCandidatos(payload.candidatos)
      if (payload.entrevistas) setEntrevistas(payload.entrevistas)
      if (payload.sesiones) setSesiones(payload.sesiones)
      if (payload.respuestasVideo) setVideoRespuestas(payload.respuestasVideo)
      if (payload.preguntasVideo) setPreguntasVideo(payload.preguntasVideo)
      setProgresoOperativo(Array.isArray(progresoJson.data) ? progresoJson.data : [])
      setRecordatorios(Array.isArray(recordatoriosJson.data) ? recordatoriosJson.data : [])
    } catch (err) {
      console.error('Falla total:', err)
      if (primeraCarga.current) setError(true)
    } finally {
      primeraCarga.current = false
      setCargando(false)
    }
  }

  const procesosFiltrados = procesos.filter(p =>
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    p.cargo.toLowerCase().includes(filtro.toLowerCase())
  )

  async function exportarLinks() {
    if (!procesoSeleccionado) return
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
  }

  function alternarFormulario() {
    if (mostrarForm) {
      setMostrarForm(false)
      setModoEdicion(false)
    } else {
      setForm({ nombre: '', cargo: '', descripcion: '', descripcion_cargo: '', bateria_tests: [], competencias_requeridas: [] })
      setModoEdicion(false)
      setMostrarForm(true)
    }
  }

  if (cargando) return <EsqueletoLista />

  if (error) {
    return (
      <div role="alert" className="py-12 text-center">
        <p className="text-slate-900 font-medium mb-1">No se pudieron cargar los procesos.</p>
        <p className="text-sm text-slate-500 mb-4">Revisá tu conexión y probá de nuevo.</p>
        <button
          type="button"
          onClick={cargarDatos}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Avance de cada participante del proceso elegido: mismo cálculo que el panel (solo sesiones finalizadas de ESTE proceso,
  // videoentrevista completa), en vez de contar cualquier sesión del candidato, incluida la pendiente que se crea al asignarlo
  const bateriaProceso = procesoSeleccionado?.bateria_tests || []
  const participantes = procesoSeleccionado
    ? candidatosProceso
      .map(c => {
        const sesionesDe = sesiones.filter(s => s.candidato_id === c.id && s.proceso_id === procesoSeleccionado.id)
        const videosDe = videoRespuestas.filter(v => v.candidato_id === c.id)
        const progreso = calcularProgresoEvaluacion(bateriaProceso, sesionesDe, videosDe, preguntasVideo)
        const tieneActividad = progresoOperativo.some(p => p.candidato_id === c.id && p.proceso_id === procesoSeleccionado.id && ['en_curso', 'pausada'].includes(p.estado))
        let estado: 'completada' | 'en curso' | 'pendiente' = 'en curso'
        if (progreso.completados === 0 && !tieneActividad) estado = 'pendiente'
        else if (progreso.total > 0 && progreso.completados >= progreso.total) estado = 'completada'
        return { ...c, comp: progreso.completados, total: progreso.total, estado }
      })
      .filter(c => filtroEstado === 'todos' || c.estado === filtroEstado)
      .filter(c => {
        const q = busquedaParticipante.trim().toLowerCase()
        if (!q) return true
        return `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
      })
    : []

  // Candidatos que se pueden sumar: los que todavía no están en este proceso (y se avisa si ya participan en otro)
  const idsParticipantes = new Set(candidatosProceso.map(c => c.id))
  const idsEnOtroProceso = new Set(sesiones.filter(s => s.proceso_id && s.proceso_id !== procesoSeleccionado?.id).map(s => s.candidato_id))
  const qAsignar = busquedaAsignar.trim().toLowerCase()
  const asignables = candidatos.filter(c =>
    !idsParticipantes.has(c.id) &&
    (!qAsignar || `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase().includes(qAsignar) || (c.email || '').toLowerCase().includes(qAsignar))
  )
  const LIMITE_ASIGNABLES = 40

  const etiquetaPrueba = (clave: string) => {
    if (clave.startsWith('entrevista:')) return entrevistas.find(e => `entrevista:${e.id}` === clave)?.nombre || 'Videoentrevista'
    return TESTS_DISPONIBLES.find(t => t.key === clave)?.label || clave
  }
  const SERIF = { fontFamily: 'var(--font-lectura), Georgia, serif' }
  const PUNTO_ESTADO = { completada: 'bg-indigo-600', 'en curso': 'bg-marcador', pendiente: 'bg-slate-300' }
  const TEXTO_ESTADO = { completada: 'Completada', 'en curso': 'En curso', pendiente: 'Pendiente' }
  const campo = 'w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600'

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Gestión de procesos</h2>
        {!esViewer && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMostrarCargaMasiva(true)}
              className="px-4 py-2 text-sm font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Carga masiva
            </button>
            <button
              type="button"
              onClick={alternarFormulario}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                mostrarForm ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {mostrarForm ? 'Cancelar' : 'Nuevo proceso'}
            </button>
          </div>
        )}
      </div>

      {mostrarForm && (
        <section aria-labelledby="gestion-form-titulo" className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
          <h3 id="gestion-form-titulo" className="text-lg font-semibold text-slate-900 mb-5" style={SERIF}>{modoEdicion ? 'Editar proceso' : 'Nuevo proceso de selección'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="space-y-1.5">
              <label htmlFor="gestion-nombre" className="text-sm font-medium text-slate-700">Nombre del proceso</label>
              <input id="gestion-nombre"
                className={campo}
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Analista senior de TI"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gestion-cargo" className="text-sm font-medium text-slate-700">Cargo o vacante</label>
              <input id="gestion-cargo"
                className={campo}
                value={form.cargo}
                onChange={e => setForm({ ...form, cargo: e.target.value })}
                placeholder="Ej: Desarrollador fullstack"
              />
            </div>
          </div>

          <fieldset className="mb-6">
            <legend className="text-sm font-medium text-slate-700 mb-2">Pruebas de la batería ({form.bateria_tests.filter(k => !k.startsWith('entrevista:')).length} elegidas)</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {TESTS_DISPONIBLES.map(t => (
                <label key={t.key} className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-white cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.bateria_tests.includes(t.key)}
                    onChange={e => {
                      const next = e.target.checked ? [...form.bateria_tests, t.key] : form.bateria_tests.filter(k => k !== t.key)
                      setForm({ ...form, bateria_tests: next })
                    }}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mb-6">
            <legend className="text-sm font-medium text-slate-700 mb-2">Videoentrevistas</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {entrevistas.map(e => (
                <label key={e.id} className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-white cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.bateria_tests.includes(`entrevista:${e.id}`)}
                    onChange={ec => {
                      const key = `entrevista:${e.id}`
                      const next = ec.target.checked ? [...form.bateria_tests, key] : form.bateria_tests.filter(k => k !== key)
                      setForm({ ...form, bateria_tests: next })
                    }}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <Video className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  {e.nombre}
                </label>
              ))}
              {entrevistas.length === 0 && (
                <p className="text-sm text-slate-500 p-1">Todavía no hay videoentrevistas creadas.</p>
              )}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={alternarFormulario}
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarProceso}
              disabled={guardando || !form.nombre || !form.cargo || esViewer}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : modoEdicion ? 'Guardar cambios' : 'Crear proceso'}
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <input
            aria-label="Buscar proceso"
            className={`${campo} mb-3`}
            placeholder="Buscar proceso"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
          <ul className="border border-slate-200 rounded-xl bg-white overflow-hidden divide-y divide-slate-100">
            {procesosFiltrados.map(p => {
              const nCand = new Set(sesiones.filter(s => s.proceso_id === p.id).map(s => s.candidato_id)).size
              const elegido = procesoSeleccionado?.id === p.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setProcesoSeleccionado(p)}
                    aria-current={elegido ? 'true' : undefined}
                    className={`w-full text-left px-4 py-3.5 transition-colors ${elegido ? 'bg-slate-100 shadow-[inset_4px_0_0_var(--marcador)]' : 'hover:bg-slate-50'}`}
                  >
                    <div className="font-semibold text-slate-900 leading-snug">{nombreDeProcesoLegible(p.nombre)}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{p.cargo}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {p.activo ? 'Abierto' : 'Cerrado'} · {nCand} {nCand === 1 ? 'candidato' : 'candidatos'}
                    </div>
                  </button>
                </li>
              )
            })}
            {procesosFiltrados.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                {procesos.length === 0 ? 'Todavía no hay procesos. Creá el primero con “Nuevo proceso”.' : 'No hay procesos que coincidan con la búsqueda.'}
              </li>
            )}
          </ul>
        </div>

        <div className="lg:col-span-8">
          {procesoSeleccionado ? (
            <div className="space-y-8">
              <header className="pb-6 border-b border-slate-200">
                <h3 className="text-2xl font-semibold text-slate-900" style={SERIF}>{nombreDeProcesoLegible(procesoSeleccionado.nombre)}</h3>
                <p className="text-slate-600 mt-1">{procesoSeleccionado.cargo} · {procesoSeleccionado.activo ? 'Abierto' : 'Cerrado'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {!esViewer && (
                    <button
                      type="button"
                      onClick={iniciarEdicion}
                      className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-bold transition-colors"
                    >
                      Editar proceso
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={exportandoLinks}
                    onClick={exportarLinks}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-bold transition-colors border border-slate-300 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    {exportandoLinks ? 'Generando…' : 'Exportar links'}
                  </button>
                  {!esViewer && (
                    <button
                      type="button"
                      onClick={(e) => toggleEstado(procesoSeleccionado, e)}
                      className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-bold transition-colors border border-slate-300"
                    >
                      {procesoSeleccionado.activo ? 'Cerrar proceso' : 'Reabrir proceso'}
                    </button>
                  )}
                  {!esViewer && (
                    <button
                      type="button"
                      onClick={(e) => eliminarProceso(procesoSeleccionado.id, e)}
                      className="ml-auto px-3 py-2 text-sm font-bold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    >
                      Eliminar proceso
                    </button>
                  )}
                </div>
              </header>

              <section aria-labelledby="gestion-bateria">
                <h4 id="gestion-bateria" className="text-lg font-semibold text-slate-900 mb-3" style={SERIF}>
                  Batería de pruebas ({bateriaProceso.length})
                </h4>
                {bateriaProceso.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {bateriaProceso.map(tKey => (
                      <li key={tKey} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-sm rounded-md flex items-center gap-1.5">
                        {tKey.startsWith('entrevista:') && <Video className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
                        {etiquetaPrueba(tKey)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Este proceso no tiene pruebas asignadas.</p>
                )}
              </section>

              <section aria-labelledby="gestion-participantes">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h4 id="gestion-participantes" className="text-lg font-semibold text-slate-900" style={SERIF}>
                    Participantes ({candidatosProceso.length})
                  </h4>
                  {candidatosProceso.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        aria-label="Buscar participante por nombre o correo"
                        type="text"
                        placeholder="Buscar por nombre o correo"
                        value={busquedaParticipante}
                        onChange={e => setBusquedaParticipante(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 w-52"
                      />
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg" role="group" aria-label="Filtrar por estado">
                        {[
                          { id: 'todos', label: 'Todos' },
                          { id: 'completada', label: 'Completadas' },
                          { id: 'en curso', label: 'En curso' },
                          { id: 'pendiente', label: 'Pendientes' },
                        ].map(f => (
                          <button
                            key={f.id}
                            type="button"
                            aria-pressed={filtroEstado === f.id}
                            onClick={() => setFiltroEstado(f.id as any)}
                            className={`px-2.5 py-1 rounded-md text-sm transition-colors ${
                              filtroEstado === f.id ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-white/60'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {candidatosProceso.length > 0 ? (
                  <ul className="border border-slate-200 rounded-xl bg-white overflow-hidden divide-y divide-slate-100">
                    {participantes.map(c => {
                      const ultimoRecordatorio = recordatorios
                        .filter(r => r.candidato_id === c.id && r.proceso_id === procesoSeleccionado.id)
                        .sort((a, b) => new Date(b.enviado_en).getTime() - new Date(a.enviado_en).getTime())[0]
                      const fecha = ultimoRecordatorio
                        ? new Date(ultimoRecordatorio.enviado_en).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : ''
                      const nombreCompleto = `${c.nombre} ${c.apellido}`.trim()
                      return (
                        <li key={c.id} className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="min-w-0 flex-1 basis-56">
                            <p className="font-semibold text-slate-900 truncate">{nombreCompleto}</p>
                            <p className="text-sm text-slate-500 truncate">{c.email}</p>
                            {ultimoRecordatorio && (
                              <p className={`text-sm mt-0.5 flex items-center gap-1 ${ultimoRecordatorio.estado === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                                <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                                {ultimoRecordatorio.estado === 'error' ? 'El recordatorio falló' : 'Último recordatorio'}: {fecha}
                              </p>
                            )}
                          </div>
                          <div className="w-44 shrink-0">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <span className={`w-2.5 h-2.5 rounded-full ${PUNTO_ESTADO[c.estado]}`} aria-hidden="true" />
                              {TEXTO_ESTADO[c.estado]}
                              <span className="ml-auto tabular-nums text-slate-500">{c.comp} de {c.total}</span>
                            </div>
                            <div className="h-1.5 mt-1.5 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                              <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${c.total ? (c.comp / c.total) * 100 : 0}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const link = await obtenerLinkEvaluacion(c.id, procesoSeleccionado.id)
                                  await copiarAlPortapapeles(link, 'Link copiado al portapapeles')
                                } catch (err: any) {
                                  alert('No se pudo generar el link: ' + (err.message || err))
                                }
                              }}
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Copiar link de evaluación"
                              aria-label={`Copiar el link de evaluación de ${nombreCompleto}`}
                            >
                              <LinkIcon className="w-4 h-4" aria-hidden="true" />
                            </button>
                            {!esViewer && (
                              <button
                                type="button"
                                onClick={() => enviarRecordatorio(c)}
                                disabled={enviandoRecordatorio === c.id}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Enviar recordatorio"
                                aria-label={`Enviar un recordatorio a ${nombreCompleto}`}
                              >
                                <BellRing className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                            {!esViewer && (
                              <button
                                type="button"
                                onClick={() => desvincularCandidato(c.id)}
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Desvincular del proceso"
                                aria-label={`Desvincular a ${nombreCompleto} del proceso`}
                              >
                                <X className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                    {participantes.length === 0 && (
                      <li className="px-4 py-8 text-center text-sm text-slate-500">Ningún participante coincide con el filtro.</li>
                    )}
                  </ul>
                ) : (
                  <div className="py-8 px-6 text-center border border-dashed border-slate-300 rounded-xl">
                    <p className="text-slate-700">Este proceso todavía no tiene participantes.</p>
                    <p className="text-sm text-slate-500 mt-1">Sumalos desde la lista de abajo o con “Carga masiva”.</p>
                    {!esViewer && (
                      <details className="mt-5 text-left max-w-lg mx-auto">
                        <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">¿Se perdieron los participantes de este proceso?</summary>
                        <div className="mt-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                          <p>
                            Recuperar los vínculos <strong>asigna a este proceso a los {candidatos.length} candidatos de la base</strong>, no solo a los que estaban antes.
                            Usalo únicamente para reconstruir un proceso cuyos vínculos se perdieron.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Esto asignará a ${procesoSeleccionado.cargo} a los ${candidatos.length} candidatos de la base. ¿Querés continuar?`)) repararVinculos()
                            }}
                            disabled={procesandoMasivo}
                            className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-60"
                          >
                            {procesandoMasivo ? 'Recuperando…' : 'Recuperar vínculos'}
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </section>

              {!esViewer && (
                <section aria-labelledby="gestion-asignar" className="pt-8 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h4 id="gestion-asignar" className="text-lg font-semibold text-slate-900" style={SERIF}>Sumar candidatos</h4>
                    <input
                      aria-label="Buscar candidato para sumar al proceso"
                      type="text"
                      placeholder="Buscar por nombre o correo"
                      value={busquedaAsignar}
                      onChange={e => setBusquedaAsignar(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 w-56"
                    />
                  </div>
                  <ul className="border border-slate-200 rounded-xl bg-white overflow-hidden divide-y divide-slate-100 max-h-[22rem] overflow-y-auto custom-scrollbar-visible">
                    {asignables.slice(0, LIMITE_ASIGNABLES).map(c => (
                      <li key={c.id} className="px-4 py-2.5 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 truncate">{c.nombre} {c.apellido}</p>
                          <p className="text-sm text-slate-500 truncate">
                            {c.email}{idsEnOtroProceso.has(c.id) ? ' · ya participa en otro proceso' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => asignarCandidato(c.id)}
                          disabled={agregando !== ''}
                          aria-label={`Sumar a ${c.nombre} ${c.apellido} al proceso`}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-60 ${
                            agregando === c.id ? 'bg-indigo-600 text-white' : 'border border-indigo-600 text-indigo-700 hover:bg-indigo-50'
                          }`}
                        >
                          {agregando === c.id ? 'Sumado' : 'Sumar'}
                        </button>
                      </li>
                    ))}
                    {asignables.length === 0 && (
                      <li className="px-4 py-8 text-center text-sm text-slate-500">
                        {qAsignar ? 'Ningún candidato coincide con la búsqueda.' : 'Todos los candidatos ya están en este proceso.'}
                      </li>
                    )}
                  </ul>
                  {asignables.length > LIMITE_ASIGNABLES && (
                    <p className="mt-2 text-sm text-slate-500">Se muestran {LIMITE_ASIGNABLES} de {asignables.length}. Buscá por nombre o correo para acotar.</p>
                  )}
                  <p className="mt-2 text-sm text-slate-500">Al sumar a alguien se copia su link de evaluación al portapapeles.</p>
                </section>
              )}
            </div>
          ) : (
            <div className="py-16 text-center border border-dashed border-slate-300 rounded-xl text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" aria-hidden="true" />
              Elegí un proceso de la lista para ver sus participantes.
            </div>
          )}
        </div>
      </div>

      {mostrarCargaMasiva && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={() => setMostrarCargaMasiva(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="carga-masiva-titulo"
            className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 flex justify-between items-start gap-4">
              <div>
                <h3 id="carga-masiva-titulo" className="text-lg font-semibold text-slate-900" style={SERIF}>Carga masiva de candidatos</h3>
                <p className="text-sm text-slate-500 mt-1">Sumá varios candidatos de una vez, desde un archivo o pegando una lista.</p>
              </div>
              <button
                ref={botonCerrarMasivoRef}
                type="button"
                onClick={() => setMostrarCargaMasiva(false)}
                className="p-2 -m-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Cerrar la carga masiva"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-5" role="group" aria-label="Forma de carga">
                <button
                  type="button"
                  aria-pressed={tabMasivo === 'archivo'}
                  onClick={() => setTabMasivo('archivo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-colors ${tabMasivo === 'archivo' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  Subir archivo
                </button>
                <button
                  type="button"
                  aria-pressed={tabMasivo === 'texto'}
                  onClick={() => setTabMasivo('texto')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm transition-colors ${tabMasivo === 'texto' ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:bg-white/60'}`}
                >
                  <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
                  Pegar lista
                </button>
              </div>

              {tabMasivo === 'archivo' ? (
                <div>
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="sr-only peer" id="csv-upload" disabled={procesandoMasivo} />
                  <label
                    htmlFor="csv-upload"
                    className="block cursor-pointer border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 transition-colors bg-slate-50"
                  >
                    <FileText className="w-8 h-8 mx-auto mb-3 text-indigo-600" aria-hidden="true" />
                    <span className="block font-semibold text-slate-800">{procesandoMasivo ? 'Procesando el archivo…' : 'Elegir un archivo de Excel o CSV'}</span>
                    <span className="block text-sm text-slate-500 mt-1">La primera fila debe tener las columnas nombre, apellido y email.</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    aria-label="Participantes a cargar: una persona por línea, con nombre, apellido y correo"
                    className="w-full h-48 p-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 resize-none font-mono"
                    placeholder={'Juan, Pérez, juan@email.com\nMaría, López, maria@email.com'}
                    value={textoMasivo}
                    onChange={(e) => setTextoMasivo(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!textoMasivo.trim() || procesandoMasivo}
                    onClick={handleTextoMasivo}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {procesandoMasivo ? 'Procesando…' : 'Cargar lista'}
                  </button>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 border-t text-sm ${procesoSeleccionado ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              {procesoSeleccionado
                ? <>Los candidatos se van a asignar al proceso <strong>{procesoSeleccionado.cargo}</strong>.</>
                : <>No hay un proceso elegido: los candidatos se cargan en la base, pero no se asignan a ningún proceso.</>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
