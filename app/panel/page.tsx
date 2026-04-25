'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Sesion {
  id: string
  finalizada_en: string
  puntaje_bruto: Record<string, number>
  candidato_id: string | null
}

const etiquetas: Record<string, string> = {
  extraversion: 'Extraversión',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  neuroticismo: 'Neuroticismo',
  apertura: 'Apertura'
}

const colores: Record<string, string> = {
  extraversion: '#2563eb',
  amabilidad: '#16a34a',
  responsabilidad: '#9333ea',
  neuroticismo: '#dc2626',
  apertura: '#ea580c'
}

export default function PanelPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [seleccionada, setSeleccionada] = useState<Sesion | null>(null)

  useEffect(() => {
    cargarSesiones()
  }, [])

  async function cargarSesiones() {
    const { data, error } = await supabase
      .from('sesiones')
      .select('*')
      .order('finalizada_en', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setSesiones(data || [])
    setCargando(false)
  }

  function formatearFecha(fecha: string) {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (cargando) {
    return (
      <div style={s.centro}>
        <p>Cargando panel...</p>
      </div>
    )
  }

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <h1 style={s.titulo}>Panel del evaluador</h1>
        <a href="/test" style={s.botonLink}>
          + Nueva evaluación
        </a>
      </div>

      <p style={s.subtitulo}>
        {sesiones.length} evaluación{sesiones.length !== 1 ? 'es' : ''} registrada{sesiones.length !== 1 ? 's' : ''}
      </p>

      {sesiones.length === 0 ? (
        <div style={s.vacio}>
          <p>No hay evaluaciones todavía.</p>
          <a href="/test" style={s.botonLink}>Iniciar primera evaluación</a>
        </div>
      ) : (
        <div style={s.grid}>
          <div style={s.lista}>
            {sesiones.map((sesion, index) => (
              <div
                key={sesion.id}
                style={{
                  ...s.tarjeta,
                  borderColor: seleccionada?.id === sesion.id ? '#2563eb' : '#e2e8f0'
                }}
                onClick={() => setSeleccionada(sesion)}
              >
                <div style={s.tarjetaEncabezado}>
                  <span style={s.tarjetaTitulo}>
                    Evaluación #{sesiones.length - index}
                  </span>
                  <span style={s.tarjetaFecha}>
                    {formatearFecha(sesion.finalizada_en)}
                  </span>
                </div>
                <div style={s.factoresMini}>
                  {sesion.puntaje_bruto && Object.entries(sesion.puntaje_bruto).map(([factor, valor]) => (
                    <div key={factor} style={s.factorMiniRow}>
                      <span style={s.factorMiniNombre}>{etiquetas[factor]}</span>
                      <div style={s.barraMini}>
                        <div style={{
                          ...s.barraMiniRelleno,
                          width: `${(valor / 5) * 100}%`,
                          background: colores[factor] || '#2563eb'
                        }} />
                      </div>
                      <span style={s.factorMiniValor}>{valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {seleccionada && (
            <div style={s.detalle}>
              <div style={s.detalleEncabezado}>
                <h2 style={s.detalleTitulo}>Detalle del perfil</h2>
                <button
                  style={s.cerrar}
                  onClick={() => setSeleccionada(null)}
                >
                  ✕
                </button>
              </div>
              <p style={s.detalleInfo}>
                Completado: {formatearFecha(seleccionada.finalizada_en)}
              </p>
              <div style={{ marginTop: '1.5rem' }}>
                {seleccionada.puntaje_bruto && Object.entries(seleccionada.puntaje_bruto).map(([factor, valor]) => (
                  <div key={factor} style={s.factorDetalle}>
                    <div style={s.factorDetalleEncabezado}>
                      <span style={s.factorDetalleNombre}>{etiquetas[factor]}</span>
                      <span style={{
                        ...s.factorDetalleValor,
                        color: colores[factor] || '#2563eb'
                      }}>
                        {valor} / 5
                      </span>
                    </div>
                    <div style={s.barraGrande}>
                      <div style={{
                        ...s.barraGrandeRelleno,
                        width: `${(valor / 5) * 100}%`,
                        background: colores[factor] || '#2563eb'
                      }} />
                    </div>
                    <p style={s.factorDescripcion}>
                      {interpretacion(factor, valor)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function interpretacion(factor: string, valor: number): string {
  const nivel = valor >= 4 ? 'alto' : valor >= 3 ? 'moderado' : 'bajo'

  const textos: Record<string, Record<string, string>> = {
    extraversion: {
      alto: 'Persona sociable, enérgica y orientada hacia el mundo externo. Disfruta del trabajo en equipo y los entornos dinámicos.',
      moderado: 'Equilibrio entre sociabilidad y reserva. Se adapta tanto a trabajos en equipo como a tareas individuales.',
      bajo: 'Persona reservada y reflexiva. Prefiere entornos tranquilos y el trabajo independiente.'
    },
    amabilidad: {
      alto: 'Alta orientación hacia los demás, cooperativa y empática. Facilita el trabajo en equipo y las relaciones interpersonales.',
      moderado: 'Equilibrio entre cooperación y asertividad. Puede trabajar bien con otros sin perder independencia de criterio.',
      bajo: 'Persona directa y orientada a resultados. Puede ser más competitiva que colaborativa.'
    },
    responsabilidad: {
      alto: 'Alta organización, disciplina y orientación al logro. Cumple compromisos y mantiene altos estándares de trabajo.',
      moderado: 'Nivel adecuado de organización y compromiso. Puede adaptarse a distintos niveles de estructura.',
      bajo: 'Estilo flexible y espontáneo. Puede tener dificultades con tareas que requieren alta planificación.'
    },
    neuroticismo: {
      alto: 'Mayor sensibilidad emocional y tendencia a experimentar estrés. Puede requerir entornos de trabajo estables.',
      moderado: 'Respuesta emocional equilibrada ante el estrés. Maneja bien la mayoría de las situaciones laborales.',
      bajo: 'Alta estabilidad emocional y resiliencia. Maneja bien la presión y los entornos de alta demanda.'
    },
    apertura: {
      alto: 'Alta curiosidad intelectual, creatividad y apertura al cambio. Destaca en roles que requieren innovación.',
      moderado: 'Equilibrio entre creatividad y pragmatismo. Se adapta tanto a entornos estructurados como creativos.',
      bajo: 'Preferencia por métodos conocidos y entornos predecibles. Destaca en roles con procesos claros y definidos.'
    }
  }

  return textos[factor]?.[nivel] || ''
}

const s = {
  centro: {
    display: 'flex', justifyContent: 'center',
    alignItems: 'center', height: '100vh',
    fontFamily: 'sans-serif'
  } as React.CSSProperties,
  contenedor: {
    maxWidth: '1100px', margin: '0 auto',
    padding: '2rem', fontFamily: 'sans-serif'
  } as React.CSSProperties,
  encabezado: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '0.5rem'
  } as React.CSSProperties,
  titulo: {
    fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: 0
  } as React.CSSProperties,
  subtitulo: {
    fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem'
  } as React.CSSProperties,
  botonLink: {
    padding: '0.5rem 1rem', background: '#2563eb', color: '#fff',
    borderRadius: '8px', textDecoration: 'none', fontSize: '0.875rem'
  } as React.CSSProperties,
  vacio: {
    textAlign: 'center' as const, padding: '3rem',
    color: '#64748b', fontSize: '0.875rem'
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem'
  } as React.CSSProperties,
  lista: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  tarjeta: {
    border: '1.5px solid #e2e8f0', borderRadius: '12px',
    padding: '1rem 1.25rem', cursor: 'pointer',
    transition: 'border-color 0.15s ease', background: '#fff'
  } as React.CSSProperties,
  tarjetaEncabezado: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '0.75rem'
  } as React.CSSProperties,
  tarjetaTitulo: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' } as React.CSSProperties,
  tarjetaFecha: { fontSize: '0.75rem', color: '#94a3b8' } as React.CSSProperties,
  factoresMini: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  factorMiniRow: { display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
  factorMiniNombre: { fontSize: '11px', color: '#64748b', minWidth: '110px' } as React.CSSProperties,
  barraMini: {
    flex: 1, height: '4px', background: '#e2e8f0',
    borderRadius: '2px', overflow: 'hidden'
  } as React.CSSProperties,
  barraMiniRelleno: { height: '100%', borderRadius: '2px' } as React.CSSProperties,
  factorMiniValor: { fontSize: '11px', color: '#64748b', minWidth: '20px' } as React.CSSProperties,
  detalle: {
    border: '1.5px solid #e2e8f0', borderRadius: '12px',
    padding: '1.5rem', background: '#fff', alignSelf: 'flex-start' as const,
    position: 'sticky' as const, top: '1rem'
  } as React.CSSProperties,
  detalleEncabezado: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  } as React.CSSProperties,
  detalleTitulo: { fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: 0 } as React.CSSProperties,
  cerrar: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#94a3b8', fontSize: '1rem'
  } as React.CSSProperties,
  detalleInfo: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' } as React.CSSProperties,
  factorDetalle: { marginBottom: '1.25rem' } as React.CSSProperties,
  factorDetalleEncabezado: {
    display: 'flex', justifyContent: 'space-between', marginBottom: '6px'
  } as React.CSSProperties,
  factorDetalleNombre: { fontSize: '0.875rem', fontWeight: '500', color: '#1e293b' } as React.CSSProperties,
  factorDetalleValor: { fontSize: '0.875rem', fontWeight: '600' } as React.CSSProperties,
  barraGrande: {
    width: '100%', height: '8px', background: '#e2e8f0',
    borderRadius: '4px', overflow: 'hidden', marginBottom: '6px'
  } as React.CSSProperties,
  barraGrandeRelleno: { height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' } as React.CSSProperties,
  factorDescripcion: { fontSize: '0.75rem', color: '#64748b', lineHeight: '1.5', margin: 0 } as React.CSSProperties,
}