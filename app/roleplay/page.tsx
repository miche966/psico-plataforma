'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { marcarEvaluacionOperativaEnCurso, marcarEvaluacionOperativaCompletada } from '@/lib/progresoOperativo'
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageSquare, Loader2 } from 'lucide-react'
import { Marco } from '@/components/candidato/Marco'
import { PantallaCarga, PantallaError } from '@/components/candidato/Estados'

export default function RolePlayPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const token = searchParams.get('token')
  const tipoQuery = searchParams.get('tipo')
  const esAtencion = tipoQuery === 'atencion'

  const TEST_ID = esAtencion 
    ? 'd8e9f0a1-b2c3-4567-defa-777777777777' 
    : 'd8e9f0a1-b2c3-4567-defa-888888888888'

  // Estados de carga e inicialización
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [candidato, setCandidato] = useState<any>(null)
  
  // Estados de la llamada
  const [llamadaIniciada, setLlamadaIniciada] = useState(false)
  const [guardandoEvaluacion, setGuardandoEvaluacion] = useState(false)
  const [reproduciendoAudio, setReproduciendoAudio] = useState(false)
  const [mensajes, setMensajes] = useState<Array<{ role: 'user' | 'model', content: string; cooperacion?: number }>>([])
  const mensajesRef = useRef<Array<{ role: 'user' | 'model', content: string; cooperacion?: number }>>([])
  const [turnoActual, setTurnoActual] = useState(0)
  const maxTurnos = 20
  const evaluacionKey = esAtencion ? 'roleplay_atencion' : 'roleplay'

  useEffect(() => {
    if (cargando || !candidatoId || !procesoId || !token) return
    void marcarEvaluacionOperativaEnCurso({
      candidatoId,
      procesoId,
      token,
      evaluacionKey,
      totalPreguntas: maxTurnos,
      preguntaActual: turnoActual,
      respuestasCompletadas: mensajes.filter(m => m.role === 'user').length,
    })
  }, [cargando, candidatoId, procesoId, token, evaluacionKey, turnoActual, mensajes.length])

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
  const acumuladoVozRef = useRef('')

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
      // Detener micrófono al salir. Se limpia el acumulado antes de abortar para que el
      // "onend" que dispara abort() no termine enviando un mensaje parcial tras desmontar.
      acumuladoVozRef.current = ''
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
      const res = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'iniciar', candidatoId, procesoId, token, testId: TEST_ID })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Candidato no encontrado')

      setCandidato(data.candidato)
      if (data.alreadyCompleted) {
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
      // continuous=true: no cortar la escucha ante la primera pausa/silencio (pensar, respirar,
      // organizar la idea). Con continuous=false el navegador terminaba la sesión de
      // reconocimiento en la primera pausa natural y enviaba ese fragmento incompleto como si
      // fuera el mensaje entero, obligando a reiniciar el micrófono a mitad de una frase (visto
      // en producción: transcripciones cortadas en pedazos como "y bueno en realidad").
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'es-UY'

      rec.onstart = () => {
        setEscuchando(true)
        acumuladoVozRef.current = ''
        setTranscripcionParcial('')
      }

      rec.onresult = (event: any) => {
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const finalResult = event.results[i][0].transcript
            acumuladoVozRef.current = `${acumuladoVozRef.current} ${finalResult}`.trim()
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }
        setTranscripcionParcial(`${acumuladoVozRef.current} ${interimTranscript}`.trim())
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
        // Se envía recién acá (al terminar realmente la escucha, sea porque el candidato
        // presionó "detener" o porque el navegador cortó tras un silencio prolongado), con todo
        // lo acumulado durante la sesión de escucha, no fragmento por fragmento.
        const textoFinal = acumuladoVozRef.current
        acumuladoVozRef.current = ''
        if (textoFinal.trim()) enviarMensajeVoz(textoFinal)
      }

      recognitionRef.current = rec
    } catch (e) {
      console.error("Error al inicializar SpeechRecognition:", e)
      setSoportaMic(false)
      setFallbackTexto(true)
    }
  }

  // Activa o detiene el reconocimiento por voz. Ahora que continuous=true mantiene la
  // escucha abierta entre pausas, el candidato controla cuándo terminó de hablar
  // presionando el mismo botón de nuevo (en vez de que el navegador lo corte solo).
  function hablar() {
    if (guardandoEvaluacion) return

    if (escuchando) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.error(err)
      }
      return
    }

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

    utterance.onstart = () => {
      setReproduciendoAudio(true)
    }

    utterance.onend = () => {
      setReproduciendoAudio(false)
      botFinTimeRef.current = Date.now()
    }

    utterance.onerror = () => {
      setReproduciendoAudio(false)
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
          candidatoId,
          procesoId,
          token,
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
        await fetch('/api/roleplay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'descartar', candidatoId, procesoId, token, testId: TEST_ID })
        })
      } catch (err) {
        console.error('Error al limpiar sesión breve:', err)
      }
      router.push(`/evaluacion?candidato=${candidatoId}&proceso=${procesoId}${token ? `&token=${encodeURIComponent(token)}` : ''}`)
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
          token,
          latenciaPromedio: promedioLatencia,
          turnosTotales: totalTurnos
        })
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (candidatoId && procesoId && token) {
        await marcarEvaluacionOperativaCompletada({
          candidatoId,
          procesoId,
          token,
          evaluacionKey,
          totalPreguntas: maxTurnos,
          respuestasCompletadas: totalTurnos,
        })
      }

      // Redirigir al portal del candidato indicando que completó el test
      router.push(`/evaluacion?candidato=${candidatoId}&proceso=${procesoId}&completed=1${token ? `&token=${encodeURIComponent(token)}` : ''}`)

    } catch (err: any) {
      console.error(err)
      alert("Error al guardar la evaluación: " + err.message)
      setGuardandoEvaluacion(false)
    }
  }

  if (cargando) return <PantallaCarga texto="Preparando la simulación…" />

  if (error) {
    return (
      <PantallaError
        titulo="Simulación bloqueada"
        mensaje={error}
        etiqueta="Volver al portal"
        onReintentar={() => router.push(`/evaluacion?candidato=${candidatoId}&proceso=${procesoId}${token ? `&token=${encodeURIComponent(token)}` : ''}`)}
      />
    )
  }

  const cliente = esAtencion
    ? { nombre: 'Laura Benítez', iniciales: 'LB' }
    : { nombre: 'Carlos Gómez', iniciales: 'CG' }

  // Antes de empezar: la ficha del cliente y los objetivos se leen con calma, en tamaño normal
  if (!llamadaIniciada) {
    return (
      <Marco titulo="Simulación de llamada">
        <h1 className="pp-titulo">{esAtencion ? 'Simulación de recepción de reclamo' : 'Simulación de llamada de cobranza'}</h1>
        <p className="pp-lead">
          {esAtencion
            ? <>Vas a simular la atención de un reclamo telefónico como <strong>Analista de Soporte y Atención al Cliente</strong> de <strong>República Microfinanzas</strong>.</>
            : <>Vas a simular una llamada como <strong>Analista de Cobranzas telefónicas</strong> de <strong>República Microfinanzas</strong>.</>
          }
        </p>

        {esAtencion ? (
          <>
            <section className="pp-aparte" aria-labelledby="pp-ficha">
              <h2 id="pp-ficha">Ficha de la clienta</h2>
              <ul className="pp-instrucciones">
                <li><strong>Nombre:</strong> Laura Benítez.</li>
                <li><strong>Negocio:</strong> Dueña de una pañalera y artículos de limpieza de barrio.</li>
                <li><strong>Problema:</strong> Reclama un cobro duplicado en su cuenta de Microfinanzas por un valor de $8,500.</li>
                <li><strong>Estado de ánimo:</strong> Muy molesta por la falta de respuesta en los canales digitales y la urgencia de su dinero.</li>
              </ul>
            </section>
            <section className="pp-aparte" aria-labelledby="pp-objetivos">
              <h2 id="pp-objetivos">Objetivos de la llamada</h2>
              <ul className="pp-instrucciones">
                <li><strong>Contener y empatizar:</strong> Saludar profesionalmente, validar la molestia de la clienta por el error y disculparte sinceramente.</li>
                <li><strong>Indagar detalles:</strong> Solicitar su número de DNI o Cuenta para validar la transacción en el sistema de manera calmada.</li>
                <li><strong>Ofrecer solución clara:</strong> Explicar el proceso administrativo de reintegro (se acreditará en un plazo de 24 a 48 horas hábiles).</li>
                <li><strong>Tono y estilo:</strong> Mantener un tono y estilo de comunicación lo más profesional posible en todo momento, evitando confrontaciones, expresiones informales o impaciencia.</li>
              </ul>
            </section>
          </>
        ) : (
          <>
            <section className="pp-aparte" aria-labelledby="pp-ficha">
              <h2 id="pp-ficha">Ficha del cliente a contactar</h2>
              <ul className="pp-instrucciones">
                <li><strong>Nombre:</strong> Carlos Gómez.</li>
                <li><strong>Producto:</strong> Préstamo personal para Capital de Trabajo de su almacén.</li>
                <li><strong>Situación de mora:</strong> 45 días de atraso en la cuota mensual.</li>
                <li><strong>Monto adeudado:</strong> $35,000 (pesos uruguayos).</li>
                <li><strong>Historial:</strong> Era un cliente con excelente conducta de pago, pero ha tenido dificultades recientes para regularizar sus cuotas.</li>
              </ul>
            </section>
            <section className="pp-aparte" aria-labelledby="pp-objetivos">
              <h2 id="pp-objetivos">Objetivo de la llamada</h2>
              <ul className="pp-instrucciones">
                <li><strong>Identificarte profesionalmente:</strong> Saludar al cliente, identificarte con tu nombre e indicar que llamas en representación de República Microfinanzas.</li>
                <li><strong>Indagar el motivo:</strong> Indagar el motivo del atraso en sus pagos.</li>
                <li><strong>Negociar un compromiso:</strong> Encontrar una solución de pago viable (promesa de pago para una fecha específica o posibilidad de refinanciación) adaptada a su situación.</li>
                <li><strong>Tono y estilo:</strong> Mantener un tono y estilo de comunicación lo más profesional posible en todo momento, evitando confrontaciones, expresiones informales o impaciencia.</li>
              </ul>
            </section>
          </>
        )}

        <fieldset className="pp-preferencias">
          <legend>Cómo querés hacer la llamada</legend>
          <label className="pp-interruptor">
            <input type="checkbox" checked={!audioMutado} onChange={() => setAudioMutado(!audioMutado)} />
            <span>Escuchar la voz del cliente</span>
          </label>
          <label className="pp-interruptor">
            <input type="checkbox" checked={fallbackTexto} onChange={() => setFallbackTexto(!fallbackTexto)} />
            <span>Responder por escrito en vez de hablar</span>
          </label>
        </fieldset>

        <button type="button" className="pp-boton" onClick={iniciarLlamada}>Iniciar llamada</button>
      </Marco>
    )
  }

  return (
    <Marco titulo="Llamada en curso">
      <div className="pp-llamada">
        <div className="pp-llamada-cab">
          <div className="pp-contacto">
            <span className="pp-avatar" data-habla={reproduciendoAudio} aria-hidden="true">{cliente.iniciales}</span>
            <div>
              <h1 className="pp-contacto-nombre">{cliente.nombre}</h1>
              <p className="pp-contacto-estado">{reproduciendoAudio ? 'Hablando…' : 'Llamada en línea'}</p>
            </div>
          </div>
          <div className="pp-llamada-herr">
            <button
              type="button"
              className="pp-icono"
              onClick={() => setAudioMutado(!audioMutado)}
              aria-pressed={audioMutado}
              aria-label={audioMutado ? 'Activar sonido' : 'Silenciar sonido'}
              title={audioMutado ? 'Activar sonido' : 'Silenciar sonido'}
            >
              {audioMutado ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              type="button"
              className="pp-icono"
              onClick={() => setFallbackTexto(!fallbackTexto)}
              aria-pressed={fallbackTexto}
              aria-label="Responder por escrito"
              title="Modo de texto alternativo"
            >
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        <div className="pp-chat" role="log" aria-live="polite">
          {mensajes.map((m, idx) => (
            <div key={idx} className={m.role === 'user' ? 'pp-msg pp-msg-yo' : 'pp-msg'}>
              <span className="pp-msg-autor">{m.role === 'user' ? 'Vos (analista)' : 'Cliente'}</span>
              <div className="pp-msg-texto">{m.content}</div>
            </div>
          ))}

          {/* Transcripcion parcial en tiempo real */}
          {transcripcionParcial && (
            <div className="pp-msg pp-msg-yo pp-msg-parcial">
              <span className="pp-msg-autor">Escribiendo…</span>
              <div className="pp-msg-texto">{transcripcionParcial}</div>
            </div>
          )}
        </div>

        <div className="pp-controles">
          <div className="pp-turnos">
            <span>Turno {turnoActual} de {maxTurnos}</span>
            {escuchando && <span className="pp-escuchando">Transcribiendo…</span>}
          </div>

          {fallbackTexto ? (
            <div className="pp-escribir">
              <input
                type="text"
                aria-label="Tu mensaje"
                placeholder="Escribí tu mensaje"
                value={mensajeEscrito}
                onChange={(e) => setMensajeEscrito(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarMensajeEscrito()}
                disabled={guardandoEvaluacion}
              />
              <button type="button" className="pp-boton" onClick={enviarMensajeEscrito} disabled={guardandoEvaluacion || !mensajeEscrito.trim()}>Enviar</button>
            </div>
          ) : (
            <div className="pp-voz">
              <button
                type="button"
                className="pp-mic"
                data-activo={escuchando}
                onClick={hablar}
                disabled={guardandoEvaluacion}
                aria-label={escuchando ? 'Detener y enviar' : 'Hablar'}
                title={escuchando ? 'Tocá para detener y enviar' : 'Tocá para hablar'}
              >
                {escuchando ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
              <p className="pp-voz-ayuda">
                {escuchando ? 'Hablá ahora. Cuando termines tu idea, tocá el micrófono de nuevo para enviarla.' : 'Tocá el micrófono para hablar.'}
              </p>
              <button type="button" className="pp-enlace" onClick={() => setFallbackTexto(true)}>¿Problemas con el micrófono? Escribir por chat de texto</button>
            </div>
          )}

          <button type="button" className="pp-colgar" onClick={() => finalizarLlamada()} disabled={guardandoEvaluacion}>
            {guardandoEvaluacion ? (
              <><Loader2 className="pp-girar" size={16} /> Guardando evaluación…</>
            ) : (
              <><PhoneOff size={16} /> Colgar y finalizar simulación</>
            )}
          </button>
        </div>
      </div>
    </Marco>
  )
}
