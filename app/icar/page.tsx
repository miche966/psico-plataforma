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
  nivel_dificultad: number
  subtipo: string
}

function MatrizVisual({ codigo }: { codigo: string }) {
  const partes = codigo.split('|')
  const filas = partes.slice(1)
  const celdas = filas.join(',').split(',')

  const renderForma = (desc: string, size: number = 28) => {
    const d = desc.toLowerCase()
    const lleno = d.includes('lleno') || (!d.includes('vac') && !d.includes('empty'))
    const color = '#185FA5'
    const s = size

    if (d.includes('círculo') || d.includes('circulo')) {
      return <svg width={s} height={s} viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="10" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/>
      </svg>
    }
    if (d.includes('cuadrado')) {
      return <svg width={s} height={s} viewBox="0 0 30 30">
        <rect x="5" y="5" width="20" height="20" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/>
      </svg>
    }
    if (d.includes('triángulo') || d.includes('triangulo')) {
      return <svg width={s} height={s} viewBox="0 0 30 30">
        <polygon points="15,4 26,26 4,26" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/>
      </svg>
    }
    if (d.includes('punto')) {
      const n = parseInt(d) || 1
      const positions = [[15,15],[10,10],[20,10],[10,20],[20,20],[15,8],[8,15],[22,15],[15,22]]
      return <svg width={s} height={s} viewBox="0 0 30 30">
        {Array.from({length: Math.min(n,9)}).map((_,i) => (
          <circle key={i} cx={positions[i][0]} cy={positions[i][1]} r="3" fill={color}/>
        ))}
      </svg>
    }
    return <svg width={s} height={s} viewBox="0 0 30 30"><text x="15" y="20" textAnchor="middle" fontSize="10" fill={color}>?</text></svg>
  }

  const esInterrogante = (desc: string) => desc.trim() === '?'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '1.25rem', maxWidth: '180px' }}>
      {celdas.map((celda, i) => (
        <div key={i} style={{
          border: esInterrogante(celda) ? '2px solid #185FA5' : '0.5px solid var(--color-border-secondary)',
          borderRadius: '8px',
          background: esInterrogante(celda) ? '#E6F1FB' : 'var(--color-background-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px', aspectRatio: '1'
        }}>
          {esInterrogante(celda)
            ? <span style={{ fontSize: '18px', color: '#185FA5', fontWeight: '500' }}>?</span>
            : renderForma(celda)}
        </div>
      ))}
    </div>
  )
}

function OpcionMatriz({ texto, seleccionada, correcta, onClick }: {
  texto: string, seleccionada: boolean, correcta: boolean, onClick: () => void
}) {
  const renderForma = (desc: string) => {
    const d = desc.toLowerCase()
    const lleno = d.includes('lleno') || (!d.includes('vac') && !d.includes('empty'))
    const color = seleccionada ? '#fff' : '#185FA5'
    if (d.includes('círculo') || d.includes('circulo'))
      return <svg width="24" height="24" viewBox="0 0 30 30"><circle cx="15" cy="15" r="10" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/></svg>
    if (d.includes('cuadrado'))
      return <svg width="24" height="24" viewBox="0 0 30 30"><rect x="5" y="5" width="20" height="20" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/></svg>
    if (d.includes('triángulo') || d.includes('triangulo'))
      return <svg width="24" height="24" viewBox="0 0 30 30"><polygon points="15,4 26,26 4,26" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/></svg>
    return <span style={{ fontSize: '11px' }}>{texto}</span>
  }

  return (
    <button
      onClick={onClick}
      style={{
        border: seleccionada ? 'none' : '0.5px solid var(--color-border-secondary)',
        borderRadius: '8px',
        background: seleccionada ? '#185FA5' : 'var(--color-background-secondary)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '8px', cursor: 'pointer', transition: 'all .15s', gap: '4px'
      }}
    >
      {renderForma(texto)}
    </button>
  )
}

function FiguraRotacion({ codigo }: { codigo: string }) {
  const tipo = codigo.split('|')[0]
  const color = '#185FA5'
  
  // Mapeo de figuras basadas en el banco de ítems de ICAR
  if (tipo === 'ROTACION_A') {
    return (
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="25" y="5" width="12" height="25" fill={color}/>
        <rect x="5" y="25" width="25" height="12" fill={color}/>
        <rect x="25" y="37" width="12" height="18" fill={color}/>
      </svg>
    )
  }
  if (tipo === 'ROTACION_B') {
    return (
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="10" y="10" width="40" height="12" fill={color}/>
        <rect x="24" y="22" width="12" height="28" fill={color}/>
        <rect x="10" y="35" width="12" height="10" fill={color}/>
      </svg>
    )
  }
  if (tipo === 'ROTACION_C') {
    return (
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="20" y="5" width="12" height="50" fill={color}/>
        <rect x="32" y="25" width="20" height="12" fill={color}/>
        <rect x="10" y="40" width="10" height="12" fill={color}/>
      </svg>
    )
  }
  // Default/Fallback
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <rect x="20" y="20" width="20" height="20" fill={color}/>
    </svg>
  )
}

export default function IcarPage() {
  const metricasFraude = useProctoring()
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const [startTime] = useState(new Date().toISOString())
  const [tiempoRestante, setTiempoRestante] = useState(60)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const nivelMax = parseInt(searchParams.get('nivel') || '3')
  const sinRotacion = searchParams.get('rotacion') === 'no'

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
      setTiempoRestante(60)
      setSeleccionada(null)
    }
  }, [items, itemActual, respuestas])

  useEffect(() => {
    if (items.length === 0 || finalizado) return
    const timer = setInterval(() => {
      setTiempoRestante(prev => {
        if (prev <= 1) { avanzar(); return 60 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [items, finalizado, avanzar])

  async function cargarItems() {
    let query = supabase.from('items').select('*')
      .eq('test_id', 'f6a7b8c9-d0e1-2345-fabc-456789012345')
      .lte('nivel_dificultad', nivelMax)
      .order('subtipo').order('nivel_dificultad').order('orden')

    if (sinRotacion) query = query.neq('subtipo', 'rotacion')

    const { data, error } = await query
    if (error) { console.error(error); return }
    setItems(data || [])
    setCargando(false)
  }

  async function terminarTest(todasLasRespuestas: Record<string, string>, todosLosItems: Item[]) {
    let correctas = 0
    const porSubtipo: Record<string, { correctas: number, total: number }> = {}

    todosLosItems.forEach(item => {
      if (!porSubtipo[item.subtipo]) porSubtipo[item.subtipo] = { correctas: 0, total: 0 }
      porSubtipo[item.subtipo].total++
      if (todasLasRespuestas[item.id] === item.respuesta_correcta) {
        correctas++
        porSubtipo[item.subtipo].correctas++
      }
    })

    const resultado = {
      correctas,
      total: todosLosItems.length,
      porcentaje: Math.round((correctas / todosLosItems.length) * 100),
      por_subtipo: porSubtipo,
      nivel_maximo: nivelMax,
      metricas_fraude: metricasFraude // Añadimos las métricas al puntaje_bruto
    }

    setFinalizado(true)

    const { data: sesion, error } = await supabase.from('sesiones').insert({
      test_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      candidato_id: candidatoId || null,
      estado: 'finalizado',
      iniciada_en: startTime,
      finalizada_en: new Date().toISOString(),
      puntaje_bruto: resultado
    }).select().single()

    if (error || !sesion) return

    await supabase.from('respuestas').insert(
      todosLosItems.map(item => ({
        sesion_id: sesion.id,
        item_id: item.id,
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

  if (finalizado && enEvaluacion) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}><p>Guardando y volviendo al portal...</p></div>
  if (finalizado) return (
    <div style={s.contenedor}>
      <div style={s.checkCirculo}>✓</div>
      <h1 style={s.titulo}>Evaluación completada</h1>
      {nombreCandidato && <p style={s.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>}
      <p style={s.mensajeConfirmacion}>Tu evaluación fue registrada correctamente. Tus respuestas han sido enviadas al equipo de selección para su análisis.</p>
      <div style={s.contactoBox}>
        <p style={s.contactoTitulo}>Próximos pasos</p>
        <p style={s.contactoTexto}>El equipo de selección se pondrá en contacto contigo a la brevedad. Si tenés alguna consulta, podés comunicarte por los siguientes medios:</p>
        <div style={s.contactoDetalle}>
          <p style={s.contactoItem}>📧 <a href="mailto:seleccion@republicamicrofinanzas.com.uy" style={s.link}>seleccion@republicamicrofinanzas.com.uy</a></p>
          <p style={s.contactoItem}>💬 WhatsApp: <a href="https://wa.me/598092651770" style={s.link}>092 651 770</a></p>
        </div>
      </div>
    </div>
  )

  const item = items[itemActual]
  if (!item) return <div style={s.centro}><p>Cargando...</p></div>

  const esMatriz = item.contenido.startsWith('MATRIZ_')
  const esRotacion = item.contenido.startsWith('ROTACION_')
  const progreso = Math.round((itemActual / items.length) * 100)
  const tiempoColor = tiempoRestante <= 10 ? '#dc2626' : tiempoRestante <= 20 ? '#ea580c' : '#1e293b'

  const nivelLabel = ['', 'Básico', 'Intermedio', 'Avanzado'][item.nivel_dificultad] || ''
  const subtipoLabel = item.subtipo === 'series' ? 'Serie numérica' : item.subtipo === 'matrices' ? 'Matriz visual' : 'Rotación mental'

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div style={s.encabezadoTop}>
          <span style={s.testNombre}>ICAR — Razonamiento Abstracto</span>
          <div style={{ ...s.cronometro, color: tiempoColor }}>{tiempoRestante}s</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '0.4rem' }}>
          <span style={s.progresoTexto}>{itemActual + 1} de {items.length}</span>
          <span style={{ ...s.badge, background: '#E6F1FB', color: '#0C447C' }}>{subtipoLabel}</span>
          <span style={{ ...s.badge, background: item.nivel_dificultad === 1 ? '#EAF3DE' : item.nivel_dificultad === 2 ? '#FAEEDA' : '#FCEBEB', color: item.nivel_dificultad === 1 ? '#27500A' : item.nivel_dificultad === 2 ? '#633806' : '#501313' }}>{nivelLabel}</span>
        </div>
        <div style={s.barraFondo}>
          <div style={{ ...s.barraRelleno, width: `${progreso}%` }} />
        </div>
      </div>

      {!esMatriz && !esRotacion && (
        <>
          <h2 style={s.pregunta}>{item.contenido}</h2>
          <div style={s.opciones}>
            {item.opciones.map((opcion, index) => (
              <button
                key={index}
                style={{
                  ...s.opcionBoton,
                  background: seleccionada === opcion ? '#185FA5' : '#fff',
                  color: seleccionada === opcion ? '#fff' : '#1e293b',
                  borderColor: seleccionada === opcion ? '#185FA5' : '#e2e8f0',
                }}
                onClick={() => responder(opcion)}
                disabled={seleccionada !== null}
              >
                <span style={s.opcionLetra}>{['A','B','C','D'][index]}</span>
                {opcion}
              </button>
            ))}
          </div>
        </>
      )}

      {esMatriz && (
        <>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>¿Cuál figura completa correctamente la matriz?</p>
          <MatrizVisual codigo={item.contenido} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
            {item.opciones.map((opcion, index) => (
              <OpcionMatriz
                key={index}
                texto={opcion}
                seleccionada={seleccionada === opcion}
                correcta={opcion === item.respuesta_correcta}
                onClick={() => { if (!seleccionada) responder(opcion) }}
              />
            ))}
          </div>
        </>
      )}

      {esRotacion && (
        <>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>¿Cuál es la misma figura rotada?</p>
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', display: 'inline-block' }}>
            <FiguraRotacion codigo={item.contenido} />
            <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '4px' }}>Original</div>
          </div>
          <div style={s.opciones}>
            {item.opciones.map((opcion, index) => (
              <button
                key={index}
                style={{
                  ...s.opcionBoton,
                  background: seleccionada === opcion ? '#185FA5' : '#fff',
                  color: seleccionada === opcion ? '#fff' : '#1e293b',
                  borderColor: seleccionada === opcion ? '#185FA5' : '#e2e8f0',
                }}
                onClick={() => responder(opcion)}
                disabled={seleccionada !== null}
              >
                <span style={s.opcionLetra}>{['A','B','C','D'][index]}</span>
                {opcion}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={s.barraTiempo}>
        <div style={{ ...s.barraTiempoRelleno, width: `${(tiempoRestante / 60) * 100}%`, background: tiempoColor }} />
      </div>
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '600px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '1.5rem' } as React.CSSProperties,
  encabezadoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' } as React.CSSProperties,
  testNombre: { fontSize: '0.75rem', fontWeight: '500', color: '#185FA5', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as React.CSSProperties,
  cronometro: { fontSize: '1.25rem', fontWeight: '700', minWidth: '48px', textAlign: 'right' as const, transition: 'color 0.3s' } as React.CSSProperties,
  progresoTexto: { fontSize: '0.875rem', color: '#64748b' } as React.CSSProperties,
  badge: { fontSize: '10px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500' } as React.CSSProperties,
  barraFondo: { width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', background: '#185FA5', borderRadius: '3px', transition: 'width 0.3s ease' } as React.CSSProperties,
  pregunta: { fontSize: '1.2rem', fontWeight: '500', color: '#1e293b', lineHeight: '1.6', marginBottom: '1.75rem', fontFamily: 'monospace' } as React.CSSProperties,
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