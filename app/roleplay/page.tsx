'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, 
  MessageSquare, Loader2, ShieldAlert, ArrowLeft, PlayCircle
} from 'lucide-react'

export default function RolePlayPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const tipoQuery = searchParams.get('tipo')
  const esAtencion = tipoQuery === 'atencion'

  const TEST_ID = esAtencion 
    ? 'd8e9f0a1-b2c3-4567-defa-777777777777' 
    : 'd8e9f0a1-b2c3-4567-defa-888888888888'

  // Estados de carga e inicialización
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [candidato, setCandidato] = useState<any>(null)
  
  // Estados de la llamada
  const [llamadaIniciada, setLlamadaIniciada] = useState(false)
  const [guardandoEvaluacion, setGuardandoEvaluacion] = useState(false)
  const [mensajes, setMensajes] = useState<Array<{ role: 'user' | 'model', content: string; cooperacion?: number }>>([])
  const mensajesRef = useRef<Array<{ role: 'user' | 'model', content: string; cooperacion?: number }>>([])
  const [turnoActual, setTurnoActual] = useState(0)
  const maxTurnos = 8

  // Métricas avanzadas de People Analytics
  const [latencias, setLatencias] = useState<number[]>([])
  const [curvaCooperacion, setCurvaCooperacion] = useState<number[]>([20])
  const botFinTimeRef = useRef<number | null>(null)

  // Reconocimiento de voz (Speech-to-Text)
  const [soportaMic, setSoportaMic] = useState(true)
  const [escuchando, setEscuchando] = useState(false)
  const [transcripcionParcial, setTranscripcionParcial] = useState('')
  const [fallbackTexto, setFallbackTexto] = useState(false)
  const [mensajeEscrito, setMensajeEscrito] = useState('')

  // Síntesis de voz (Text-to-Speech)
  const [audioMutado, setAudioMutado] = useState(false)
  
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Resetear estados por si Next.js reutiliza la instancia del componente
    setLlamadaIniciada(false)
    setGuardandoEvaluacion(false)
    setMensajes([])
    mensajesRef.current = []
    setTurnoActual(0)
    setLatencias([])
    setCurvaCooperacion([20])
    setTranscripcionParcial('')
    setFallbackTexto(false)
    setMensajeEscrito('')
    setError(null)
    setCargando(true)

    if (!candidatoId || !procesoId) {
      setError('Enlace de evaluación no válido. Por favor verifica tus credenciales.')
      setCargando(false)
      return
    }

    inicializarTest()
    inicializarReconocimiento()

    return () => {
      // Detener micrófono al salir
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [candidatoId, procesoId, TEST_ID])

  async function inicializarTest() {
    try {
      const { data: cand, error: errCand } = await supabase
        .from('candidatos')
        .select('nombre, apellido')
        .eq('id', candidatoId)
        .single()

      if (errCand || !cand) {
        throw new Error('Candidato no encontrado')
      }
      setCandidato(cand)

      // Registrar sesión en progreso si no existe
      const { data: sesionExistente } = await supabase
        .from('sesiones')
        .select('id, estado')
        .eq('candidato_id', candidatoId)
        .eq('proceso_id', procesoId)
        .eq('test_id', TEST_ID)
        .maybeSingle()

      if (!sesionExistente) {
        await supabase.from('sesiones').insert({
          candidato_id: candidatoId,
          proceso_id: procesoId,
          test_id: TEST_ID,
          estado: 'en_progreso'
        })
      } else if (sesionExistente.estado === 'finalizado') {
        setError('Ya has completado esta simulación anteriormente.')
      }

    } catch (err: any) {
      console.error(err)
      setError('Error al cargar la evaluación: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  function inicializarReconocimiento() {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        setSoportaMic(false)
        setFallbackTexto(true)
        return
      }

      const rec = new SpeechRecognition()
      rec.continuous = false
      rec.interimResults = true
      rec.lang = 'es-UY'

      rec.onstart = () => {
        setEscuchando(true)
        setTranscripcionParcial('')
      }

      rec.onresult = (event: any) => {
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const finalResult = event.results[i][0].transcript
            setTranscripcionParcial(finalResult)
            enviarMensajeVoz(finalResult)
          } else {
            interimTranscript += event.results[i][0].transcript
            setTranscripcionParcial(interimTranscript)
          }
        }
      }

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setEscuchando(false)
        if (event.error === 'not-allowed') {
          alert("Permiso de micrófono denegado. Cambiaremos al modo chat de texto de respaldo.")
          setFallbackTexto(true)
        }
      }

      rec.onend = () => {
        setEscuchando(false)
      }

      recognitionRef.current = rec
    } catch (e) {
      console.error("Error al inicializar SpeechRecognition:", e)
      setSoportaMic(false)
      setFallbackTexto(true)
    }
  }

  // Activa el reconocimiento por voz
  function hablar() {
    if (escuchando || guardandoEvaluacion) return
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel() // Interrumpir respuesta previa si el usuario habla
    }

    try {
      recognitionRef.current.start()
    } catch (err) {
      console.error(err)
    }
  }

  // Reproducir voz (Text-to-Speech)
  function reproducirVoz(texto: string) {
    if (audioMutado || !window.speechSynthesis) {
      botFinTimeRef.current = Date.now()
      return
    }

    window.speechSynthesis.cancel() // Cancelar cualquier lectura previa
    const utterance = new SpeechSynthesisUtterance(texto)
    utterance.lang = 'es-AR' // Tono rioplatense cercano

    // Buscar una voz en español adecuada si está disponible
    const voices = window.speechSynthesis.getVoices()
    const spanishVoice = voices.find(v => v.lang.startsWith('es-AR') || v.lang.startsWith('es-ES') || v.lang.startsWith('es-MX'))
    if (spanishVoice) {
      utterance.voice = spanishVoice
    }

    utterance.rate = 1.05 // Velocidad de habla natural
    utterance.pitch = 0.95 // Tono de voz de cliente cansado / serio

    utterance.onend = () => {
      botFinTimeRef.current = Date.now()
    }
    botFinTimeRef.current = Date.now() // Salvaguarda

    window.speechSynthesis.speak(utterance)
  }

  // Enviar mensaje de voz (Speech Recognition Final Result)
  async function enviarMensajeVoz(texto: string) {
    if (!texto.trim() || guardandoEvaluacion) return
    
    if (botFinTimeRef.current) {
      const lat = (Date.now() - botFinTimeRef.current) / 1000
      setLatencias(prev => [...prev, Math.max(0.1, lat)])
    }

    const nuevosMensajes = [...mensajesRef.current, { role: 'user' as const, content: texto.trim() }]
    mensajesRef.current = nuevosMensajes
    setMensajes(nuevosMensajes)
    setTranscripcionParcial('')
    
    procesarRespuestaIA(nuevosMensajes)
  }

  // Enviar mensaje escrito (Fallback Modo Chat)
  async function enviarMensajeEscrito() {
    if (!mensajeEscrito.trim() || guardandoEvaluacion) return
    
    if (botFinTimeRef.current) {
      const lat = (Date.now() - botFinTimeRef.current) / 1000
      setLatencias(prev => [...prev, Math.max(0.1, lat)])
    }

    const texto = mensajeEscrito.trim()
    const nuevosMensajes = [...mensajesRef.current, { role: 'user' as const, content: texto }]
    mensajesRef.current = nuevosMensajes
    setMensajes(nuevosMensajes)
    setMensajeEscrito('')

    procesarRespuestaIA(nuevosMensajes)
  }

  // Conectar con el backend para obtener respuesta de Gemini
  async function procesarRespuestaIA(listaMensajes: Array<{ role: 'user' | 'model', content: string; cooperacion?: number }>) {
    setTurnoActual(prev => prev + 1)
    
    try {
      const res = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          testId: TEST_ID,
          mensajes: listaMensajes.slice(0, -1).map(m => ({ role: m.role, content: m.content })), // Evitar circularidad o campos extra
          nuevoMensaje: listaMensajes[listaMensajes.length - 1].content // El nuevo mensaje
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const respuestaIA = data.respuesta || data.reply
      const cooperacionIA = typeof data.cooperacion === 'number' ? data.cooperacion : 50
      
      setCurvaCooperacion(prev => [...prev, cooperacionIA])

      const historialConRespuesta = [
        ...listaMensajes, 
        { role: 'model' as const, content: respuestaIA, cooperacion: cooperacionIA }
      ]
      mensajesRef.current = historialConRespuesta
      setMensajes(historialConRespuesta)

      // Leer la respuesta de la IA en voz alta
      reproducirVoz(respuestaIA)

      // Si alcanzamos el límite de turnos, finalizar automáticamente
      if (turnoActual + 1 >= maxTurnos) {
        setTimeout(() => finalizarLlamada(historialConRespuesta), 5000)
      }

    } catch (err) {
      console.error(err)
      alert("Error al conectar con la simulación. Intentaremos reconectar.")
    }
  }

  // Saludo inicial al conectar
  function iniciarLlamada() {
    setLlamadaIniciada(true)
    setTurnoActual(0)
    
    const saludoInicial = esAtencion
      ? "Hola, buenas tardes. ¿Me atienden de una vez? Llevo media hora esperando respuesta por WhatsApp y es una tomadura de pelo."
      : "Hola, buenas. ¿Con quién hablo? Estoy un poco ocupado ahora en el almacén."
    const inicial = [{ role: 'model' as const, content: saludoInicial }]
    mensajesRef.current = inicial
    setMensajes(inicial)
    
    // Pequeño retraso para dar tiempo a cargar voces del navegador
    setTimeout(() => reproducirVoz(saludoInicial), 500)
  }

  // Colgar y calificar llamada
  async function finalizarLlamada(mensajesFinales = mensajesRef.current) {
    if (guardandoEvaluacion) return
    setGuardandoEvaluacion(true)

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    const promedioLatencia = latencias.length > 0 
      ? Number((latencias.reduce((a, b) => a + b, 0) / latencias.length).toFixed(2)) 
      : 2.5

    const totalTurnos = Math.max(0, mensajesFinales.filter(m => m.role === 'user').length)
    const MIN_TURNOS_REQUERIDOS = 4

    // Si la llamada fue muy breve, no evaluar y permitir reintento
    if (totalTurnos < MIN_TURNOS_REQUERIDOS) {
      alert(`La llamada fue demasiado breve (llevabas ${totalTurnos} de ${MIN_TURNOS_REQUERIDOS} turnos mínimos requeridos). Para completar esta prueba debes dialogar e interactuar con el cliente.\n\nSerás redirigido al portal para volver a iniciar el test.`);
      try {
        await supabase
          .from('sesiones')
          .delete()
          .eq('candidato_id', candidatoId)
          .eq('proceso_id', procesoId)
          .eq('test_id', TEST_ID)
      } catch (err) {
        console.error('Error al limpiar sesión breve:', err)
      }
      router.push(`/evaluacion?candidato=${candidatoId}&proceso=${procesoId}`)
      return
    }

    try {
      const res = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluar',
          mensajes: mensajesFinales.map(m => ({ role: m.role, content: m.content, cooperacion: m.cooperacion })),
          candidatoId,
          procesoId,
          testId: TEST_ID,
          latenciaPromedio: promedioLatencia,
          turnosTotales: totalTurnos
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Redirigir al portal del candidato indicando que completó el test
      router.push(`/evaluacion?candidato=${candidatoId}&proceso=${procesoId}&completed=1`)

    } catch (err: any) {
      console.error(err)
      alert("Error al guardar la evaluación: " + err.message)
      setGuardandoEvaluacion(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex justify-center items-center p-6 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-lg">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Simulación Bloqueada</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <button 
            onClick={() => router.push(`/evaluacion?candidato=${candidatoId}&proceso=${procesoId}`)}
            className="flex items-center justify-center gap-2 mx-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al portal
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col h-[650px] max-h-[calc(100vh-2rem)] relative">
        
        {/* CABECERA SIMULADOR DE LLAMADA */}
        <div className="p-6 bg-slate-900/80 border-b border-slate-800/50 backdrop-blur-md flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white shadow-inner">
              {esAtencion ? 'LB' : 'CG'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{esAtencion ? 'Laura Benítez' : 'Carlos Gómez'}</h2>
              <p className="text-[10px] text-emerald-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {esAtencion ? 'Clienta de Pañalera (Reclamo por Cobro Duplicado)' : 'Deudor de Microcrédito (Atraso 45 días)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAudioMutado(!audioMutado)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all text-slate-400"
              title={audioMutado ? "Activar sonido" : "Mutar sonido"}
            >
              {audioMutado ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setFallbackTexto(!fallbackTexto)}
              className={`p-2 rounded-xl transition-all ${
                fallbackTexto ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              title="Modo de texto alternativo"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DE LA LLAMADA */}
        <div className={`flex-1 p-6 flex flex-col justify-between relative z-20 ${!llamadaIniciada ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          
          {!llamadaIniciada ? (
            /* PANTALLA ANTES DE EMPEZAR */
            <div className="flex-1 flex flex-col justify-start items-center text-center p-2 w-full">
              <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 animate-pulse">
                <Phone className="w-8 h-8" />
              </div>
              <h1 className="text-lg font-bold text-white mb-2">
                {esAtencion ? 'Simulación de Recepción de Reclamo' : 'Simulación de Llamada de Cobranza'}
              </h1>
              <p className="text-xs text-slate-400 max-w-xs mb-8">
                {esAtencion 
                  ? <span>Vas a simular la atención de un reclamo telefónico como <strong>Analista de Soporte y Atención al Cliente</strong> de <strong>República Microfinanzas</strong>.</span>
                  : <span>Vas a simular una llamada como <strong>Analista de Cobranzas telefónicas</strong> de <strong>República Microfinanzas</strong>.</span>
                }
              </p>
              
              <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-5 mb-8 text-left max-w-sm w-full space-y-4">
                {esAtencion ? (
                  <>
                    <div>
                      <h3 className="text-xs font-bold text-slate-300 mb-1.5">Ficha de la Clienta:</h3>
                      <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                        <li><strong>Nombre:</strong> Laura Benítez.</li>
                        <li><strong>Negocio:</strong> Dueña de una pañalera y artículos de limpieza de barrio.</li>
                        <li><strong>Problema:</strong> Reclama un cobro duplicado en su cuenta de Microfinanzas por un valor de $8,500.</li>
                        <li><strong>Estado de ánimo:</strong> Muy molesta por la falta de respuesta en los canales digitales y la urgencia de su dinero.</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-xs font-bold text-slate-300 mb-1.5">Objetivos de la llamada:</h3>
                      <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                        <li><strong>Contener y Empatizar:</strong> Saludar profesionalmente, validar la molestia de la clienta por el error y disculparte sinceramente.</li>
                        <li><strong>Indagar detalles:</strong> Solicitar su número de DNI o Cuenta para validar la transacción en el sistema de manera calmada.</li>
                        <li><strong>Ofrecer solución clara:</strong> Explicar el proceso administrativo de reintegro (se acreditará en un plazo de 24 a 48 horas hábiles).</li>
                        <li><strong>Mantener la calidad:</strong> Cuidar el tono de voz, la asertividad y el profesionalismo durante todo el diálogo.</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xs font-bold text-slate-300 mb-1.5">Ficha del Cliente a Contactar:</h3>
                      <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                        <li><strong>Nombre:</strong> Carlos Gómez.</li>
                        <li><strong>Producto:</strong> Préstamo personal para Capital de Trabajo de su almacén.</li>
                        <li><strong>Situación de Mora:</strong> 45 días de atraso en la cuota mensual.</li>
                        <li><strong>Monto adeudado:</strong> $12,500 (pesos Uruguayos).</li>
                        <li><strong>Historial:</strong> Era un cliente con excelente conducta de pago, pero ha tenido dificultades recientes para regularizar sus cuotas.</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-xs font-bold text-slate-300 mb-1.5">Objetivo de la llamada:</h3>
                      <ul className="text-[10px] text-slate-400 space-y-1 list-disc pl-4">
                        <li><strong>Identificarte profesionalmente:</strong> Saludar al cliente, identificarte con tu nombre e indicar que llamas en representación de República Microfinanzas.</li>
                        <li><strong>Indagar el motivo:</strong> Indagar el motivo del atraso en sus pagos.</li>
                        <li><strong>Negociar un compromiso:</strong> Encontrar una solución de pago viable (promesa de pago para una fecha específica o posibilidad de refinanciación) adaptada a su situación.</li>
                        <li><strong>Mantener la calidad:</strong> Cumplir con el tono de voz respetuoso y el protocolo de cobranzas en todo momento.</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={iniciarLlamada}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-bold shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                Iniciar Llamada
              </button>
            </div>
          ) : (
            /* LLAMADA ACTIVA */
            <div className="flex-1 flex flex-col justify-between h-full">
              
              {/* HISTORIAL VISUAL O INTERFAZ DE LLAMADA */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-1 scrollbar-thin">
                {mensajes.map((m, idx) => (
                  <div 
                    key={idx} 
                    className={`flex flex-col max-w-[85%] ${m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    <span className="text-[9px] text-slate-500 mb-1">
                      {m.role === 'user' ? 'Tú (Analista)' : 'Cliente'}
                    </span>
                    <div className={`px-4 py-2.5 rounded-2xl text-xs ${
                      m.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-slate-800 text-slate-200 rounded-tl-none'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                
                {/* Transcripción parcial en tiempo real */}
                {transcripcionParcial && (
                  <div className="flex flex-col max-w-[85%] ml-auto items-end animate-pulse">
                    <span className="text-[9px] text-slate-500 mb-1">Escribiendo...</span>
                    <div className="px-4 py-2.5 bg-indigo-900/50 border border-indigo-800/30 text-indigo-200 rounded-2xl rounded-tr-none text-xs italic">
                      {transcripcionParcial}
                    </div>
                  </div>
                )}
              </div>

              {/* CONTROLES DE LA LLAMADA */}
              <div className="space-y-4 pt-4 border-t border-slate-850">
                {/* Contador de turnos */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 px-1">
                  <span>Turno {turnoActual} de {maxTurnos}</span>
                  {escuchando && <span className="text-indigo-400 flex items-center gap-1">● Transcribiendo...</span>}
                </div>

                {fallbackTexto ? (
                  /* CONTROLES DE MODO TEXTO FALLBACK */
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Escribe tu mensaje..."
                      value={mensajeEscrito}
                      onChange={(e) => setMensajeEscrito(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && enviarMensajeEscrito()}
                      disabled={guardandoEvaluacion}
                      className="flex-1 px-4 py-3 bg-slate-955 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      onClick={enviarMensajeEscrito}
                      disabled={guardandoEvaluacion || !mensajeEscrito.trim()}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Enviar
                    </button>
                  </div>
                ) : (
                  /* CONTROLES DE MODO VOZ HABLADA */
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={hablar}
                      disabled={escuchando || guardandoEvaluacion}
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        escuchando 
                          ? 'bg-red-500/20 border border-red-500/30 text-red-500 scale-105 animate-pulse' 
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 hover:shadow-indigo-500/20'
                      }`}
                    >
                      {escuchando ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <p className="text-[10px] text-slate-400 font-medium animate-pulse text-center">
                      {escuchando ? "Hable ahora. La simulación transcribirá su voz..." : "Presiona el micrófono para hablar"}
                    </p>
                    <button
                      onClick={() => setFallbackTexto(true)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors font-semibold mt-2 underline decoration-indigo-400/40 underline-offset-4"
                    >
                      ¿Problemas con el micrófono? Escribir por chat de texto
                    </button>
                  </div>
                )}

                {/* BOTÓN COLGAR/FINALIZAR MANUAL */}
                <button
                  onClick={() => finalizarLlamada()}
                  disabled={guardandoEvaluacion}
                  className="w-full py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  {guardandoEvaluacion ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Guardando evaluación...
                    </>
                  ) : (
                    <>
                      <PhoneOff className="w-4 h-4" /> Colgar y Finalizar Simulación
                    </>
                  )}
                </button>

              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
