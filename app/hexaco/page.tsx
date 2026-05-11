'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'

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

export default function HexacoPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [resultado, setResultado] = useState<Record<string, number>>({})
  const [nombreCandidato, setNombreCandidato] = useState('')
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

  useEffect(() => {
    cargarItems()
    if (candidatoId) {
      supabase
        .from('candidatos')
        .select('nombre, apellido')
        .eq('id', candidatoId)
        .single()
        .then(({ data }) => {
          if (data) setNombreCandidato(`${data.nombre} ${data.apellido}`)
        })
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
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('test_id', 'b2c3d4e5-f6a7-8901-bcde-f12345678901')
      .order('orden')

    if (error) { console.error(error); return }
    setItems(data || [])
    setCargando(false)
  }

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
      setFinalizado(true)
    } else {
      setItemActual(itemActual + 1)
    }
  }

  async function calcularResultado(todasLasRespuestas: Respuesta[]) {
    const factores: Record<string, number[]> = {
      honestidad: [],
      emocionalidad: [],
      extraversion: [],
      amabilidad: [],
      responsabilidad: [],
      apertura: []
    }

    todasLasRespuestas.forEach(r => {
      if (factores[r.factor]) factores[r.factor].push(r.valor)
    })

    const promedios: Record<string, number> = {}
    Object.entries(factores).forEach(([factor, valores]) => {
      const suma = valores.reduce((a, b) => a + b, 0)
      promedios[factor] = Math.round((suma / valores.length) * 10) / 10
    })

    setResultado(promedios)

    const { data: sesion, error } = await supabase
      .from('sesiones')
      .insert({
        test_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        candidato_id: candidatoId || null,
        proceso_id: procesoId || null,
        estado: 'finalizado',
        iniciada_en: new Date().toISOString(),
        finalizada_en: new Date().toISOString(),
        puntaje_bruto: promedios
      })
      .select()
      .single()

    if (error || !sesion) { console.error(error); return }

    const respuestasParaGuardar = todasLasRespuestas.map(r => ({
      sesion_id: sesion.id,
      item_id: r.item_id,
      valor: r.valor,
      tiempo_respuesta: 0
    }))

    await supabase.from('respuestas').insert(respuestasParaGuardar)
  }

  const etiquetas: Record<string, string> = {
    honestidad: 'Honestidad-Humildad',
    emocionalidad: 'Emocionalidad',
    extraversion: 'Extraversión',
    amabilidad: 'Amabilidad',
    responsabilidad: 'Responsabilidad',
    apertura: 'Apertura'
  }

  const colores: Record<string, string> = {
    honestidad: '#0891b2',
    emocionalidad: '#db2777',
    extraversion: '#2563eb',
    amabilidad: '#16a34a',
    responsabilidad: '#9333ea',
    apertura: '#ea580c'
  }

  if (cargando) return <div style={e.centro}><p>Cargando test...</p></div>

  if (finalizado && enEvaluacion) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><p>Cargando siguiente evaluación...</p></div>
  if (finalizado) {
    return (
      <div style={e.contenedor}>
        <div style={e.checkCirculo}>✓</div>
        <h1 style={e.titulo}>¡Evaluación completada!</h1>
        {nombreCandidato && (
          <p style={e.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>
        )}
        <p style={e.mensajeConfirmacion}>
          Tu evaluación fue registrada correctamente. Tus respuestas han sido enviadas al equipo de selección para su análisis.
        </p>
        <div style={e.contactoBox}>
          <p style={e.contactoTitulo}>Próximos pasos</p>
          <p style={e.contactoTexto}>
            El equipo de selección se pondrá en contacto contigo a la brevedad. Si tenés alguna consulta, podés comunicarte por los siguientes medios:
          </p>
          <div style={e.contactoDetalle}>
            <p style={e.contactoItem}>
              📧 <a href="mailto:seleccion@republicamicrofinanzas.com.uy" style={e.link}>
                seleccion@republicamicrofinanzas.com.uy
              </a>
            </p>
            <p style={e.contactoItem}>
              💬 WhatsApp: <a href="https://wa.me/598092651770" style={e.link}>092 651 770</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const item = items[itemActual]
  if (!item) return <div style={e.centro}><p>Cargando pregunta...</p></div>
  const progreso = Math.round((itemActual / items.length) * 100)

  return (
    <div style={e.contenedor}>
      <div style={e.encabezado}>
        <div style={e.testNombre}>HEXACO — Evaluación de Personalidad</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{itemActual + 1} de {items.length}</span>
          <span style={{ fontSize: '0.75rem', color: tiempoTranscurrido > 1500 ? '#dc2626' : '#94a3b8' }}>
            {Math.floor(tiempoTranscurrido / 60)}:{String(tiempoTranscurrido % 60).padStart(2, '0')} / 25:00
          </span>
        </div>
        <div style={e.barraFondo}>
          <div style={{ ...e.barraRelleno, width: `${progreso}%` }} />
        </div>
      </div>

      <h2 style={e.pregunta}>{item.contenido}</h2>

      <div style={e.opciones}>
        {item.opciones.map((opcion: string, index: number) => (
          <button
            key={index}
            style={e.opcionBoton}
            onClick={() => responder(index + 1)}
            onMouseEnter={e2 => {
              (e2.target as HTMLButtonElement).style.background = '#2563eb'
              ;(e2.target as HTMLButtonElement).style.color = '#fff'
            }}
            onMouseLeave={e2 => {
              (e2.target as HTMLButtonElement).style.background = '#fff'
              ;(e2.target as HTMLButtonElement).style.color = '#1e293b'
            }}
          >
            {opcion}
          </button>
        ))}
      </div>
    </div>
  )
}

const e = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '600px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '2rem' } as React.CSSProperties,
  testNombre: { fontSize: '0.75rem', fontWeight: '500', color: '#0891b2', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' } as React.CSSProperties,
  progresoTexto: { fontSize: '0.875rem', color: '#64748b', display: 'block', marginBottom: '0.5rem' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#0891b2', borderRadius: '4px', transition: 'width 0.3s ease' } as React.CSSProperties,
  pregunta: { fontSize: '1.25rem', fontWeight: '500', color: '#1e293b', lineHeight: '1.6', marginBottom: '2rem' } as React.CSSProperties,
  opciones: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  opcionBoton: { padding: '0.875rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#1e293b', fontSize: '1rem', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s ease' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', textAlign: 'center' as const, marginBottom: '0.5rem' } as React.CSSProperties,
  checkCirculo: { width: '64px', height: '64px', borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' } as React.CSSProperties,
  nombreCandidato: { fontSize: '1.125rem', color: '#1e293b', textAlign: 'center' as const, margin: '0 0 1rem' } as React.CSSProperties,
  mensajeConfirmacion: { fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', textAlign: 'center' as const, marginBottom: '2rem' } as React.CSSProperties,
  contactoBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' } as React.CSSProperties,
  contactoTitulo: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', margin: '0 0 0.5rem' } as React.CSSProperties,
  contactoTexto: { fontSize: '0.875rem', color: '#64748b', lineHeight: '1.6', margin: '0 0 1rem' } as React.CSSProperties,
  contactoDetalle: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' } as React.CSSProperties,
  contactoItem: { fontSize: '0.875rem', color: '#1e293b', margin: 0 } as React.CSSProperties,
  link: { color: '#2563eb', textDecoration: 'none' } as React.CSSProperties,
}