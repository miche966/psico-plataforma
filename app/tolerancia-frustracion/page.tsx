'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'

interface Item {
  id: string
  orden: number
  contenido: string
  opciones: string[]
  factor: string
  respuesta_correcta: string
}

export default function SjtCobranzasPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const [tiempoRestante, setTiempoRestante] = useState(90)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
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

  const avanzar = useCallback((respuestaActual?: string) => {
    const item = items[itemActual]
    if (!item) return
    const nuevasRespuestas = { ...respuestas }
    if (respuestaActual) nuevasRespuestas[item.id] = respuestaActual
    if (itemActual + 1 >= items.length) {
      terminarTest(nuevasRespuestas, items)
    } else {
      setRespuestas(nuevasRespuestas)
      setItemActual(itemActual + 1)
      setTiempoRestante(90)
      setSeleccionada(null)
    }
  }, [items, itemActual, respuestas])

  useEffect(() => {
    if (items.length === 0 || finalizado) return
    const timer = setInterval(() => {
      setTiempoRestante(prev => {
        if (prev <= 1) { avanzar(); return 90 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [items, finalizado, avanzar])

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
      .eq('test_id', 'e5f6a7b8-c9d0-1234-efab-555555555555')
      .order('orden')
    if (error) { console.error(error); return }
    setItems(data || [])
    setCargando(false)
  }

  async function terminarTest(todasLasRespuestas: Record<string, string>, todosLosItems: Item[]) {
    let correctas = 0
    const porFactor: Record<string, { correctas: number, total: number }> = {}
    todosLosItems.forEach(item => {
      if (!porFactor[item.factor]) porFactor[item.factor] = { correctas: 0, total: 0 }
      porFactor[item.factor].total++
      if (todasLasRespuestas[item.id] === item.respuesta_correcta) {
        correctas++
        porFactor[item.factor].correctas++
      }
    })
    const resultado = { correctas, total: todosLosItems.length, porcentaje: Math.round((correctas / todosLosItems.length) * 100), por_factor: porFactor }
    setFinalizado(true)
    const { data: sesion, error } = await supabase.from('sesiones').insert({
      test_id: 'e5f6a7b8-c9d0-1234-efab-555555555555',
      candidato_id: candidatoId || null,
      estado: 'finalizado',
      iniciada_en: new Date().toISOString(),
      finalizada_en: new Date().toISOString(),
      puntaje_bruto: resultado
    }).select().single()
    if (error || !sesion) return
    await supabase.from('respuestas').insert(
      todosLosItems.map(item => ({
        sesion_id: sesion.id, item_id: item.id,
        valor: todasLasRespuestas[item.id] === item.respuesta_correcta ? 1 : 0,
        tiempo_respuesta: 0
      }))
    )
  }

  function responder(opcion: string) {
    setSeleccionada(opcion)
    setTimeout(() => avanzar(opcion), 400)
  }

  if (cargando) return <div style={s.centro}><p>Cargando test...</p></div>

  if (finalizado && enEvaluacion) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><p>Cargando siguiente evaluación...</p></div>
  if (finalizado) return (
    <div style={s.contenedor}>
      <div style={s.checkCirculo}>✓</div>
      <h1 style={s.titulo}>Evaluación completada</h1>
      {nombreCandidato && <p style={s.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>}
      <p style={s.mensajeConfirmacion}>Tu evaluación fue registrada correctamente.</p>
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
  const tiempoColor = tiempoRestante <= 15 ? '#dc2626' : tiempoRestante <= 30 ? '#ea580c' : '#1e293b'

  const factorLabel: Record<string, string> = {
    negociacion: 'Negociación', manejo_emocional: 'Manejo emocional',
    etica: 'Ética', tolerancia_frustracion: 'Tolerancia a la frustración'
  }

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div style={s.encabezadoTop}>
          <span style={s.testNombre}>SJT — Cobranzas Telefónicas</span>
          <div style={{ ...s.cronometro, color: tiempoColor }}>{tiempoRestante}s</div>
        </div>
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
      <div style={s.escenarioBox}>
        <div style={s.escenarioLabel}>Situación</div>
        <p style={s.escenarioTexto}>{item.contenido}</p>
      </div>
      <div style={s.preguntaLabel}>¿Qué harías en esta situación?</div>
      <div style={s.opciones}>
        {item.opciones.map((opcion: string, index: number) => (
          <button key={index}
            style={{ ...s.opcionBoton, background: seleccionada === opcion ? '#dc2626' : '#fff', color: seleccionada === opcion ? '#fff' : '#1e293b', borderColor: seleccionada === opcion ? '#dc2626' : '#e2e8f0' }}
            onClick={() => responder(opcion)} disabled={seleccionada !== null}>
            <span style={{ ...s.opcionLetra, background: seleccionada === opcion ? 'rgba(255,255,255,0.2)' : '#f1f5f9', color: seleccionada === opcion ? '#fff' : '#64748b' }}>
              {['A', 'B', 'C', 'D'][index]}
            </span>
            {opcion}
          </button>
        ))}
      </div>
      <div style={s.barraTiempo}>
        <div style={{ ...s.barraTiempoRelleno, width: `${(tiempoRestante / 90) * 100}%`, background: tiempoColor }} />
      </div>
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '620px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '1.5rem' } as React.CSSProperties,
  encabezadoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' } as React.CSSProperties,
  testNombre: { fontSize: '0.75rem', fontWeight: '500', color: '#dc2626', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as React.CSSProperties,
  cronometro: { fontSize: '1.25rem', fontWeight: '700', minWidth: '48px', textAlign: 'right' as const } as React.CSSProperties,
  progresoTexto: { fontSize: '0.875rem', color: '#64748b' } as React.CSSProperties,
  badge: { fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: '#FCEBEB', color: '#501313', fontWeight: '500' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#dc2626', borderRadius: '3px', transition: 'width 0.3s ease' } as React.CSSProperties,
  escenarioBox: { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' } as React.CSSProperties,
  escenarioLabel: { fontSize: '10px', fontWeight: '600', color: '#991B1B', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' } as React.CSSProperties,
  escenarioTexto: { fontSize: '13px', color: '#1e293b', lineHeight: '1.6', margin: 0 } as React.CSSProperties,
  preguntaLabel: { fontSize: '13px', fontWeight: '500', color: '#475569', marginBottom: '0.75rem' } as React.CSSProperties,
  opciones: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem', marginBottom: '1.5rem' } as React.CSSProperties,
  opcionBoton: { padding: '0.875rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s ease', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', lineHeight: '1.5' } as React.CSSProperties,
  opcionLetra: { display: 'inline-flex', width: '22px', height: '22px', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: 0, marginTop: '1px' } as React.CSSProperties,
  barraTiempo: { width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' } as React.CSSProperties,
  barraTiempoRelleno: { height: '100%', borderRadius: '2px', transition: 'width 1s linear, background 0.3s' } as React.CSSProperties,
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