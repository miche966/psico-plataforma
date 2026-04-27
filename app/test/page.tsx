'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

import { useSearchParams } from 'next/navigation'

export default function TestPage() {
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const [nombreCandidato, setNombreCandidato] = useState<string>('')
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

  useEffect(() => {
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
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const [resultado, setResultado] = useState<Record<string, number>>({})

  useEffect(() => {
    cargarItems()
  }, [])

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
      .order('orden')

    if (error) {
      console.error(error)
      return
    }

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
      extraversion: [],
      amabilidad: [],
      responsabilidad: [],
      neuroticismo: [],
      apertura: []
    }

    todasLasRespuestas.forEach(r => {
      if (factores[r.factor]) {
        factores[r.factor].push(r.valor)
      }
    })

    const promedios: Record<string, number> = {}
    Object.entries(factores).forEach(([factor, valores]) => {
      const suma = valores.reduce((a, b) => a + b, 0)
      promedios[factor] = Math.round((suma / valores.length) * 10) / 10
    })

    setResultado(promedios)

    const { data: sesion, error: errorSesion } = await supabase
      .from('sesiones')
      .insert({
        test_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        candidato_id: candidatoId || null,
        estado: 'finalizado',
        iniciada_en: new Date().toISOString(),
        finalizada_en: new Date().toISOString(),
        puntaje_bruto: promedios
      })
      .select()
      .single()

    if (errorSesion || !sesion) {
      console.error('Error guardando sesión completo:', JSON.stringify(errorSesion))
      console.error('Sesion recibida:', JSON.stringify(sesion))
      return
    }

    const respuestasParaGuardar = todasLasRespuestas.map(r => ({
      sesion_id: sesion.id,
      item_id: r.item_id,
      valor: r.valor,
      tiempo_respuesta: 0
    }))

    const { error: errorRespuestas } = await supabase
      .from('respuestas')
      .insert(respuestasParaGuardar)

    if (errorRespuestas) {
      console.error('Error guardando respuestas:', errorRespuestas)
    }
  }

  const etiquetas: Record<string, string> = {
    extraversion: 'Extraversión',
    amabilidad: 'Amabilidad',
    responsabilidad: 'Responsabilidad',
    neuroticismo: 'Neuroticismo',
    apertura: 'Apertura'
  }

  if (cargando) {
    return (
      <div style={estilos.centro}>
        <p>Cargando test...</p>
      </div>
    )
  }

  if (finalizado) {
    return (
      <div style={estilos.contenedor}>
        <div style={estilos.checkCirculo}>✓</div>
        <h1 style={estilos.titulo}>¡Evaluación completada!</h1>
        {nombreCandidato && (
          <p style={estilos.nombreCandidato}>Gracias, <strong>{nombreCandidato}</strong>.</p>
        )}
        <p style={estilos.mensajeConfirmacion}>
          Tu evaluación fue registrada correctamente. Tus respuestas han sido enviadas al equipo de selección para su análisis.
        </p>
        <div style={estilos.contactoBox}>
          <p style={estilos.contactoTitulo}>Próximos pasos</p>
          <p style={estilos.contactoTexto}>
            El equipo de selección se pondrá en contacto contigo a la brevedad. Si tenés alguna consulta, podés comunicarte por los siguientes medios:
          </p>
          <div style={estilos.contactoDetalle}>
            <p style={estilos.contactoItem}>
              📧 <a href="mailto:seleccion@repúblicamicrofinanzas.com.uy" style={estilos.link}>
                seleccion@repúblicamicrofinanzas.com.uy
              </a>
            </p>
            <p style={estilos.contactoItem}>
              💬 WhatsApp: <a href="https://wa.me/598092651770" style={estilos.link}>092 651 770</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const item = items[itemActual]
  const progreso = Math.round((itemActual / items.length) * 100)

  if (!item) {
    return (
      <div style={estilos.centro}>
        <p>Cargando pregunta...</p>
      </div>
    )
  }

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.encabezado}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={estilos.progresotexto}>
            {itemActual + 1} de {items.length}
          </span>
          <span style={{ fontSize: '0.75rem', color: tiempoTranscurrido > 900 ? '#dc2626' : '#94a3b8' }}>
            {Math.floor(tiempoTranscurrido / 60)}:{String(tiempoTranscurrido % 60).padStart(2, '0')} / 15:00
          </span>
        </div>
        <div style={estilos.barraFondo}>
          <div style={{
            ...estilos.barraRelleno,
            width: `${progreso}%`
          }} />
        </div>
      </div>

      <h2 style={estilos.pregunta}>{item.contenido}</h2>

      <div style={estilos.opciones}>
        {item.opciones.map((opcion: string, index: number) => (
          <button
            key={index}
            style={estilos.opcionBoton}
            onClick={() => responder(index + 1)}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = '#2563eb'
              ;(e.target as HTMLButtonElement).style.color = '#fff'
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.background = '#fff'
              ;(e.target as HTMLButtonElement).style.color = '#1e293b'
            }}
          >
            {opcion}
          </button>
        ))}
      </div>
    </div>
  )
}

const estilos = {
  centro: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'sans-serif'
  } as React.CSSProperties,
  contenedor: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: 'sans-serif'
  } as React.CSSProperties,
  encabezado: {
    marginBottom: '2rem'
  } as React.CSSProperties,
  titulo: {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: '#1e293b'
  } as React.CSSProperties,
  subtitulo: {
    color: '#64748b',
    marginBottom: '2rem'
  } as React.CSSProperties,
  progresotexto: {
    fontSize: '0.875rem',
    color: '#64748b',
    display: 'block',
    marginBottom: '0.5rem'
  } as React.CSSProperties,
  barraFondo: {
    width: '100%',
    height: '8px',
    background: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '0.5rem'
  } as React.CSSProperties,
  barraRelleno: {
    height: '100%',
    background: '#2563eb',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  } as React.CSSProperties,
  pregunta: {
    fontSize: '1.25rem',
    fontWeight: '500',
    color: '#1e293b',
    lineHeight: '1.6',
    marginBottom: '2rem'
  } as React.CSSProperties,
  opciones: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  } as React.CSSProperties,
  opcionBoton: {
    padding: '0.875rem 1.25rem',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    background: '#fff',
    color: '#1e293b',
    fontSize: '1rem',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease'
  } as React.CSSProperties,
  factorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1rem'
  } as React.CSSProperties,
  factorNombre: {
    minWidth: '140px',
    fontSize: '0.875rem',
    color: '#1e293b'
  } as React.CSSProperties,
  factorValor: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#2563eb',
    minWidth: '30px'
  } as React.CSSProperties,
  boton: {
    marginTop: '2rem',
    padding: '0.75rem 1.5rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer'
  } as React.CSSProperties,
  checkCirculo: {
    width: '64px', height: '64px', borderRadius: '50%',
    background: '#16a34a', color: '#fff', fontSize: '2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 1.5rem'
  } as React.CSSProperties,
  nombreCandidato: {
    fontSize: '1.125rem', color: '#1e293b',
    textAlign: 'center' as const, margin: '0 0 1rem'
  } as React.CSSProperties,
  mensajeConfirmacion: {
    fontSize: '0.9rem', color: '#475569', lineHeight: '1.6',
    textAlign: 'center' as const, marginBottom: '2rem'
  } as React.CSSProperties,
  contactoBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '12px', padding: '1.5rem'
  } as React.CSSProperties,
  contactoTitulo: {
    fontSize: '0.875rem', fontWeight: '600',
    color: '#1e293b', margin: '0 0 0.5rem'
  } as React.CSSProperties,
  contactoTexto: {
    fontSize: '0.875rem', color: '#64748b',
    lineHeight: '1.6', margin: '0 0 1rem'
  } as React.CSSProperties,
  contactoDetalle: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  contactoItem: { fontSize: '0.875rem', color: '#1e293b', margin: 0 } as React.CSSProperties,
  link: { color: '#2563eb', textDecoration: 'none' } as React.CSSProperties,
}