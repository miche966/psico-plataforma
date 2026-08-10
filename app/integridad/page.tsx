'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { finalizarTest, MENSAJE_ERROR_GUARDADO } from '@/lib/finalizarTest'

const INTEGRIDAD_ID = 'e5f6a7b8-c9d0-1234-efab-345678901234'

interface Item {
  id: string
  orden: number
  contenido: string
  opciones: string[]
  factor: string
  inverso: boolean
}

interface Respuesta {
  item_id: string
  valor: number
  factor: string
  inverso: boolean
}

export default function IntegridadPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intentoCarga, setIntentoCarga] = useState(0)
  const [finalizado, setFinalizado] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

  const [sesionIdActual, setSesionIdActual] = useState<string | null>(null)

  useEffect(() => {
    async function iniciar() {
      if (!candidatoId || !procesoId) return
      setError(null)
      const token = searchParams.get('token') || ''
      const idUrl = searchParams.get('sesion') || undefined
      try {
        const response = await fetch('/api/evaluacion/public-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start_resumable', candidato_id: candidatoId, proceso_id: procesoId, token, test_id: INTEGRIDAD_ID, sesion_id: idUrl }) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) { setError(payload.error || 'No se pudo iniciar el test.'); setCargando(false); return }
        if (payload.sesion?.id) setSesionIdActual(payload.sesion.id)
        const datos = await fetch(`/api/evaluacion/public-data?candidato=${encodeURIComponent(candidatoId)}&proceso=${encodeURIComponent(procesoId)}&token=${encodeURIComponent(token)}&test_id=${encodeURIComponent(INTEGRIDAD_ID)}`, { cache: 'no-store' })
        const info = await datos.json().catch(() => ({}))
        if (!datos.ok) { setError(info.error || 'No se pudo cargar el test.'); setCargando(false); return }
        setItems(info.items || [])
        if (info.candidato) setNombreCandidato(`${info.candidato.nombre} ${info.candidato.apellido}`)
        setCargando(false)
      } catch {
        setError('No se pudo conectar con el servidor.')
        setCargando(false)
      }
    }
    setCargando(true)
    iniciar()
  }, [candidatoId, procesoId, searchParams, intentoCarga])

  useEffect(() => {
    if (finalizado) return
    const timer = setInterval(() => {
      setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [finalizado, tiempoInicio])

  function responder(valor: number) {
    const item = items[itemActual]
    const valorFinal = item.inverso ? 6 - valor : valor

    const nuevaRespuesta: Respuesta = {
      item_id: item.id,
      valor: valorFinal,
      factor: item.factor,
      inverso: item.inverso
    }

    const nuevasRespuestas = [...respuestas, nuevaRespuesta]
    setRespuestas(nuevasRespuestas)

    if (itemActual + 1 >= items.length) {
      calcularResultado(nuevasRespuestas)
    } else {
      setItemActual(itemActual + 1)
    }
  }

  async function calcularResultado(todasLasRespuestas: Respuesta[]) {
    const factores: Record<string, number[]> = {
      honestidad: [],
      normas: [],
      etica: []
    }

    todasLasRespuestas.forEach(r => {
      if (factores[r.factor]) factores[r.factor].push(r.valor)
    })

    const promedios: Record<string, number> = {}
    Object.entries(factores).forEach(([factor, valores]) => {
      const suma = valores.reduce((a, b) => a + b, 0)
      promedios[factor] = Math.round((suma / valores.length) * 10) / 10
    })

    const promedio_general = Math.round(
      (Object.values(promedios).reduce((a, b) => a + b, 0) / Object.values(promedios).length) * 10
    ) / 10

    const resultado = { ...promedios, promedio_general }

    if (!sesionIdActual || !candidatoId || !procesoId) return
    setErrorGuardado(null)
    const token = searchParams.get('token') || ''
    const resultadoGuardado = await finalizarTest({
      candidatoId, procesoId, token, testId: INTEGRIDAD_ID, sesionId: sesionIdActual,
      puntajeBruto: resultado,
      respuestas: todasLasRespuestas.map(r => ({ item_id: r.item_id, valor: r.valor, tiempo_respuesta: 0 })),
    })
    if (resultadoGuardado.ok) setFinalizado(true)
    else setErrorGuardado(resultadoGuardado.error)
  }

  if (cargando) return <div style={s.centro}><p>Cargando test...</p></div>
  if (error) return (
    <div style={s.centro}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 1.5rem' }}>
        <p style={{ color: '#dc2626', fontSize: '0.95rem', marginBottom: '1.25rem' }}>{error}</p>
        <button onClick={() => { setError(null); setCargando(true); setIntentoCarga(i => i + 1) }} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '0.9rem', cursor: 'pointer' }}>Reintentar</button>
      </div>
    </div>
  )

  if (errorGuardado) return (
    <div style={s.centro}>
      <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 1.5rem' }}>
        <p style={{ color: '#dc2626', fontSize: '0.95rem', marginBottom: '1.25rem' }}>{MENSAJE_ERROR_GUARDADO}</p>
        <button onClick={() => calcularResultado(respuestas)} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '0.9rem', cursor: 'pointer' }}>Reintentar</button>
      </div>
    </div>
  )

  if (finalizado && enEvaluacion) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><p>Cargando siguiente evaluación...</p></div>
  if (finalizado) {
    return (
      <div style={s.contenedor}>
        <div style={s.checkCirculo}>✓</div>
        <h1 style={s.titulo}>Evaluación completada</h1>
        {nombreCandidato && (
          <p style={s.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>
        )}
        <p style={s.mensajeConfirmacion}>
          Tu evaluación fue registrada correctamente. Tus respuestas han sido enviadas al equipo de selección para su análisis.
        </p>
        <div style={s.contactoBox}>
          <p style={s.contactoTitulo}>Próximos pasos</p>
          <p style={s.contactoTexto}>
            El equipo de selección se pondrá en contacto contigo a la brevedad. Si tenés alguna consulta, podés comunicarte por los siguientes medios:
          </p>
          <div style={s.contactoDetalle}>
            <p style={s.contactoItem}>
              📧 <a href="mailto:seleccion@republicamicrofinanzas.com.uy" style={s.link}>
                seleccion@republicamicrofinanzas.com.uy
              </a>
            </p>
            <p style={s.contactoItem}>
              💬 WhatsApp: <a href="https://wa.me/598092651770" style={s.link}>092 651 770</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const item = items[itemActual]
  if (!item) return <div style={s.centro}><p>Cargando...</p></div>
  const progreso = Math.round((itemActual / items.length) * 100)

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div style={s.testNombre}>Evaluación de Integridad Laboral</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{itemActual + 1} de {items.length}</span>
          <span style={{ fontSize: '0.75rem', color: tiempoTranscurrido > 900 ? '#dc2626' : '#94a3b8' }}>
            {Math.floor(tiempoTranscurrido / 60)}:{String(tiempoTranscurrido % 60).padStart(2, '0')} / 15:00
          </span>
        </div>
        <div style={s.barraFondo}>
          <div style={{ ...s.barraRelleno, width: `${progreso}%` }} />
        </div>
      </div>

      <div style={s.categoriaTag}>
        {item.factor === 'honestidad' ? 'Honestidad' :
         item.factor === 'normas' ? 'Cumplimiento de normas' : 'Conducta ética'}
      </div>

      <h2 style={s.pregunta}>{item.contenido}</h2>

      <div style={s.opciones}>
        {item.opciones.map((opcion: string, index: number) => (
          <button
            key={index}
            style={s.opcionBoton}
            onClick={() => responder(index + 1)}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = '#059669'
              ;(e.target as HTMLButtonElement).style.color = '#fff'
              ;(e.target as HTMLButtonElement).style.borderColor = '#059669'
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.background = '#fff'
              ;(e.target as HTMLButtonElement).style.color = '#1e293b'
              ;(e.target as HTMLButtonElement).style.borderColor = '#e2e8f0'
            }}
          >
            {opcion}
          </button>
        ))}
      </div>
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '600px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '1.5rem' } as React.CSSProperties,
  testNombre: { fontSize: '0.75rem', fontWeight: '500', color: '#059669', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' } as React.CSSProperties,
  progresoTexto: { fontSize: '0.875rem', color: '#64748b', display: 'block', marginBottom: '0.5rem' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#059669', borderRadius: '3px', transition: 'width 0.3s ease' } as React.CSSProperties,
  categoriaTag: { display: 'inline-block', fontSize: '0.75rem', padding: '3px 10px', background: '#d1fae5', color: '#059669', borderRadius: '99px', marginBottom: '1rem', fontWeight: '500' } as React.CSSProperties,
  pregunta: { fontSize: '1.2rem', fontWeight: '500', color: '#1e293b', lineHeight: '1.6', marginBottom: '1.75rem' } as React.CSSProperties,
  opciones: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  opcionBoton: { padding: '0.875rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#1e293b', fontSize: '1rem', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s ease' } as React.CSSProperties,
  checkCirculo: { width: '64px', height: '64px', borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', textAlign: 'center' as const, marginBottom: '0.5rem' } as React.CSSProperties,
  nombreCandidato: { fontSize: '1.125rem', color: '#1e293b', textAlign: 'center' as const, margin: '0 0 1rem' } as React.CSSProperties,
  mensajeConfirmacion: { fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', textAlign: 'center' as const, marginBottom: '2rem' } as React.CSSProperties,
  contactoBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' } as React.CSSProperties,
  contactoTitulo: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', margin: '0 0 0.5rem' } as React.CSSProperties,
  contactoTexto: { fontSize: '0.875rem', color: '#64748b', lineHeight: '1.6', margin: '0 0 1rem' } as React.CSSProperties,
  contactoDetalle: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' } as React.CSSProperties,
  contactoItem: { fontSize: '0.875rem', color: '#1e293b', margin: 0 } as React.CSSProperties,
  link: { color: '#2563eb', textDecoration: 'none' } as React.CSSProperties,
}