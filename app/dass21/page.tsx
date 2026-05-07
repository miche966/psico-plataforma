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
}

interface Respuesta {
  item_id: string
  valor: number // 0-3
  factor: string
}

const DASS21_TEST_ID = '7a8b9c0d-e1f2-4356-abcd-999999999999'

export default function Dass21Page() {
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
    const { data, error } = await supabase.from('items')
      .select('*')
      .eq('test_id', DASS21_TEST_ID)
      .order('orden')
    
    if (error) { console.error(error); return }
    setItems(data || [])
    setCargando(false)
  }

  function responder(valor: number) {
    const item = items[itemActual]
    const nuevaRespuesta: Respuesta = { item_id: item.id, valor, factor: item.factor }
    const nuevasRespuestas = [...respuestas, nuevaRespuesta]
    setRespuestas(nuevasRespuestas)

    if (itemActual + 1 >= items.length) {
      terminarTest(nuevasRespuestas)
    } else {
      setItemActual(itemActual + 1)
    }
  }

  async function terminarTest(todasLasRespuestas: Respuesta[]) {
    // Cálculo DASS-21: Suma de cada factor * 2
    const factoresSum: Record<string, number> = { depresion: 0, ansiedad: 0, estres: 0 }
    
    todasLasRespuestas.forEach(r => {
      if (factoresSum[r.factor] !== undefined) {
        factoresSum[r.factor] += r.valor
      }
    })

    const resultadoFinal: Record<string, number> = {
      depresion: factoresSum.depresion * 2,
      ansiedad: factoresSum.ansiedad * 2,
      estres: factoresSum.estres * 2
    }

    setFinalizado(true)

    const { data: sesion, error: errorSesion } = await supabase.from('sesiones').insert({
      test_id: DASS21_TEST_ID,
      candidato_id: candidatoId || null,
      estado: 'finalizado',
      iniciada_en: new Date(tiempoInicio).toISOString(),
      finalizada_en: new Date().toISOString(),
      puntaje_bruto: {
        ...resultadoFinal,
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

  if (cargando) return <div style={s.centro}><p>Cargando Screening de Salud Mental...</p></div>
  if (finalizado && enEvaluacion) return <div style={s.centro}><p>Guardando resultados...</p></div>

  if (finalizado) {
    return (
      <div style={s.contenedor}>
        <div style={s.checkCirculo}>✓</div>
        <h1 style={s.titulo}>Evaluación completada</h1>
        {nombreCandidato && <p style={s.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>}
        <p style={s.mensajeConfirmacion}>Tus respuestas han sido registradas. El equipo de selección analizará los resultados para garantizar el bienestar de todos los candidatos.</p>
      </div>
    )
  }

  const item = items[itemActual]
  const progreso = Math.round((itemActual / items.length) * 100)

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div style={s.encabezadoTop}>
          <span style={s.testNombre}>DASS-21</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {Math.floor(tiempoTranscurrido / 60)}:{String(tiempoTranscurrido % 60).padStart(2, '0')}
          </span>
        </div>
        <div style={s.barraFondo}>
          <div style={{ ...s.barraRelleno, width: `${progreso}%` }} />
        </div>
        <div style={s.progresoInfo}>
          <span style={s.progresoTexto}>Ítem {itemActual + 1} de {items.length}</span>
        </div>
      </div>

      <div style={s.card}>
        <p style={s.instruccion}>Por favor, lee cada afirmación e indica cuánto se ha aplicado a ti durante la <strong>última semana</strong>. No hay respuestas correctas o incorrectas.</p>
        <h2 style={s.pregunta}>{item?.contenido}</h2>
        <div style={s.opciones}>
          {item?.opciones.map((opcion, index) => (
            <button key={index} style={s.opcionBoton} onClick={() => responder(index)}>
              <span style={s.opcionIndex}>{index}</span>
              {opcion}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '700px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '2rem' } as React.CSSProperties,
  encabezadoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' } as React.CSSProperties,
  testNombre: { fontSize: '0.75rem', fontWeight: '600', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#6366f1', borderRadius: '3px', transition: 'width 0.3s ease' } as React.CSSProperties,
  progresoInfo: { textAlign: 'right' } as React.CSSProperties,
  progresoTexto: { fontSize: '0.75rem', color: '#64748b' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' } as React.CSSProperties,
  instruccion: { fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.5', fontStyle: 'italic' } as React.CSSProperties,
  pregunta: { fontSize: '1.35rem', fontWeight: '500', color: '#1e293b', lineHeight: '1.4', marginBottom: '2rem' } as React.CSSProperties,
  opciones: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  opcionBoton: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#fff', color: '#1e293b', fontSize: '1rem', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.2s ease' } as React.CSSProperties,
  opcionIndex: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', fontSize: '0.85rem', fontWeight: '600', color: '#475569' } as React.CSSProperties,
  checkCirculo: { width: '64px', height: '64px', borderRadius: '50%', background: '#16a34a', color: '#fff', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', textAlign: 'center' as const, marginBottom: '0.5rem' } as React.CSSProperties,
  nombreCandidato: { fontSize: '1.125rem', color: '#1e293b', textAlign: 'center' as const, margin: '0 0 1rem' } as React.CSSProperties,
  mensajeConfirmacion: { fontSize: '0.95rem', color: '#475569', lineHeight: '1.7', textAlign: 'center' as const, marginBottom: '2rem' } as React.CSSProperties,
}
