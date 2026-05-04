'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'

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
  const [preguntaActual, setPreguntaActual] = useState(0)
  const [estado, setEstado] = useState<Estado>('bienvenida')
  const enEvaluacion = useEvaluacionRedirect(estado === 'finalizado')
  const [cargando, setCargando] = useState(true)
  const [tiempoRestante, setTiempoRestante] = useState(0)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [chunks, setChunks] = useState<Blob[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const searchParams = useSearchParams()
  const entrevistaId = searchParams.get('entrevista')
  const candidatoId = searchParams.get('candidato')

  useEffect(() => {
    if (entrevistaId) cargarDatos()
    if (candidatoId) {
      supabase.from('candidatos').select('nombre, apellido')
        .eq('id', candidatoId).single()
        .then(({ data }) => { if (data) setNombreCandidato(`${data.nombre} ${data.apellido}`) })
    }
  }, [entrevistaId, candidatoId])

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

  async function cargarDatos() {
    const { data: entrevistaData } = await supabase
      .from('entrevistas_video').select('*').eq('id', entrevistaId).single()
    setEntrevista(entrevistaData)

    const { data: preguntasData } = await supabase
      .from('preguntas_video').select('*')
      .eq('entrevista_id', entrevistaId).order('orden')
    setPreguntas(preguntasData || [])
    setCargando(false)
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
    const mediaRecorder = new MediaRecorder(streamRef.current)
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
    setSubiendo(true)

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const fileName = `${entrevistaId}/${candidatoId || 'anonimo'}/${preguntas[preguntaActual].id}_${Date.now()}.webm`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos-entrevista')
      .upload(fileName, blob, { contentType: 'video/webm' })

    let urlVideo = null
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from('videos-entrevista')
        .getPublicUrl(fileName)
      urlVideo = urlData.publicUrl
    }

    const { data: insertData, error: insertError } = await supabase.from('respuestas_video').insert({
      pregunta_id: preguntas[preguntaActual].id,
      candidato_id: candidatoId || null,
      entrevista_id: entrevistaId,
      url_video: urlVideo,
      duracion: preguntas[preguntaActual].tiempo_respuesta,
      estado: urlVideo ? 'completado' : 'sin_video'
    }).select('id').single()

    // Disparar análisis de IA en segundo plano (sin esperar)
    if (urlVideo && insertData) {
      fetch('/api/analizar-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_video: urlVideo, respuesta_id: insertData.id })
      }).catch(err => console.error("Error disparando IA:", err))
    }

    setSubiendo(false)

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

  if (cargando) return <div style={s.centro}><p>Cargando entrevista...</p></div>

  if (!entrevista || preguntas.length === 0) return (
    <div style={s.centro}>
      <p>Entrevista no encontrada o sin preguntas configuradas.</p>
    </div>
  )

  if (estado === 'finalizado' && enEvaluacion) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><p>Cargando siguiente evaluación...</p></div>

  if (estado === 'finalizado') return (
    <div style={s.contenedor}>
      <div style={s.checkCirculo}>✓</div>
      <h1 style={s.titulo}>Entrevista completada</h1>
      {nombreCandidato && <p style={s.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>}
      <p style={s.mensajeConfirmacion}>
        Tus respuestas fueron grabadas y enviadas correctamente al equipo de selección.
      </p>
      <div style={s.contactoBox}>
        <p style={s.contactoTitulo}>Próximos pasos</p>
        <p style={s.contactoTexto}>El equipo de selección revisará tus respuestas y se pondrá en contacto a la brevedad.</p>
        <div style={s.contactoDetalle}>
          <p style={s.contactoItem}>📧 <a href="mailto:seleccion@republicamicrofinanzas.com.uy" style={s.link}>seleccion@republicamicrofinanzas.com.uy</a></p>
          <p style={s.contactoItem}>💬 WhatsApp: <a href="https://wa.me/598092651770" style={s.link}>092 651 770</a></p>
        </div>
      </div>
    </div>
  )

  const pregunta = preguntas[preguntaActual]
  const progreso = Math.round((preguntaActual / preguntas.length) * 100)
  const tiempoColor = tiempoRestante <= 10 ? '#dc2626' : tiempoRestante <= 20 ? '#ea580c' : '#1e293b'

  return (
    <div style={s.contenedor}>
      {estado !== 'bienvenida' && (
        <div style={s.encabezado}>
          <div style={s.encabezadoTop}>
            <span style={s.testNombre}>Entrevista en Video — {entrevista.nombre}</span>
            {estado !== 'confirmacion' && (
              <span style={{ ...s.cronometro, color: tiempoColor }}>{tiempoRestante}s</span>
            )}
          </div>
          <div style={s.progresoInfo}>
            <span style={s.progresoTexto}>Pregunta {preguntaActual + 1} de {preguntas.length}</span>
            <span style={{
              ...s.estadoBadge,
              background: estado === 'grabando' ? '#FCEBEB' : estado === 'preparacion' ? '#FAEEDA' : '#EAF3DE',
              color: estado === 'grabando' ? '#dc2626' : estado === 'preparacion' ? '#b45309' : '#16a34a'
            }}>
              {estado === 'preparacion' ? 'Preparate' : estado === 'grabando' ? 'Grabando' : 'Revisá tu respuesta'}
            </span>
          </div>
          <div style={s.barraFondo}>
            <div style={{ ...s.barraRelleno, width: `${progreso}%` }} />
          </div>
        </div>
      )}

      {estado === 'bienvenida' && (
        <div style={s.bienvenida}>
          <h1 style={s.titulo}>{entrevista.nombre}</h1>
          {nombreCandidato && <p style={s.nombreCandidato}>Hola, <strong>{nombreCandidato}</strong>.</p>}
          <div style={s.instruccionesBox}>
            <p style={s.instruccionTitulo}>Antes de comenzar</p>
            <div style={s.instruccionItem}>📷 Asegurate de tener buena iluminación y la cámara a la altura de los ojos</div>
            <div style={s.instruccionItem}>🎤 Verificá que el micrófono funcione y estés en un lugar tranquilo</div>
            <div style={s.instruccionItem}>⏱ Tendrás tiempo de preparación antes de cada pregunta</div>
            <div style={s.instruccionItem}>🔄 Podés repetir cada respuesta si no quedás conforme</div>
            <div style={s.instruccionItem}>📋 Son {preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''} en total</div>
          </div>
          <button style={s.botonGrande} onClick={iniciarCamara}>
            Comenzar entrevista
          </button>
        </div>
      )}

      {(estado === 'preparacion' || estado === 'grabando' || estado === 'confirmacion') && (
        <>
          <div style={s.preguntaBox}>
            <div style={s.preguntaLabel}>Pregunta {preguntaActual + 1}</div>
            <p style={s.preguntaTexto}>{pregunta.pregunta}</p>
          </div>

          <div style={s.videoWrapper}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={s.video}
            />
            {estado === 'grabando' && (
              <div style={s.recIndicator}>
                <div style={s.recDot} />
                REC
              </div>
            )}
            {estado === 'preparacion' && (
              <div style={s.overlayPrep}>
                <div style={s.overlayTexto}>Preparate para responder</div>
                <div style={s.overlayTimer}>{tiempoRestante}s</div>
              </div>
            )}
          </div>

          {estado === 'preparacion' && (
            <div style={s.controles}>
              <button style={s.botonGrande} onClick={iniciarGrabacion}>
                Empezar a grabar ahora
              </button>
            </div>
          )}

          {estado === 'grabando' && (
            <div style={s.controles}>
              <div style={s.barraTiempo}>
                <div style={{ ...s.barraTiempoRelleno, width: `${(tiempoRestante / pregunta.tiempo_respuesta) * 100}%`, background: tiempoColor }} />
              </div>
              <button style={{ ...s.botonGrande, background: '#dc2626' }} onClick={detenerGrabacion}>
                Detener grabación
              </button>
            </div>
          )}

          {estado === 'confirmacion' && (
            <div style={s.controles}>
              {subiendo ? (
                <div style={s.subiendo}>Subiendo respuesta...</div>
              ) : (
                <div style={s.botonesConfirmacion}>
                  <button style={{ ...s.botonGrande, background: '#f1f5f9', color: '#475569' }} onClick={repetirGrabacion}>
                    Repetir respuesta
                  </button>
                  <button style={s.botonGrande} onClick={confirmarRespuesta}>
                    {preguntaActual + 1 >= preguntas.length ? 'Finalizar entrevista' : 'Siguiente pregunta'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '680px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '1.5rem' } as React.CSSProperties,
  encabezadoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' } as React.CSSProperties,
  testNombre: { fontSize: '0.75rem', fontWeight: '500', color: '#2563eb', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as React.CSSProperties,
  cronometro: { fontSize: '1.25rem', fontWeight: '700', minWidth: '48px', textAlign: 'right' as const } as React.CSSProperties,
  progresoInfo: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.4rem' } as React.CSSProperties,
  progresoTexto: { fontSize: '0.875rem', color: '#64748b' } as React.CSSProperties,
  estadoBadge: { fontSize: '10px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#2563eb', borderRadius: '3px', transition: 'width 0.3s ease' } as React.CSSProperties,
  bienvenida: { textAlign: 'center' as const } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' } as React.CSSProperties,
  nombreCandidato: { fontSize: '1.125rem', color: '#1e293b', margin: '0 0 1.5rem' } as React.CSSProperties,
  instruccionesBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' as const } as React.CSSProperties,
  instruccionTitulo: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.75rem' } as React.CSSProperties,
  instruccionItem: { fontSize: '0.875rem', color: '#475569', padding: '4px 0', lineHeight: '1.5' } as React.CSSProperties,
  preguntaBox: { background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1rem' } as React.CSSProperties,
  preguntaLabel: { fontSize: '10px', fontWeight: '600', color: '#0C447C', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' } as React.CSSProperties,
  preguntaTexto: { fontSize: '1rem', color: '#1e293b', lineHeight: '1.6', margin: 0, fontWeight: '500' } as React.CSSProperties,
  videoWrapper: { position: 'relative' as const, borderRadius: '12px', overflow: 'hidden', background: '#1e293b', marginBottom: '1rem', aspectRatio: '16/9' } as React.CSSProperties,
  video: { width: '100%', height: '100%', objectFit: 'cover' as const } as React.CSSProperties,
  recIndicator: { position: 'absolute' as const, top: '12px', right: '12px', background: '#dc2626', color: '#fff', padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' } as React.CSSProperties,
  recDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' } as React.CSSProperties,
  overlayPrep: { position: 'absolute' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  overlayTexto: { color: '#fff', fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' } as React.CSSProperties,
  overlayTimer: { color: '#fff', fontSize: '3rem', fontWeight: '700' } as React.CSSProperties,
  controles: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  barraTiempo: { width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' } as React.CSSProperties,
  barraTiempoRelleno: { height: '100%', borderRadius: '2px', transition: 'width 1s linear' } as React.CSSProperties,
  botonGrande: { width: '100%', padding: '0.875rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' } as React.CSSProperties,
  botonesConfirmacion: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' } as React.CSSProperties,
  subiendo: { textAlign: 'center' as const, padding: '1rem', color: '#64748b', fontSize: '0.875rem' } as React.CSSProperties,
  checkCirculo: { width: '64px', height: '64px', borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' } as React.CSSProperties,
  mensajeConfirmacion: { fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', textAlign: 'center' as const, marginBottom: '2rem' } as React.CSSProperties,
  contactoBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' } as React.CSSProperties,
  contactoTitulo: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', margin: '0 0 0.5rem' } as React.CSSProperties,
  contactoTexto: { fontSize: '0.875rem', color: '#64748b', lineHeight: '1.6', margin: '0 0 1rem' } as React.CSSProperties,
  contactoDetalle: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' } as React.CSSProperties,
  contactoItem: { fontSize: '0.875rem', color: '#1e293b', margin: 0 } as React.CSSProperties,
  link: { color: '#2563eb', textDecoration: 'none' } as React.CSSProperties,
}