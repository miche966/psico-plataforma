'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { marcarEvaluacionOperativaEnCurso, marcarEvaluacionOperativaCompletada } from '@/lib/progresoOperativo'
import { Marco } from '@/components/candidato/Marco'
import { MarcoPrueba } from '@/components/candidato/Prueba'
import { PantallaCarga, PantallaError, PantallaFin, PantallaSiguiente } from '@/components/candidato/Estados'

interface Pregunta {
  id: string
  orden: number
  pregunta: string
  tiempo_preparacion: number
  tiempo_respuesta: number
}

interface Entrevista {
  id: string
  nombre: string
}

type Estado = 'bienvenida' | 'preparacion' | 'grabando' | 'confirmacion' | 'finalizado'

export default function ResponderPage() {
  const [entrevista, setEntrevista] = useState<Entrevista | null>(null)
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [todasLasPreguntas, setTodasLasPreguntas] = useState<Pregunta[]>([])
  const [preguntasYaRespondidas, setPreguntasYaRespondidas] = useState<Set<string>>(new Set())
  const [tieneExperiencia, setTieneExperiencia] = useState<boolean | null>(null)
  const [preguntaActual, setPreguntaActual] = useState(0)
  const [estado, setEstado] = useState<Estado>('bienvenida')
  const enEvaluacion = useEvaluacionRedirect(estado === 'finalizado')
  const [cargando, setCargando] = useState(true)
  const [tiempoRestante, setTiempoRestante] = useState(0)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [errorUpload, setErrorUpload] = useState(false)
  const [chunks, setChunks] = useState<Blob[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const searchParams = useSearchParams()
  const entrevistaId = searchParams.get('entrevista')
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const token = searchParams.get('token')
  const evaluacionKey = entrevistaId ? `entrevista:${entrevistaId}` : ''

  useEffect(() => {
    if (!candidatoId || !procesoId || !token || !evaluacionKey || !preguntas.length) return
    if (estado === 'finalizado') return
    void marcarEvaluacionOperativaEnCurso({
      candidatoId,
      procesoId,
      token,
      evaluacionKey,
      totalPreguntas: preguntas.length,
      preguntaActual,
      respuestasCompletadas: preguntaActual,
    })
  }, [candidatoId, procesoId, token, evaluacionKey, preguntas.length, preguntaActual, estado])

  useEffect(() => {
    if (!candidatoId || !procesoId || !token || !evaluacionKey || estado !== 'finalizado') return
    void marcarEvaluacionOperativaCompletada({
      candidatoId,
      procesoId,
      token,
      evaluacionKey,
      totalPreguntas: preguntas.length,
      respuestasCompletadas: preguntas.length,
    })
  }, [candidatoId, procesoId, token, evaluacionKey, estado, preguntas.length])

  useEffect(() => {
    if (entrevistaId) cargarDatos()
  }, [entrevistaId, candidatoId, procesoId, token])

  useEffect(() => {
    if (estado === 'bienvenida' || estado === 'confirmacion' || estado === 'finalizado') return
    if (tiempoRestante <= 0) return

    const timer = setInterval(() => {
      setTiempoRestante(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          if (estado === 'preparacion') iniciarGrabacion()
          if (estado === 'grabando') detenerGrabacion()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [estado, tiempoRestante])

  useEffect(() => {
    if ((estado === 'preparacion' || estado === 'grabando') && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch(() => {})
      }
    }
  }, [estado])

  async function cargarDatos() {
    const params = new URLSearchParams({ entrevista: entrevistaId || '' })
    if (candidatoId) params.set('candidato', candidatoId)
    if (procesoId) params.set('proceso', procesoId)
    if (token) params.set('token', token)
    const response = await fetch(`/api/entrevista-video/candidato?${params.toString()}`, { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) { console.error(data.error); setCargando(false); return }

    setEntrevista(data.entrevista || null)
    if (data.candidato) setNombreCandidato(`${data.candidato.nombre} ${data.candidato.apellido}`)

    const preguntasData = data.preguntas || []
    const yaRespondidas = new Set<string>(data.preguntasYaRespondidas || [])
    setPreguntasYaRespondidas(yaRespondidas)
    setTodasLasPreguntas(preguntasData)

    const tieneCondicionales = preguntasData.some((p: Pregunta) =>
      (p.pregunta || '').startsWith('[CON_EXP]') || (p.pregunta || '').startsWith('[SIN_EXP]')
    )
    if (tieneCondicionales) {
      // La rama (con/sin experiencia) todavía no se eligió: se define recién al seleccionarla.
      setPreguntas(preguntasData)
    } else {
      const pendientes = preguntasData.filter((p: Pregunta) => !yaRespondidas.has(p.id))
      setPreguntas(pendientes)
      if (pendientes.length === 0 && preguntasData.length > 0) setEstado('finalizado')
    }
    setCargando(false)
  }

  function preguntasDeLaRama(siTiene: boolean): Pregunta[] {
    return todasLasPreguntas.filter(p => {
      const txt = p.pregunta || ''
      if (txt.startsWith('[CON_EXP]')) return siTiene === true
      if (txt.startsWith('[SIN_EXP]')) return siTiene === false
      return true
    }).filter(p => !preguntasYaRespondidas.has(p.id))
  }

  function seleccionarExperiencia(siTiene: boolean) {
    setTieneExperiencia(siTiene)
    setPreguntas(preguntasDeLaRama(siTiene))
  }

  async function iniciarCamaraConExperiencia(siTiene: boolean) {
    const filtradas = preguntasDeLaRama(siTiene)
    setPreguntas(filtradas)

    // Ya respondió todas las preguntas que le correspondían en esta rama (ej. reingresó
    // después de completarla): no hace falta abrir la cámara de nuevo.
    if (filtradas.length === 0) {
      setEstado('finalizado')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
      }
      setEstado('preparacion')
      setTiempoRestante(filtradas[0]?.tiempo_preparacion || 30)
    } catch {
      alert('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
    }
  }

  async function iniciarCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
      }
      setEstado('preparacion')
      setTiempoRestante(preguntas[preguntaActual]?.tiempo_preparacion || 30)
    } catch {
      alert('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
    }
  }

  function iniciarGrabacion() {
    if (!streamRef.current) return
    chunksRef.current = []
    
    // Limitar el bitrate para evitar archivos gigantes (particularmente en iOS Safari)
    // que exceden el límite de 50MB de Supabase Storage.
    // 1.2 Mbps para video y 64 kbps para audio brindan excelente calidad con tamaños de ~9-15MB por minuto.
    let mediaRecorder: MediaRecorder
    try {
      const options = {
        videoBitsPerSecond: 1200000,
        audioBitsPerSecond: 64000
      }
      mediaRecorder = new MediaRecorder(streamRef.current, options)
    } catch (e) {
      console.warn("Error al inicializar MediaRecorder con opciones de bitrate. Reintentando por defecto:", e)
      mediaRecorder = new MediaRecorder(streamRef.current)
    }

    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mediaRecorder.start(1000)
    setEstado('grabando')
    setTiempoRestante(preguntas[preguntaActual]?.tiempo_respuesta || 60)
  }

  function detenerGrabacion() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.onstop = () => {
        setChunks([...chunksRef.current])
        setEstado('confirmacion')
      }
    }
  }

  async function confirmarRespuesta() {
    if (!entrevistaId) return

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })

    // Salvaguarda: en algunos dispositivos la camara/microfono deja de producir datos a mitad
    // de la entrevista (visto en produccion: la grabacion de la primera pregunta salia bien pero
    // las siguientes quedaban en 0 bytes, sin que la candidata se enterara -- se subian igual y
    // la entrevista se daba por completada). Si el blob viene vacio, no se sube: se le avisa a
    // la candidata y se la manda a regrabar antes de poder avanzar.
    if (blob.size === 0) {
      alert('No se pudo grabar tu respuesta (la cámara o el micrófono no capturaron nada). Por favor, volvé a grabar antes de continuar.')
      repetirGrabacion()
      return
    }

    setSubiendo(true)
    setErrorUpload(false)

    const fileName = `${entrevistaId}/${candidatoId || 'anonimo'}/${preguntas[preguntaActual].id}_${Date.now()}.webm`

    let urlVideo = null
    let logs: string[] = []
    let extraData: any = {
      blobSize: blob.size,
      blobType: blob.type,
      chunksCount: chunksRef.current.length,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    }

    try {
      // 1. Intentar subir a Cloudflare R2
      try {
        const resPresigned = await fetch('/api/r2-presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, contentType: 'video/webm', candidatoId, procesoId, entrevistaId, token })
        })
        
        if (resPresigned.ok) {
          const { signedUrl, publicUrl } = await resPresigned.json()
          if (signedUrl) {
            const uploadRes = await fetch(signedUrl, {
              method: 'PUT',
              body: blob,
              headers: { 'Content-Type': 'video/webm' }
            })
            if (uploadRes.ok) {
              urlVideo = publicUrl
              logs.push('R2: OK')
            } else {
              logs.push(`R2: PUT failed with status ${uploadRes.status}`)
            }
          } else {
            logs.push('R2: No signedUrl returned from api')
          }
        } else {
          logs.push(`R2: Presigned API failed with status ${resPresigned.status}`)
        }
      } catch (errR2: any) {
        logs.push(`R2: Exception: ${errR2.message || errR2}`)
      }

      // 2. Fallback: Supabase Storage con URL firmada (PUT directo)
      if (!urlVideo) {
        try {
          const resSupaPresigned = await fetch('/api/supabase-presigned', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, candidatoId, procesoId, entrevistaId: entrevistaId, token })
          })
          
          if (resSupaPresigned.ok) {
            const { signedUrl: supaSignedUrl } = await resSupaPresigned.json()

            if (supaSignedUrl) {
              const uploadRes = await fetch(supaSignedUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'video/webm' }
              })

              if (uploadRes.ok) {
                const { data: urlData } = supabase.storage
                  .from('videos-entrevista')
                  .getPublicUrl(fileName)
                urlVideo = urlData.publicUrl
                logs.push('Supabase: OK')
              } else {
                logs.push(`Supabase: PUT failed with status ${uploadRes.status}`)
              }
            } else {
              logs.push('Supabase: No signedUrl returned from api')
            }
          } else {
            logs.push(`Supabase: Presigned API failed with status ${resSupaPresigned.status}`)
          }
        } catch (supaErr: any) {
          logs.push(`Supabase: Exception: ${supaErr.message || supaErr}`)
        }
      }
    } catch (err: any) {
      logs.push(`Global Exception: ${err.message || err}`)
    }

    // Si ambos sistemas fallaron, mostrar error real al candidato y registrar el error en la base de datos
    if (!urlVideo) {
      setSubiendo(false)
      setErrorUpload(true)
      
      try {
        await fetch('/api/entrevista-video/candidato', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'guardar_respuesta',
            exito: false,
            candidatoId, procesoId, token,
            entrevistaId,
            preguntaId: preguntas[preguntaActual].id,
            duracion: preguntas[preguntaActual].tiempo_respuesta,
            logs: logs.join(' | '),
            extraData
          })
        })
      } catch (logErr) {
        console.error('Error insertando log en respuestas_video:', logErr)
      }
      return
    }

    // Upload exitoso: guardar en BD y continuar
    const guardarRes = await fetch('/api/entrevista-video/candidato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'guardar_respuesta',
        exito: true,
        candidatoId, procesoId, token,
        entrevistaId,
        preguntaId: preguntas[preguntaActual].id,
        duracion: preguntas[preguntaActual].tiempo_respuesta,
        urlVideo,
        fileName
      })
    })
    const guardarData = await guardarRes.json().catch(() => ({}))
    const insertData = guardarRes.ok ? guardarData.respuesta : null

    // Disparar análisis de IA en segundo plano (sin esperar)
    if (insertData) {
      fetch('/api/analizar-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_video: urlVideo, respuesta_id: insertData.id, candidato_id: candidatoId, proceso_id: procesoId, token })
      }).catch(err => console.error('Error disparando IA:', err))
    }

    setSubiendo(false)
    setErrorUpload(false)

    if (preguntaActual + 1 >= preguntas.length) {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      setEstado('finalizado')
    } else {
      setPreguntaActual(preguntaActual + 1)
      chunksRef.current = []
      setChunks([])
      setEstado('preparacion')
      setTiempoRestante(preguntas[preguntaActual + 1]?.tiempo_preparacion || 30)
    }
  }
  function repetirGrabacion() {
    chunksRef.current = []
    setChunks([])
    setEstado('preparacion')
    setTiempoRestante(preguntas[preguntaActual]?.tiempo_preparacion || 30)
  }

  const tienePreguntasCondicionales = todasLasPreguntas.some((p: any) => 
    (p.pregunta || '').startsWith('[CON_EXP]') || (p.pregunta || '').startsWith('[SIN_EXP]')
  )

  if (cargando) return <PantallaCarga texto="Cargando la entrevista…" />

  if (!entrevista || (estado !== 'finalizado' && preguntas.length === 0)) {
    return <PantallaError mensaje="Entrevista no encontrada o sin preguntas configuradas." />
  }

  if (estado === 'finalizado' && enEvaluacion) return <PantallaSiguiente />

  if (estado === 'finalizado') {
    return (
      <PantallaFin titulo="Entrevista completada">
        {nombreCandidato ? <>Gracias, <strong>{nombreCandidato}</strong>. </> : null}Tus respuestas fueron grabadas y enviadas correctamente al equipo de selección.
      </PantallaFin>
    )
  }

  const pregunta = preguntas[preguntaActual]

  if (estado === 'bienvenida') {
    return (
      <Marco titulo={entrevista.nombre}>
        <h1 className="pp-titulo">{entrevista.nombre}</h1>
        {nombreCandidato && <p className="pp-lead">Hola, <strong>{nombreCandidato}</strong>.</p>}

        <section className="pp-aparte" aria-labelledby="pp-antes">
          <h2 id="pp-antes">Antes de comenzar</h2>
          <ul className="pp-instrucciones">
            <li>Asegurate de tener buena iluminación y la cámara a la altura de los ojos.</li>
            <li>Verificá que el micrófono funcione y estés en un lugar tranquilo.</li>
            <li>Tendrás tiempo de preparación antes de cada pregunta.</li>
            <li>Podés repetir cada respuesta si no quedás conforme.</li>
            <li>Son {preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''} en total.</li>
          </ul>
        </section>

        {tienePreguntasCondicionales && tieneExperiencia === null ? (
          <section className="pp-aparte" aria-labelledby="pp-perfil">
            <h2 id="pp-perfil">Antes de iniciar, seleccioná tu perfil de experiencia laboral</h2>
            <div className="pp-acciones">
              <button
                type="button"
                className="pp-boton"
                onClick={() => {
                  seleccionarExperiencia(true)
                  iniciarCamaraConExperiencia(true)
                }}
              >
                Tengo experiencia laboral (formal o informal)
              </button>
              <button
                type="button"
                className="pp-boton pp-boton-secundario"
                onClick={() => {
                  seleccionarExperiencia(false)
                  iniciarCamaraConExperiencia(false)
                }}
              >
                No tengo experiencia laboral previa
              </button>
            </div>
          </section>
        ) : (
          <button type="button" className="pp-boton" onClick={iniciarCamara}>Comenzar entrevista</button>
        )}
      </Marco>
    )
  }

  // Cuenta regresiva: el tiempo de preparacion o el de respuesta, segun el momento
  const cuentaRegresiva = estado === 'preparacion'
    ? { restante: tiempoRestante, limite: pregunta.tiempo_preparacion || 30 }
    : estado === 'grabando'
      ? { restante: tiempoRestante, limite: pregunta.tiempo_respuesta }
      : {}

  return (
    <MarcoPrueba
      nombre="Entrevista en video"
      actual={preguntaActual + 1}
      total={preguntas.length}
      categoria={estado === 'preparacion' ? 'Preparate' : estado === 'grabando' ? 'Grabando tu respuesta' : 'Revisá tu respuesta'}
      {...cuentaRegresiva}
    >
      <h2 className="pp-enunciado">{(pregunta.pregunta || '').replace(/^\[CON_EXP\]\s*|^\[SIN_EXP\]\s*|^\[GENERAL\]\s*/i, '')}</h2>
      {estado === 'preparacion' && (
        <p className="pp-instruccion">Tiempo máximo de respuesta: {pregunta.tiempo_respuesta} segundos.</p>
      )}

      <div className="pp-video">
        <video ref={videoRef} autoPlay playsInline muted className="pp-video-el" />
        {estado === 'grabando' && (
          <div className="pp-rec"><span className="pp-rec-punto" aria-hidden="true" />REC</div>
        )}
        {estado === 'preparacion' && (
          <div className="pp-video-velo">
            <span>Preparate para responder</span>
            <strong>{tiempoRestante}s</strong>
          </div>
        )}
      </div>

      {estado === 'preparacion' && (
        <div className="pp-acciones">
          <button type="button" className="pp-boton" onClick={iniciarGrabacion}>Empezar a grabar ahora</button>
        </div>
      )}

      {estado === 'grabando' && (
        <div className="pp-acciones">
          <button type="button" className="pp-boton pp-boton-alarma" onClick={detenerGrabacion}>Detener grabación</button>
        </div>
      )}

      {estado === 'confirmacion' && (
        <div className="pp-acciones">
          {subiendo ? (
            <p className="pp-muted" role="status">Subiendo respuesta… por favor no cierres esta ventana.</p>
          ) : errorUpload ? (
            <>
              <div className="pp-alerta" role="alert">
                <p><strong>No se pudo enviar el video.</strong> Hubo un problema al subir tu respuesta. Por favor verificá tu conexión a internet e intentá nuevamente.</p>
              </div>
              <div className="pp-acciones pp-acciones-2">
                <button type="button" className="pp-boton pp-boton-secundario" onClick={repetirGrabacion}>Volver a grabar</button>
                <button type="button" className="pp-boton" onClick={confirmarRespuesta}>Reintentar envío</button>
              </div>
            </>
          ) : (
            <div className="pp-acciones pp-acciones-2">
              <button type="button" className="pp-boton pp-boton-secundario" onClick={repetirGrabacion}>Repetir respuesta</button>
              <button type="button" className="pp-boton" onClick={confirmarRespuesta}>
                {preguntaActual + 1 >= preguntas.length ? 'Finalizar entrevista' : 'Siguiente pregunta'}
              </button>
            </div>
          )}
        </div>
      )}
    </MarcoPrueba>
  )
}
