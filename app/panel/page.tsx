'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

interface Sesion {
  id: string
  finalizada_en: string
  puntaje_bruto: Record<string, number>
  candidato_id: string | null
  candidato?: Candidato
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
    const { data: sesionesData, error } = await supabase
      .from('sesiones')
      .select('*')
      .order('finalizada_en', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const candidatoIds = sesionesData
      ?.filter(s => s.candidato_id)
      .map(s => s.candidato_id) || []

    let candidatos: Candidato[] = []

    if (candidatoIds.length > 0) {
      const { data } = await supabase
        .from('candidatos')
        .select('id, nombre, apellido, email')
        .in('id', candidatoIds)

      candidatos = data || []
    }

    const sesionesConCandidato = sesionesData?.map(sesion => ({
      ...sesion,
      candidato: candidatos.find(c => c.id === sesion.candidato_id)
    })) || []

    setSesiones(sesionesConCandidato)
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

  function nombreCandidato(sesion: Sesion) {
    if (sesion.candidato) {
      return `${sesion.candidato.nombre} ${sesion.candidato.apellido}`
    }
    return 'Evaluación anónima'
  }

  if (cargando) {
    return <div style={s.centro}><p>Cargando panel...</p></div>
  }

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <h1 style={s.titulo}>Panel del evaluador</h1>
          <p style={s.subtitulo}>
            {sesiones.length} evaluación{sesiones.length !== 1 ? 'es' : ''} registrada{sesiones.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/candidatos" style={s.botonSecundario}>Candidatos</a>
          <a href="/test" style={s.botonPrimario}>+ Nueva evaluación</a>
        </div>
      </div>

      {sesiones.length === 0 ? (
        <div style={s.vacio}>
          <p>No hay evaluaciones todavía.</p>
          <a href="/candidatos" style={s.botonPrimario}>Ir a candidatos</a>
        </div>
      ) : (
        <div style={s.grid}>
          <div style={s.lista}>
            {sesiones.map(sesion => (
              <div
                key={sesion.id}
                style={{
                  ...s.tarjeta,
                  borderColor: seleccionada?.id === sesion.id ? '#2563eb' : '#e2e8f0'
                }}
                onClick={() => setSeleccionada(sesion)}
              >
                <div style={s.tarjetaEncabezado}>
                  <div>
                    <div style={s.tarjetaNombre}>{nombreCandidato(sesion)}</div>
                    {sesion.candidato && (
                      <div style={s.tarjetaEmail}>{sesion.candidato.email}</div>
                    )}
                  </div>
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
                <div>
                  <h2 style={s.detalleTitulo}>{nombreCandidato(seleccionada)}</h2>
                  {seleccionada.candidato && (
                    <p style={s.detalleEmail}>{seleccionada.candidato.email}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
  <button
    style={s.botonPDF}
    onClick={() => generarPDF(seleccionada)}
  >
    Descargar PDF
  </button>
  <button style={s.cerrar} onClick={() => setSeleccionada(null)}>✕</button>
</div>
              </div>
              <p style={s.detalleInfo}>
                Completado: {formatearFecha(seleccionada.finalizada_en)}
              </p>
              <div style={{ marginTop: '1.5rem' }}>
                {seleccionada.puntaje_bruto && Object.entries(seleccionada.puntaje_bruto).map(([factor, valor]) => (
                  <div key={factor} style={s.factorDetalle}>
                    <div style={s.factorDetalleEncabezado}>
                      <span style={s.factorDetalleNombre}>{etiquetas[factor]}</span>
                      <span style={{ ...s.factorDetalleValor, color: colores[factor] }}>
                        {valor} / 5
                      </span>
                    </div>
                    <div style={s.barraGrande}>
                      <div style={{
                        ...s.barraGrandeRelleno,
                        width: `${(valor / 5) * 100}%`,
                        background: colores[factor]
                      }} />
                    </div>
                    <p style={s.factorDescripcion}>{interpretacion(factor, valor)}</p>
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
async function generarPDF(sesion: Sesion) {
  const doc = new jsPDF()
  const nombre = sesion.candidato
    ? `${sesion.candidato.nombre} ${sesion.candidato.apellido}`
    : 'Evaluación anónima'
  const fecha = new Date(sesion.finalizada_en).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  const coloresRGB: Record<string, [number, number, number]> = {
    extraversion: [37, 99, 235],
    amabilidad: [22, 163, 74],
    responsabilidad: [147, 51, 234],
    neuroticismo: [220, 38, 38],
    apertura: [234, 88, 12]
  }

  const etiquetasPDF: Record<string, string> = {
    extraversion: 'Extraversión',
    amabilidad: 'Amabilidad',
    responsabilidad: 'Responsabilidad',
    neuroticismo: 'Neuroticismo',
    apertura: 'Apertura'
  }

  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, 210, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('PsicoPlataforma', 20, 15)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Informe de Evaluación Psicolaboral', 20, 25)

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(nombre, 20, 55)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  if (sesion.candidato?.email) {
    doc.text(`Email: ${sesion.candidato.email}`, 20, 63)
  }
  doc.text(`Fecha: ${fecha}`, 20, 70)
  doc.text('Instrumento: Big Five IPIP-NEO (30 ítems)', 20, 77)

  doc.setDrawColor(226, 232, 240)
  doc.line(20, 85, 190, 85)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Perfil de Personalidad', 20, 97)

  let y = 110
  if (sesion.puntaje_bruto) {
    Object.entries(sesion.puntaje_bruto).forEach(([factor, valor]) => {
      const rgb = coloresRGB[factor] || [37, 99, 235]
      const etiqueta = etiquetasPDF[factor] || factor
      const nivel = valor >= 4 ? 'Alto' : valor >= 3 ? 'Moderado' : 'Bajo'
      const porcentaje = (valor / 5) * 150

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text(etiqueta, 20, y)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(rgb[0], rgb[1], rgb[2])
      doc.text(`${nivel} (${valor}/5)`, 160, y)

      doc.setFillColor(226, 232, 240)
      doc.rect(20, y + 3, 150, 5, 'F')
      doc.setFillColor(rgb[0], rgb[1], rgb[2])
      doc.rect(20, y + 3, porcentaje, 5, 'F')

      const interp = interpretacion(factor, valor)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      const lineas = doc.splitTextToSize(interp, 170)
      doc.text(lineas, 20, y + 13)

      y += 13 + lineas.length * 5 + 10
    })
  }

  doc.setDrawColor(226, 232, 240)
  doc.line(20, y + 5, 190, y + 5)
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('PsicoPlataforma · seleccion@repúblicamicrofinanzas.com.uy · WhatsApp: 092 651 770', 20, y + 13)
  doc.text('Instrumento: IPIP-NEO Big Five · Dominio público · Baremación en construcción', 20, y + 19)

  doc.save(`informe-${nombre.replace(/ /g, '-').toLowerCase()}-${fecha.replace(/\//g, '-')}.pdf`)
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
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '1100px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' } as React.CSSProperties,
  subtitulo: { fontSize: '0.875rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  botonPrimario: { padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'none' } as React.CSSProperties,
  botonSecundario: { padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', textDecoration: 'none' } as React.CSSProperties,
  vacio: { textAlign: 'center' as const, padding: '3rem', color: '#64748b', fontSize: '0.875rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' } as React.CSSProperties,
  lista: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  tarjeta: { border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'border-color 0.15s ease', background: '#fff' } as React.CSSProperties,
  tarjetaEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' } as React.CSSProperties,
  tarjetaNombre: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' } as React.CSSProperties,
  tarjetaEmail: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' } as React.CSSProperties,
  tarjetaFecha: { fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  factoresMini: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  factorMiniRow: { display: 'flex', alignItems: 'center', gap: '8px' } as React.CSSProperties,
  factorMiniNombre: { fontSize: '11px', color: '#64748b', minWidth: '110px' } as React.CSSProperties,
  barraMini: { flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' } as React.CSSProperties,
  barraMiniRelleno: { height: '100%', borderRadius: '2px' } as React.CSSProperties,
  factorMiniValor: { fontSize: '11px', color: '#64748b', minWidth: '20px' } as React.CSSProperties,
  detalle: { border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff', alignSelf: 'flex-start' as const, position: 'sticky' as const, top: '1rem' } as React.CSSProperties,
  detalleEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } as React.CSSProperties,
  detalleTitulo: { fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: 0 } as React.CSSProperties,
  detalleEmail: { fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0' } as React.CSSProperties,
  cerrar: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem' } as React.CSSProperties,
  detalleInfo: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' } as React.CSSProperties,
  factorDetalle: { marginBottom: '1.25rem' } as React.CSSProperties,
  factorDetalleEncabezado: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' } as React.CSSProperties,
  factorDetalleNombre: { fontSize: '0.875rem', fontWeight: '500', color: '#1e293b' } as React.CSSProperties,
  factorDetalleValor: { fontSize: '0.875rem', fontWeight: '600' } as React.CSSProperties,
  barraGrande: { width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' } as React.CSSProperties,
  barraGrandeRelleno: { height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' } as React.CSSProperties,
  factorDescripcion: { fontSize: '0.75rem', color: '#64748b', lineHeight: '1.5', margin: 0 } as React.CSSProperties,
  botonPDF: {
    padding: '0.375rem 0.875rem',
    background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: '6px',
    fontSize: '0.75rem', cursor: 'pointer'
  } as React.CSSProperties,
}