'use client'

import { useEffect, useState, useCallback } from 'react'
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
  respuesta_correcta: string
}

export default function VerbalPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [puntaje, setPuntaje] = useState({ correctas: 0, total: 0 })
  const [nombreCandidato, setNombreCandidato] = useState('')
  const [tiempoRestante, setTiempoRestante] = useState(60)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')

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
      setTiempoRestante(60)
      setSeleccionada(null)
    }
  }, [items, itemActual, respuestas])

  useEffect(() => {
    if (items.length === 0 || finalizado) return
    const timer = setInterval(() => {
      setTiempoRestante(prev => {
        if (prev <= 1) {
          avanzar()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [items, finalizado, avanzar])

  async function cargarItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('test_id', 'd4e5f6a7-b8c9-0123-defa-234567890123')
      .order('orden')

    if (error) { console.error(error); return }
    setItems(data || [])
    setCargando(false)
  }

  async function terminarTest(todasLasRespuestas: Record<string, string>, todosLosItems: Item[]) {
    let correctas = 0
    todosLosItems.forEach(item => {
      if (todasLasRespuestas[item.id] === item.respuesta_correcta) correctas++
    })

    setPuntaje({ correctas, total: todosLosItems.length })
    setFinalizado(true)

    const resultado = {
      correctas,
      total: todosLosItems.length,
      porcentaje: Math.round((correctas / todosLosItems.length) * 100)
    }

    const { data: sesion, error } = await supabase
      .from('sesiones')
      .insert({
        test_id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
        candidato_id: candidatoId || null,
        estado: 'finalizado',
        iniciada_en: new Date().toISOString(),
        finalizada_en: new Date().toISOString(),
        puntaje_bruto: resultado
      })
      .select()
      .single()

    if (error || !sesion) { console.error(error); return }

    const respuestasParaGuardar = todosLosItems.map(item => ({
      sesion_id: sesion.id,
      item_id: item.id,
      valor: todasLasRespuestas[item.id] === item.respuesta_correcta ? 1 : 0,
      tiempo_respuesta: 0
    }))

    await supabase.from('respuestas').insert(respuestasParaGuardar)
  }

  function responder(opcion: string) {
    setSeleccionada(opcion)
    setTimeout(() => avanzar(opcion), 400)
  }

  if (cargando) return <div style={s.centro}><p>Cargando test...</p></div>

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
  const tiempoColor = tiempoRestante <= 10 ? '#dc2626' : tiempoRestante <= 20 ? '#ea580c' : '#1e293b'

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div style={s.encabezadoTop}>
          <span style={s.testNombre}>Razonamiento Verbal</span>
          <div style={{ ...s.cronometro, color: tiempoColor }}>
            {tiempoRestante}s
          </div>
        </div>
        <div style={s.progresoInfo}>
          <span style={s.progresoTexto}>{itemActual + 1} de {items.length}</span>
        </div>
        <div style={s.barraFondo}>
          <div style={{ ...s.barraRelleno, width: `${progreso}%` }} />
        </div>
      </div>

      <div style={s.categoriaTag}>
        {item.factor === 'sinonimos' ? 'Sinónimos' :
         item.factor === 'analogias' ? 'Analogías' :
         item.factor === 'comprension' ? 'Comprensión' : 'Razonamiento verbal'}
      </div>

      <h2 style={s.pregunta}>{item.contenido}</h2>

      <div style={s.opciones}>
        {item.opciones.map((opcion: string, index: number) => (
          <button
            key={index}
            style={{
              ...s.opcionBoton,
              background: seleccionada === opcion ? '#0891b2' : '#fff',
              color: seleccionada === opcion ? '#fff' : '#1e293b',
              borderColor: seleccionada === opcion ? '#0891b2' : '#e2e8f0',
            }}
            onClick={() => responder(opcion)}
            disabled={seleccionada !== null}
          >
            <span style={s.opcionLetra}>
              {['A', 'B', 'C', 'D'][index]}
            </span>
            {opcion}
          </button>
        ))}
      </div>

      <div style={s.barraTiempo}>
        <div style={{
          ...s.barraTiempoRelleno,
          width: `${(tiempoRestante / 60) * 100}%`,
          background: tiempoColor
        }} />
      </div>
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '600px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '1.5rem' } as React.CSSProperties,
  encabezadoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' } as React.CSSProperties,
  testNombre: { fontSize: '0.75rem', fontWeight: '500', color: '#0891b2', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as React.CSSProperties,
  cronometro: { fontSize: '1.25rem', fontWeight: '700', minWidth: '48px', textAlign: 'right' as const, transition: 'color 0.3s' } as React.CSSProperties,
  progresoInfo: { marginBottom: '0.4rem' } as React.CSSProperties,
  progresoTexto: { fontSize: '0.875rem', color: '#64748b' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#0891b2', borderRadius: '3px', transition: 'width 0.3s ease' } as React.CSSProperties,
  categoriaTag: { display: 'inline-block', fontSize: '0.75rem', padding: '3px 10px', background: '#e0f2fe', color: '#0891b2', borderRadius: '99px', marginBottom: '1rem', fontWeight: '500' } as React.CSSProperties,
  pregunta: { fontSize: '1.2rem', fontWeight: '500', color: '#1e293b', lineHeight: '1.6', marginBottom: '1.75rem' } as React.CSSProperties,
  opciones: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem', marginBottom: '1.5rem' } as React.CSSProperties,
  opcionBoton: { padding: '0.875rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '0.75rem' } as React.CSSProperties,
  opcionLetra: { display: 'inline-flex', width: '24px', height: '24px', borderRadius: '50%', background: '#f1f5f9', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '600', flexShrink: 0 } as React.CSSProperties,
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