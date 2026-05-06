'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { useProctoring } from '@/hooks/useProctoring'

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

export default function TestPage() {
  const metricasFraude = useProctoring()
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const [nombreCandidato, setNombreCandidato] = useState<string>('')
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [resultado, setResultado] = useState<Record<string, number>>({})

  useEffect(() => {
    cargarItems()
    if (candidatoId) {
      supabase.from('candidatos').select('nombre, apellido').eq('id', candidatoId).single()
        .then(({ data }) => { if (data) setNombreCandidato(`${data.nombre} ${data.apellido}`) })
    }
  }, [candidatoId])

  useEffect(() => {
    if (finalizado) return
    const timer = setInterval(() => {
      setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [finalizado, tiempoInicio])

  async function cargarItems() {
    const { data, error } = await supabase.from('items').select('*').order('orden')
    if (error) { console.error(error); return }
    setItems(data || [])
    setCargando(false)
  }

  function responder(valor: number) {
    const item = items[itemActual]
    const valorFinal = item.inverso ? 6 - valor : valor
    const nuevaRespuesta: Respuesta = { item_id: item.id, valor: valorFinal, factor: item.factor, inverso: item.inverso }
    const nuevasRespuestas = [...respuestas, nuevaRespuesta]
    setRespuestas(nuevasRespuestas)

    if (itemActual + 1 >= items.length) {
      calcularResultado(nuevasRespuestas)
      setFinalizado(true)
    } else {
      setItemActual(itemActual + 1)
    }
  }

  async function calcularResultado(todasLasRespuestas: Respuesta[]) {
    const factoresData: Record<string, number[]> = {
      extraversion: [], amabilidad: [], responsabilidad: [], neuroticismo: [], apertura: []
    }

    todasLasRespuestas.forEach(r => {
      if (factoresData[r.factor]) factoresData[r.factor].push(r.valor)
    })

    const promedios: Record<string, number> = {}
    Object.entries(factoresData).forEach(([factor, valores]) => {
      const suma = valores.reduce((a, b) => a + b, 0)
      promedios[factor] = Math.round((suma / valores.length) * 10) / 10
    })

    setResultado(promedios)

    const { data: sesion, error: errorSesion } = await supabase.from('sesiones').insert({
      test_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      candidato_id: candidatoId || null,
      estado: 'finalizado',
      iniciada_en: new Date(tiempoInicio).toISOString(),
      finalizada_en: new Date().toISOString(),
      puntaje_bruto: {
        ...promedios,
        metricas_fraude: metricasFraude
      }
    }).select().single()

    if (errorSesion || !sesion) return

    const respuestasParaGuardar = todasLasRespuestas.map(r => ({
      sesion_id: sesion.id,
      item_id: r.item_id,
      valor: r.valor,
      tiempo_respuesta: 0
    }))

    await supabase.from('respuestas').insert(respuestasParaGuardar)
  }

  if (cargando) return <div style={estilos.centro}><p>Cargando test...</p></div>
  if (finalizado && enEvaluacion) return <div style={estilos.centro}><p>Guardando resultados...</p></div>

  if (finalizado) {
    return (
      <div style={estilos.contenedor}>
        <div style={estilos.checkCirculo}>✓</div>
        <h1 style={estilos.titulo}>¡Evaluación completada!</h1>
        {nombreCandidato && <p style={estilos.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>}
        <p style={estilos.mensajeConfirmacion}>Tu evaluación fue registrada correctamente.</p>
      </div>
    )
  }

  const item = items[itemActual]
  const progreso = Math.round((itemActual / items.length) * 100)

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.encabezado}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={estilos.progresotexto}>{itemActual + 1} de {items.length}</span>
          <span style={{ fontSize: '0.75rem', color: tiempoTranscurrido > 900 ? '#dc2626' : '#94a3b8' }}>
            {Math.floor(tiempoTranscurrido / 60)}:{String(tiempoTranscurrido % 60).padStart(2, '0')}
          </span>
        </div>
        <div style={estilos.barraFondo}>
          <div style={{ ...estilos.barraRelleno, width: `${progreso}%` }} />
        </div>
      </div>
      <h2 style={estilos.pregunta}>{item?.contenido}</h2>
      <div style={estilos.opciones}>
        {item?.opciones.map((opcion: string, index: number) => (
          <button key={index} style={estilos.opcionBoton} onClick={() => responder(index + 1)}>
            {opcion}
          </button>
        ))}
      </div>
    </div>
  )
}

const estilos = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '600px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '2rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1e293b', textAlign: 'center' } as React.CSSProperties,
  progresotexto: { fontSize: '0.875rem', color: '#64748b' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#2563eb', borderRadius: '4px', transition: 'width 0.3s ease' } as React.CSSProperties,
  pregunta: { fontSize: '1.25rem', fontWeight: '500', color: '#1e293b', lineHeight: '1.6', marginBottom: '2rem' } as React.CSSProperties,
  opciones: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  opcionBoton: { padding: '0.875rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#1e293b', fontSize: '1rem', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s ease' } as React.CSSProperties,
  checkCirculo: { width: '64px', height: '64px', borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' } as React.CSSProperties,
  nombreCandidato: { fontSize: '1.125rem', color: '#1e293b', textAlign: 'center' as const, margin: '0 0 1rem' } as React.CSSProperties,
  mensajeConfirmacion: { fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', textAlign: 'center' as const, marginBottom: '2rem' } as React.CSSProperties,
}