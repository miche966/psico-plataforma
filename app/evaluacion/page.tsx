'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Marco } from '@/components/candidato/Marco'
import { PantallaAviso, PantallaCarga, PantallaError, PantallaFin } from '@/components/candidato/Estados'


const RUTAS: Record<string, string> = {
  bigfive: '/test',
  hexaco: '/hexaco',
  numerico: '/numerico',
  verbal: '/verbal',
  integridad: '/integridad',
  icar: '/icar',
  comercial: '/comercial',
  dass21: '/dass21',
  'sjt-comercial': '/sjt-comercial',
  'tolerancia-frustracion': '/tolerancia-frustracion',
  'sjt-cobranzas': '/sjt-cobranzas',
  'sjt-atencion': '/sjt-atencion',
  'sjt-ventas': '/sjt-ventas',
  'atencion-detalle': '/atencion-detalle',
  'sjt-legal': '/sjt-legal',
  'estres-laboral': '/estres-laboral',
  creatividad: '/creatividad',
  'sjt-problemas': '/sjt-problemas',
  roleplay: '/roleplay',
  roleplay_atencion: '/roleplay?tipo=atencion',
  'frases-incompletas': '/frases-incompletas',
  'iniciativa-dinamismo': '/iniciativa-dinamismo',
}

const NOMBRES_TESTS: Record<string, { nombre: string, duracion: string }> = {
  bigfive: { nombre: 'Test de Personalidad (Big Five)', duracion: '15-20 min' },
  hexaco: { nombre: 'Perfil de Personalidad (HEXACO)', duracion: '20 min' },
  numerico: { nombre: 'Razonamiento Numérico', duracion: '15 min' },
  verbal: { nombre: 'Razonamiento Verbal', duracion: '15 min' },
  integridad: { nombre: 'Test de Integridad Laboral', duracion: '10 min' },
  icar: { nombre: 'Razonamiento Cognitivo Abstracto (ICAR)', duracion: '15 min' },
  dass21: { nombre: 'Screening de Salud Mental (DASS-21)', duracion: '15 min' },
  comercial: { nombre: 'Perfil Comercial', duracion: '15 min' },
  'sjt-comercial': { nombre: 'Casos Prácticos: Comercial', duracion: '20 min' },
  'tolerancia-frustracion': { nombre: 'Tolerancia a la Frustración', duracion: '10 min' },
  'sjt-cobranzas': { nombre: 'Casos Prácticos: Cobranzas', duracion: '20 min' },
  'sjt-atencion': { nombre: 'Casos Prácticos: Atención al Cliente', duracion: '15 min' },
  'sjt-ventas': { nombre: 'Casos Prácticos: Ventas', duracion: '20 min' },
  'atencion-detalle': { nombre: 'Atención al Detalle', duracion: '10 min' },
  'sjt-legal': { nombre: 'Casos Prácticos: Legal', duracion: '20 min' },
  'estres-laboral': { nombre: 'Afrontamiento del Estrés', duracion: '15 min' },
  creatividad: { nombre: 'Creatividad e Innovación', duracion: '15 min' },
  'sjt-problemas': { nombre: 'Resolución de Problemas', duracion: '20 min' },
  'iniciativa-dinamismo': { nombre: 'Iniciativa y Dinamismo', duracion: '10 min' },
  'frases-incompletas': { nombre: 'Frases Incompletas', duracion: '15 min' },
  roleplay: { nombre: 'Role Play: Cobranzas (IA)', duracion: '15-20 min' },
  roleplay_atencion: { nombre: 'Role Play: Atención al Cliente (IA)', duracion: '15-20 min' },
}

export default function PortalCandidatoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const candidatoIdRaw = searchParams.get('candidato')
  const procesoIdRaw = searchParams.get('proceso')
  const candidatoId = candidatoIdRaw ? candidatoIdRaw.trim() : null
  const procesoId = procesoIdRaw ? procesoIdRaw.trim() : null

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [candidato, setCandidato] = useState<any>(null)
  const [proceso, setProceso] = useState<any>(null)
  const [bateria, setBateria] = useState<string[]>([])
  const [testsCompletados, setTestsCompletados] = useState<string[]>([])

  const [mostrarSetup, setMostrarSetup] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (!candidatoId || !procesoId) {
      setError('Link inválido. Por favor, contacta al equipo de selección.')
      setCargando(false)
      return
    }

    cargarDatosPortal()
  }, [candidatoId, procesoId])

  async function activarCamara() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setStream(s)
    } catch (err) {
      console.error("Error al activar cámara:", err)
      alert("No pudimos acceder a tu cámara o micrófono. Por favor, asegúrate de dar los permisos necesarios en tu navegador.")
    }
  }

  function detenerCamara() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setMostrarSetup(false)
  }

  async function cargarDatosPortal() {
    try {
      const token = searchParams.get('token') || ''
      const response = await fetch('/api/evaluacion-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidato_id: candidatoId, proceso_id: procesoId, token }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'El enlace de evaluacion no es valido')

      const cand = payload.candidato
      const proc = payload.proceso
      const sesiones: Array<{ test_id: string, estado: string }> = payload.sesiones || []
      const respuestasVideo: Array<{ entrevista_id: string }> = payload.respuestasVideo || []
      const completadosDB: string[] = payload.progreso?.testsCompletados || []

      setCandidato(cand)
      setProceso(proc)

      const bat = proc.bateria_tests || []
      setBateria(bat)

      // Determinar si mostrar setup (si es la primera vez o hay entrevistas)
      const yaMostro = localStorage.getItem(`setup_done_${candidatoId}`)
      if (!yaMostro) {
        setMostrarSetup(true)
      }

      // 1. Cargar desde LocalStorage
      const completadosLocal: string[] = []

      const debugData: any = { raw_sessions: sesiones, raw_videos: respuestasVideo }

      const merge = Array.from(new Set([...completadosLocal, ...completadosDB]))
      setTestsCompletados(merge)
      localStorage.setItem(`completados_${candidatoId}_${procesoId}`, JSON.stringify(merge))
      
      if (searchParams.get('debug') === '1') {
        (window as any).debugInfo = { ...debugData, merge, bateria: bat }
      }

    } catch (err: any) {
      setError(err.message || 'Error cargando el portal')
    } finally {
      setCargando(false)
    }
  }

  function iniciarTest(testKey: string) {
    localStorage.setItem(`last_started_${candidatoId}_${procesoId}`, testKey)
    const token = searchParams.get('token')
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''

    if (testKey.startsWith('entrevista:')) {
      const id = testKey.split(':')[1]
      router.push(`/entrevista-video/responder?entrevista=${id}&candidato=${candidatoId}&proceso=${procesoId}&evaluacion=1${tokenParam}`)
      return
    }

    const ruta = RUTAS[testKey]
    if (!ruta) return
    const separador = ruta.includes('?') ? '&' : '?'
    router.push(`${ruta}${separador}candidato=${candidatoId}&proceso=${procesoId}&evaluacion=1${tokenParam}`)
  }
  // Hook para detectar si acaba de volver de un test y marcarlo completado
  useEffect(() => {
    if (cargando) return
    const completedParam = searchParams.get('completed') === '1'
    
    if (completedParam) {
      const ultimoIniciado = localStorage.getItem(`last_started_${candidatoId}_${procesoId}`)
      if (ultimoIniciado && !testsCompletados.includes(ultimoIniciado)) {
        const nuevosCompletados = [...testsCompletados, ultimoIniciado]
        setTestsCompletados(nuevosCompletados)
        localStorage.setItem(`completados_${candidatoId}_${procesoId}`, JSON.stringify(nuevosCompletados))
        // Limpiamos el ultimo iniciado para evitar duplicados en refrescos
        localStorage.removeItem(`last_started_${candidatoId}_${procesoId}`)
      }
    }
  }, [cargando, searchParams, candidatoId, procesoId, testsCompletados])

  if (cargando) return <PantallaCarga texto="Preparando tu portal…" />

  if (mostrarSetup) {
    // Solo se dice "listo" de lo que realmente esta activo
    const hayCamara = !!stream
    const hayMicrofono = !!stream && stream.getAudioTracks().length > 0
    return (
      <Marco titulo="Antes de empezar" ancho>
        <div className="pp-preparacion">
          <h1 className="pp-titulo pp-prep-titulo">Hola, {candidato?.nombre}</h1>
          <div className="pp-prep-texto">
            <p className="pp-lead">Antes de empezar, comprobemos que tu equipo esté listo. Para las video-entrevistas conviene que tu rostro esté bien iluminado y centrado, y que estés en un lugar tranquilo.</p>
          </div>

          <section className="pp-camara pp-prep-camara" aria-label="Prueba de cámara y micrófono">
            <div className="pp-camara-vista">
              {stream ? (
                <video autoPlay muted playsInline ref={el => { if (el) el.srcObject = stream }} className="pp-camara-video" />
              ) : (
                <p>Activá la cámara para ver tu imagen</p>
              )}
            </div>
            {!stream && <button type="button" className="pp-boton" onClick={activarCamara}>Activar cámara y micrófono</button>}
          </section>

          <div className="pp-prep-accion">
            <ul className="pp-chequeo" aria-label="Estado del equipo" aria-live="polite">
              <li data-listo={hayCamara}>{hayCamara ? 'Cámara lista' : 'Cámara sin activar'}</li>
              <li data-listo={hayMicrofono}>{hayMicrofono ? 'Micrófono detectado' : 'Micrófono sin activar'}</li>
            </ul>
            <p className="pp-muted">Al continuar, confirmás que tu equipo funciona bien y que estás en un lugar tranquilo para hacer las pruebas.</p>
            {/* El botón principal es el que falta apretar: activar la cámara mientras no esté activa, y continuar cuando está lista */}
            <button
              type="button"
              className={stream ? 'pp-boton' : 'pp-boton pp-boton-secundario'}
              onClick={() => {
                localStorage.setItem(`setup_done_${candidatoId}`, '1')
                detenerCamara()
              }}
            >
              Todo funciona bien, empecemos
            </button>
          </div>
        </div>
      </Marco>
    )
  }

  if (error) return <PantallaError mensaje={error} />

  const testsPendientes = bateria.filter(test => !testsCompletados.includes(test))
  const proximoTest = testsPendientes[0]
  const recienCompletado = searchParams.get('completed') === '1'

  const todosCompletados = bateria.length > 0 && testsPendientes.length === 0

  if (todosCompletados) {
    return (
      <PantallaFin titulo="Evaluación completada">
        Gracias por tu tiempo, <strong>{candidato?.nombre}</strong>. Completaste todas las pruebas para la posición de <strong>{proceso?.cargo}</strong>. Tus respuestas ya las recibió el equipo de selección.
      </PantallaFin>
    )
  }

  if (proceso?.activo === false) {
    return (
      <PantallaAviso titulo="Proceso finalizado" intro="Gracias por tu interés y por el tiempo dedicado. Si surge una nueva búsqueda para la que tu perfil sea afín, nos pondremos en contacto con vos.">
        Hola <strong>{candidato?.nombre}</strong>, el proceso de selección para <strong>{proceso?.cargo}</strong> ya fue cerrado, por lo que este enlace ya no está disponible para continuar la evaluación.
      </PantallaAviso>
    )
  }

  const infoDe = (testKey: string) => {
    const esEntrevista = testKey.startsWith('entrevista:')
    return NOMBRES_TESTS[testKey] || { nombre: esEntrevista ? 'Entrevista en video' : testKey, duracion: esEntrevista ? 'Varía' : '15 min' }
  }

  // Vista de transicion (flujo lineal): se acaba de guardar una prueba y toca la siguiente
  if (recienCompletado && proximoTest) {
    const testInfo = infoDe(proximoTest)
    return (
      <Marco titulo="Siguiente prueba">
        <p className="pp-categoria">Prueba anterior guardada</p>
        <h1 className="pp-titulo">Seguimos con {testInfo.nombre}</h1>
        <p className="pp-lead">Duración estimada: {testInfo.duracion}. Una vez que empieces, completala de corrido: cada prueba tiene su propio tiempo y es el siguiente paso para terminar tu postulación a <strong>{proceso?.cargo}</strong>.</p>
        <button type="button" className="pp-boton" onClick={() => iniciarTest(proximoTest)}>Comenzar la siguiente prueba</button>
        <p className="pp-muted" style={{ marginTop: '1.5rem' }}>Llevás {testsCompletados.length} de {bateria.length} pruebas completadas.</p>
      </Marco>
    )
  }

  const isDebug = searchParams.get('debug') === '1'

  return (
    <Marco titulo="Tus pruebas">
      {isDebug && (
        <pre className="pp-debug">{JSON.stringify({
          candidato: candidato?.nombre,
          bateria_actual: bateria,
          completados: testsCompletados,
          db: typeof window !== 'undefined' ? (window as any).debugInfo : 'Cargando...'
        }, null, 2)}</pre>
      )}
      <h1 className="pp-titulo">Hola, {candidato?.nombre}</h1>
      <p className="pp-lead">Estás participando en el proceso para <strong>{proceso?.cargo}</strong>. Completá las pruebas en orden para terminar tu postulación.</p>

      <div className="pp-resumen">
        <p className="pp-resumen-texto">{testsCompletados.length} de {bateria.length} pruebas completadas</p>
        <div className="pp-avance" role="progressbar" aria-valuemin={0} aria-valuemax={bateria.length} aria-valuenow={testsCompletados.length} aria-label="Avance de tus pruebas">
          <span style={{ width: `${(testsCompletados.length / (bateria.length || 1)) * 100}%` }} />
        </div>
      </div>

      <ol className="pp-bateria">
        {bateria.map((testKey, index) => {
          const testInfo = infoDe(testKey)
          const completado = testsCompletados.includes(testKey)
          const esSiguiente = !completado && (index === 0 || testsCompletados.includes(bateria[index - 1]))
          const estado = completado ? 'completada' : esSiguiente ? 'siguiente' : 'pendiente'
          return (
            <li key={testKey} className="pp-paso" data-estado={estado}>
              <span className="pp-burbuja pp-paso-marca" aria-hidden="true">
                {completado ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                ) : index + 1}
              </span>
              <div>
                <h2 className="pp-paso-nombre">{testInfo.nombre}</h2>
                <p className="pp-paso-meta">Duración estimada: {testInfo.duracion}</p>
              </div>
              <div className="pp-paso-accion">
                {completado ? (
                  <span className="pp-paso-estado">Completada</span>
                ) : esSiguiente ? (
                  <button type="button" className="pp-boton" onClick={() => iniciarTest(testKey)}>Comenzar</button>
                ) : (
                  <span className="pp-paso-estado">Pendiente</span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Marco>
  )

}
