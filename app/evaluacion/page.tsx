'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TEST_IDS, calcularProgresoEvaluacion } from '@/lib/progresoEvaluacion'
import { marcarEvaluacionEnCurso } from '@/lib/iniciarEvaluacion'
import { CheckCircle2, PlayCircle, Clock, CheckCircle, Video, Camera, Mic } from 'lucide-react'

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
}

const NOMBRES_TESTS: Record<string, { nombre: string, duracion: string }> = {
  bigfive: { nombre: 'Test de Personalidad (Big Five)', duracion: '15-20 min' },
  hexaco: { nombre: 'Perfil de Personalidad (HEXACO)', duracion: '20 min' },
  numerico: { nombre: 'Razonamiento NumÃ©rico', duracion: '15 min' },
  verbal: { nombre: 'Razonamiento Verbal', duracion: '15 min' },
  integridad: { nombre: 'Test de Integridad Laboral', duracion: '10 min' },
  icar: { nombre: 'Razonamiento Cognitivo Abstracto (ICAR)', duracion: '15 min' },
  comercial: { nombre: 'Perfil Comercial', duracion: '15 min' },
  'sjt-comercial': { nombre: 'Casos Prcticos: Comercial', duracion: '20 min' },
  'tolerancia-frustracion': { nombre: 'Tolerancia a la Frustracin', duracion: '10 min' },
  'sjt-cobranzas': { nombre: 'Casos Prcticos: Cobranzas', duracion: '20 min' },
  'sjt-atencion': { nombre: 'Casos Prcticos: Atencin al Cliente', duracion: '15 min' },
  'sjt-ventas': { nombre: 'Casos Prcticos: Ventas', duracion: '20 min' },
  'atencion-detalle': { nombre: 'Atencin al Detalle', duracion: '10 min' },
  'sjt-legal': { nombre: 'Casos Prcticos: Legal', duracion: '20 min' },
  'estres-laboral': { nombre: 'Afrontamiento del Estrs', duracion: '15 min' },
  creatividad: { nombre: 'Creatividad e Innovacin', duracion: '15 min' },
  'sjt-problemas': { nombre: 'Resolucin de Problemas', duracion: '20 min' },
}

export default function PortalCandidatoPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const candidatoIdRaw = searchParams.get('candidato')
  const procesoIdRaw = searchParams.get('proceso')
  const candidatoId = candidatoIdRaw ? candidatoIdRaw.trim() : null
  const procesoId = procesoIdRaw ? procesoIdRaw.trim() : null
  const token = searchParams.get('token')
  const tokenQuery = token ? '&token=' + encodeURIComponent(token) : ''

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [candidato, setCandidato] = useState<any>(null)
  const [proceso, setProceso] = useState<any>(null)
  const [bateria, setBateria] = useState<string[]>([])
  const [testsCompletados, setTestsCompletados] = useState<string[]>([])
  const [testPendiente, setTestPendiente] = useState<string | null>(null)
  const [iniciandoTest, setIniciandoTest] = useState(false)

  const [mostrarSetup, setMostrarSetup] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (!candidatoId || !procesoId) {
      setError('Link invlido. Por favor, contacta al equipo de seleccin.')
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
      console.error("Error al activar cmara:", err)
      alert("No pudimos acceder a tu cmara o micrfono. Por favor, asegrate de dar los permisos necesarios en tu navegador.")
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
      const [{ data: cand, error: errCand }, { data: proc, error: errProc }] = await Promise.all([
        supabase.from('candidatos').select('nombre, apellido').eq('id', candidatoId).maybeSingle(),
        supabase.from('procesos').select('nombre, cargo, bateria_tests').eq('id', procesoId).maybeSingle(),
      ])

      if (errCand) console.error("Error al cargar candidato:", errCand)
      if (errProc) console.error("Error al cargar proceso:", errProc)

      if (!cand) throw new Error(`Candidato no encontrado en la base de datos (ID: ${candidatoId})`)
      if (!proc) throw new Error(`Proceso de seleccin no encontrado (ID: ${procesoId})`)

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
      const completadosLocal = JSON.parse(localStorage.getItem(`completados_${candidatoId}_${procesoId}`) || '[]')
      
      // 2. Cargar desde DB (Sesiones de Tests) - Filtered by process to avoid cross-contamination
      const { data: sesiones, error: errSes } = await supabase
        .from('sesiones')
        .select('test_id, estado')
        .eq('candidato_id', candidatoId)
        .eq('proceso_id', procesoId)
      
      if (errSes) console.error('Error DB Sesiones:', errSes)

      // 3. Cargar desde DB (Respuestas de Videoentrevistas)
      const { data: respuestasVideo, error: errVid } = await supabase
        .from('respuestas_video')
        .select('entrevista_id, pregunta_id, estado')
        .eq('candidato_id', candidatoId)
      
      if (errVid) console.error('Error DB Videos:', errVid)

      const { data: preguntasVideo } = await supabase
        .from('preguntas_video')
        .select('id, entrevista_id')
      const preguntasPorEntrevista: Record<string, number> = {}
      ;(preguntasVideo || []).forEach(p => {
        preguntasPorEntrevista[p.entrevista_id] = (preguntasPorEntrevista[p.entrevista_id] || 0) + 1
      })
      const progreso = calcularProgresoEvaluacion(bat, sesiones || [], respuestasVideo || [], preguntasPorEntrevista)
      const debugData: any = { raw_sessions: sesiones, raw_videos: respuestasVideo, progreso }
      const merge = progreso.testsCompletados
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

  function iniciarTest(testKey: string) { setTestPendiente(testKey) }

  async function confirmarInicioTest() {
    if (!testPendiente || !candidatoId || !procesoId) return
    setIniciandoTest(true)
    const testId = testPendiente.startsWith('entrevista:') ? testPendiente.split(':')[1] : Object.entries(TEST_IDS).find(([, key]) => key === testPendiente)?.[0]
    if (!testId) { setError('No se pudo identificar la evaluaci?n seleccionada.'); setIniciandoTest(false); return }
    const { error: inicioError } = await marcarEvaluacionEnCurso({ candidatoId, procesoId, testId })
    if (inicioError) { console.error('Error registrando inicio de evaluaci?n:', inicioError); setError('No se pudo registrar el inicio de la evaluaci?n. Int?ntalo nuevamente.'); setIniciandoTest(false); return }
    localStorage.setItem(`last_started_${candidatoId}_${procesoId}`, testPendiente)
    if (testPendiente.startsWith('entrevista:')) {
      const id = testPendiente.split(':')[1]; setTestPendiente(null); setIniciandoTest(false)
      router.push(`/entrevista-video/responder?entrevista=${id}&candidato=${candidatoId}&proceso=${procesoId}&evaluacion=1${tokenQuery}`); return
    }
    const ruta = RUTAS[testPendiente]
    if (!ruta) { setError('No se encontr? la pantalla de la evaluaci?n seleccionada.'); setIniciandoTest(false); return }
    setTestPendiente(null); setIniciandoTest(false)
    router.push(`${ruta}?candidato=${candidatoId}&proceso=${procesoId}&evaluacion=1`)
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

  if (cargando) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-slate-500 font-medium">Preparando tu portal...</p>
      </div>
    )
  }

  if (mostrarSetup) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-indigo-600 p-8 text-white text-center">
            <h1 className="text-2xl font-bold mb-2">Hola, {candidato?.nombre}!</h1>
            <p className="text-indigo-100 opacity-90">Antes de comenzar, aseguremonos que tu equipo est listo.</p>
          </div>
          
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-indigo-600" /> Prueba de Cmara
                </h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Para las video-entrevistas, es importante que tu rostro est bien iluminado y centrado en la pantalla.
                </p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Mic className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">Micrfono detectado</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Video className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-600">Cmara lista</span>
                  </div>
                </div>
              </div>

              <div className="relative group">
                <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-4 border-slate-100">
                  {stream ? (
                    <video 
                      autoPlay 
                      muted 
                      ref={el => { if (el) el.srcObject = stream }} 
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Video className="w-6 h-6 text-slate-500" />
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium px-4">Haz clic abajo para activar tu vista previa</p>
                    </div>
                  )}
                </div>
                {!stream && (
                  <button 
                    onClick={activarCamara}
                    className="absolute inset-0 w-full h-full bg-indigo-600/10 hover:bg-indigo-600/20 transition-colors rounded-2xl flex items-center justify-center"
                  >
                    <span className="bg-white text-indigo-600 px-4 py-2 rounded-full text-xs font-bold shadow-md">Activar Cmara</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 max-w-sm text-center md:text-left">
                Al continuar, confirmas que tu equipo funciona correctamente y ests en un lugar tranquilo para realizar las pruebas.
              </p>
              <button
                onClick={() => {
                  localStorage.setItem(`setup_done_${candidatoId}`, '1')
                  detenerCamara()
                }}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5"
              >
                Todo funciona bien, empecemos!
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-slate-50 p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-center max-w-md">
          <p className="font-semibold mb-1">Hubo un problema</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const testsPendientes = bateria.filter(test => !testsCompletados.includes(test))
  const proximoTest = testsPendientes[0]
  const recienCompletado = searchParams.get('completed') === '1'

  const todosCompletados = bateria.length > 0 && testsPendientes.length === 0

  if (todosCompletados) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-slate-100">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Evaluacin Completada!</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Gracias por tu tiempo, <span className="font-semibold text-slate-900">{candidato?.nombre}</span>. 
            Has finalizado exitosamente todas las pruebas para la posiciÃ³n de <span className="font-semibold text-slate-900">{proceso?.cargo}</span>.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-6 text-left border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Prximos pasos</p>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Tus resultados han sido enviados al equipo de seleccin para su anlisis. Nos pondremos en contacto contigo a la brevedad.
            </p>
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <p className="text-sm text-slate-700 flex items-center gap-3">
                <span className="text-lg">x</span>
                <a href="mailto:seleccion@republicamicrofinanzas.com.uy" className="hover:text-indigo-600 transition-colors">seleccion@republicamicrofinanzas.com.uy</a>
              </p>
              <p className="text-sm text-slate-700 flex items-center gap-3">
                <span className="text-lg">x</span>
                <a href="https://wa.me/598092651770" className="hover:text-indigo-600 transition-colors">092 651 770</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Vista de Transicin (Flujo Lineal)
  if (recienCompletado && proximoTest) {
    const esEntrevista = proximoTest.startsWith('entrevista:')
    const testInfo = NOMBRES_TESTS[proximoTest] || { nombre: esEntrevista ? 'Entrevista en Video' : proximoTest, duracion: esEntrevista ? 'Vara' : '15 min' }
    
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-green-600 p-6 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold">Buen trabajo!</h2>
              <p className="text-green-100 text-sm mt-1">Has completado el ejercicio anterior</p>
            </div>
            
            <div className="p-8 text-center">
              <div className="mb-6">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-100">
                  Prximo paso
                </span>
                <h3 className="text-2xl font-bold text-slate-900 mt-3 mb-2">{testInfo.nombre}</h3>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 font-medium">
                  <Clock className="w-4 h-4" />
                  Duracin estimada: {testInfo.duracion}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 mb-8 text-left border border-slate-100">
                <p className="text-xs text-slate-500 leading-relaxed italic">
                  "Recuerda que no puedes dejar la evaluaciÃ³n inconclusa. Este es el siguiente paso necesario para completar tu postulaciÃ³n para <strong>{proceso?.cargo}</strong>."
                </p>
              </div>

              <button
                onClick={() => iniciarTest(proximoTest)}
                className="w-full inline-flex justify-center items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5"
              >
                Comenzar siguiente ejercicio
                <PlayCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <p className="text-center text-slate-400 text-xs mt-6">
            Progreso total: {testsCompletados.length} de {bateria.length} completados
          </p>
        </div>
      </div>
    )
  }

  const isDebug = searchParams.get('debug') === '1'

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      {testPendiente && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirmar-inicio-titulo">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
            <h2 id="confirmar-inicio-titulo" className="text-xl font-bold text-slate-900 mb-3">?Deseas comenzar ahora?</h2>
            <p className="text-sm text-slate-600 leading-relaxed">Al confirmar se registrar? el inicio de esta evaluaci?n. Tus avances se guardar?n autom?ticamente y podr?s retomarla si necesitas hacer una pausa.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setTestPendiente(null)} disabled={iniciandoTest} className="px-4 py-2.5 text-sm font-semibold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={confirmarInicioTest} disabled={iniciandoTest} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50">{iniciandoTest ? 'Registrando...' : 'S?, comenzar'}</button>
            </div>
          </div>
        </div>
      )}
      {isDebug && (
        <div className="max-w-2xl mx-auto mb-6 p-4 bg-black text-green-400 font-mono text-[10px] rounded-xl overflow-auto border-4 border-indigo-500 shadow-2xl">
          <p className="font-bold text-xs mb-2 border-b border-green-900 pb-1">DEBUG MODE  DB DATA</p>
          <pre>{JSON.stringify({ 
            candidato: candidato?.nombre,
            bateria_actual: bateria,
            completados: testsCompletados,
            db: typeof window !== 'undefined' ? (window as any).debugInfo : 'Cargando...'
          }, null, 2)}</pre>
        </div>
      )}
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider mb-4 border border-indigo-100">
            Portal del Candidato
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Hola, {candidato?.nombre}
          </h1>
          <p className="text-slate-600 text-lg">
            EstÃ¡s participando en el proceso para <span className="font-semibold text-slate-900">{proceso?.cargo}</span>
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Tus Pruebas Asignadas</h2>
            <p className="text-sm text-slate-500">
              Por favor, completa todas las pruebas a continuaciÃ³n para finalizar tu postulaciÃ³n.
            </p>
            
            <div className="mt-6 flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${(testsCompletados.length / (bateria.length || 1)) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                {testsCompletados.length} / {bateria.length} completadas
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 p-2">
            {bateria.map((testKey, index) => {
              const esEntrevista = testKey.startsWith('entrevista:')
              const testInfo = NOMBRES_TESTS[testKey] || { nombre: esEntrevista ? 'Entrevista en Video' : testKey, duracion: esEntrevista ? 'Vara' : '15 min' }
              const completado = testsCompletados.includes(testKey)
              const esSiguiente = !completado && (index === 0 || testsCompletados.includes(bateria[index-1]))

              return (
                <div key={testKey} className={`p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors rounded-2xl ${esSiguiente ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                      completado ? 'bg-green-500 border-green-500 text-white' : esSiguiente ? 'border-indigo-500 text-indigo-500' : 'border-slate-300 text-slate-300'
                    }`}>
                      {completado ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                    </div>
                    <div>
                      <h3 className={`font-bold text-base mb-1 ${completado ? 'text-slate-900' : 'text-slate-900'}`}>
                        {testInfo.nombre}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        Duracin est.: {testInfo.duracion}
                      </div>
                    </div>
                  </div>

                  <div className="ml-10 md:ml-0 shrink-0">
                    {completado ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-xl border border-green-200">
                        Completado
                      </span>
                    ) : (
                      <button
                        onClick={() => iniciarTest(testKey)}
                        disabled={!esSiguiente}
                        className={`w-full md:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-offset-2 ${
                          esSiguiente 
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500' 
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        }`}
                      >
                        <PlayCircle className="w-4 h-4" />
                        Comenzar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

}


