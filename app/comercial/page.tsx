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
}

export default function ComercialPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

  useEffect(() => {
    cargarItems()
    if (candidatoId) {
      supabase.from('candidatos').select('nombre, apellido')
        .eq('id', candidatoId).single()
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
    const { data, error } = await supabase
      .from('items').select('*')
      .eq('test_id', 'a1b2c3d4-e5f6-7890-abcd-111111111111')
      .order('orden')
    if (error) { console.error(error); return }
    setItems(data || [])
    setCargando(false)
  }

  function responder(valor: number) {
    const item = items[itemActual]
    const valorFinal = item.inverso ? 6 - valor : valor
    const nuevasRespuestas = [...respuestas, { item_id: item.id, valor: valorFinal, factor: item.factor }]
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
      orientacion_cliente: [],
      tolerancia_rechazo: [],
      motivacion_logro: [],
      proactividad: []
    }
    todasLasRespuestas.forEach(r => {
      if (factores[r.factor]) factores[r.factor].push(r.valor)
    })
    const promedios: Record<string, number> = {}
    Object.entries(factores).forEach(([factor, valores]) => {
      const suma = valores.reduce((a, b) => a + b, 0)
      promedios[factor] = Math.round((suma / valores.length) * 10) / 10
    })

    const { data: sesion, error } = await supabase.from('sesiones').insert({
      test_id: 'a1b2c3d4-e5f6-7890-abcd-111111111111',
      candidato_id: candidatoId || null,
      estado: 'finalizado',
      iniciada_en: new Date().toISOString(),
      finalizada_en: new Date().toISOString(),
      puntaje_bruto: promedios
    }).select().single()

    if (error || !sesion) { console.error(error); return }

    await supabase.from('respuestas').insert(
      todasLasRespuestas.map(r => ({
        sesion_id: sesion.id, item_id: r.item_id,
        valor: r.valor, tiempo_respuesta: 0
      }))
    )
  }

  if (cargando) return <div style={s.centro}><p>Cargando test...</p></div>

  if (finalizado && enEvaluacion) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><p>Cargando siguiente evaluación...</p></div>
  if (finalizado) return (
    <div style={s.contenedor}>
      <div style={s.checkCirculo}>✓</div>
      <h1 style={s.titulo}>Evaluación completada</h1>
      {nombreCandidato && <p style={s.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>}
      <p style={s.mensajeConfirmacion}>Tu evaluación fue registrada correctamente. Tus respuestas han sido enviadas al equipo de selección para su análisis.</p>
      <div style={s.contactoBox}>
        <p style={s.contactoTitulo}>Próximos pasos</p>
        <p style={s.contactoTexto}>El equipo de selección se pondrá en contacto contigo a la brevedad.</p>
        <div style={s.contactoDetalle}>
          <p style={s.contactoItem}>📧 <a href="mailto:seleccion@republicamicrofinanzas.com.uy" style={s.link}>seleccion@republicamicrofinanzas.com.uy</a></p>
          <p style={s.contactoItem}>💬 WhatsApp: <a href="https://wa.me/598092651770" style={s.link}>092 651 770</a></p>
        </div>
      </div>
    </div>
  )

  const item = items[itemActual]
  if (!item) return <div style={s.centro}><p>Cargando...</p></div>
  const progreso = Math.round((itemActual / items.length) * 100)

  const factorLabel: Record<string, string> = {
    orientacion_cliente: 'Orientación al cliente',
    tolerancia_rechazo: 'Tolerancia al rechazo',
    motivacion_logro: 'Motivación de logro',
    proactividad: 'Proactividad comercial'
  }

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div style={s.testNombre}>Orientación Comercial</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={s.progresoTexto}>{itemActual + 1} de {items.length}</span>
            <span style={s.badge}>{factorLabel[item.factor] || item.factor}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: tiempoTranscurrido > 900 ? '#dc2626' : '#94a3b8' }}>
            {Math.floor(tiempoTranscurrido / 60)}:{String(tiempoTranscurrido % 60).padStart(2, '0')} / 15:00
          </span>
        </div>
        <div style={s.barraFondo}>
          <div style={{ ...s.barraRelleno, width: `${progreso}%` }} />
        </div>
      </div>

      <h2 style={s.pregunta}>{item.contenido}</h2>

      <div style={s.opciones}>
        {item.opciones.map((opcion: string, index: number) => (
          <button
            key={index}
            style={s.opcionBoton}
            onClick={() => responder(index + 1)}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = '#d97706'
              ;(e.target as HTMLButtonElement).style.color = '#fff'
              ;(e.target as HTMLButtonElement).style.borderColor = '#d97706'
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
  testNombre: { fontSize: '0.75rem', fontWeight: '500', color: '#d97706', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '0.5rem' } as React.CSSProperties,
  progresoTexto: { fontSize: '0.875rem', color: '#64748b' } as React.CSSProperties,
  badge: { fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: '#FAEEDA', color: '#633806', fontWeight: '500' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#d97706', borderRadius: '3px', transition: 'width 0.3s ease' } as React.CSSProperties,
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