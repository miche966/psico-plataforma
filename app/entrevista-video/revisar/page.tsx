'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'

interface Pregunta {
  id: string
  orden: number
  pregunta: string
  tiempo_respuesta: number
}

interface RespuestaVideo {
  id: string
  pregunta_id: string
  candidato_id: string | null
  url_video: string | null
  estado: string
  grabada_en: string
  candidato?: { nombre: string, apellido: string, email: string }
}

interface Entrevista {
  id: string
  nombre: string
}

export default function RevisarPage() {
  const [entrevista, setEntrevista] = useState<Entrevista | null>(null)
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [respuestas, setRespuestas] = useState<RespuestaVideo[]>([])
  const [cargando, setCargando] = useState(true)
  const [preguntaSeleccionada, setPreguntaSeleccionada] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const entrevistaId = searchParams.get('id')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    if (entrevistaId) cargarDatos()
  }, [entrevistaId])

  async function cargarDatos() {
    const { data: entrevistaData } = await supabase
      .from('entrevistas_video').select('*').eq('id', entrevistaId).single()
    setEntrevista(entrevistaData)

    const { data: preguntasData } = await supabase
      .from('preguntas_video').select('*')
      .eq('entrevista_id', entrevistaId).order('orden')
    setPreguntas(preguntasData || [])

    const { data: respuestasData } = await supabase
      .from('respuestas_video').select('*')
      .eq('entrevista_id', entrevistaId)
      .order('grabada_en', { ascending: false })

    const candidatoIds = respuestasData?.filter(r => r.candidato_id).map(r => r.candidato_id) || []
    let candidatos: { id: string, nombre: string, apellido: string, email: string }[] = []
    if (candidatoIds.length > 0) {
      const { data } = await supabase.from('candidatos')
        .select('id, nombre, apellido, email').in('id', candidatoIds)
      candidatos = data || []
    }

    const respuestasConCandidato = respuestasData?.map(r => ({
      ...r,
      candidato: candidatos.find(c => c.id === r.candidato_id)
    })) || []

    setRespuestas(respuestasConCandidato)
    if (preguntasData && preguntasData.length > 0) {
      setPreguntaSeleccionada(preguntasData[0].id)
    }
    setCargando(false)
  }

  function nombreCandidato(respuesta: RespuestaVideo) {
    return respuesta.candidato
      ? `${respuesta.candidato.nombre} ${respuesta.candidato.apellido}`
      : 'Candidato anónimo'
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const respuestasFiltradas = respuestas.filter(r => r.pregunta_id === preguntaSeleccionada)

  if (cargando) return <div style={s.centro}><p>Cargando...</p></div>

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <a href="/entrevista-video" style={s.volver}>← Volver a entrevistas</a>
          <h1 style={s.titulo}>{entrevista?.nombre}</h1>
          <p style={s.subtitulo}>{respuestas.length} respuesta{respuestas.length !== 1 ? 's' : ''} recibida{respuestas.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {preguntas.length === 0 ? (
        <div style={s.vacio}><p>No hay preguntas configuradas en esta entrevista.</p></div>
      ) : (
        <div style={s.grid}>
          <div>
            <div style={s.seccionTitulo}>Preguntas</div>
            <div style={s.listaPreguntas}>
              {preguntas.map(pregunta => {
                const cantRespuestas = respuestas.filter(r => r.pregunta_id === pregunta.id).length
                return (
                  <div
                    key={pregunta.id}
                    style={{
                      ...s.preguntaItem,
                      borderColor: preguntaSeleccionada === pregunta.id ? '#2563eb' : '#e2e8f0',
                      background: preguntaSeleccionada === pregunta.id ? '#E6F1FB' : '#fff'
                    }}
                    onClick={() => setPreguntaSeleccionada(pregunta.id)}
                  >
                    <div style={s.preguntaNum}>{pregunta.orden}</div>
                    <div style={{ flex: 1 }}>
                      <div style={s.preguntaTexto}>{pregunta.pregunta}</div>
                      <div style={s.preguntaMeta}>{cantRespuestas} respuesta{cantRespuestas !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div style={s.seccionTitulo}>
              Respuestas — {preguntas.find(p => p.id === preguntaSeleccionada)?.pregunta?.substring(0, 50)}...
            </div>
            {respuestasFiltradas.length === 0 ? (
              <div style={s.vacio}><p>No hay respuestas para esta pregunta todavía.</p></div>
            ) : (
              <div style={s.listaRespuestas}>
                {respuestasFiltradas.map(respuesta => (
                  <div key={respuesta.id} style={s.respuestaCard}>
                    <div style={s.respuestaEncabezado}>
                      <div>
                        <div style={s.candidatoNombre}>{nombreCandidato(respuesta)}</div>
                        {respuesta.candidato && (
                          <div style={s.candidatoEmail}>{respuesta.candidato.email}</div>
                        )}
                        <div style={s.respuestaFecha}>{formatearFecha(respuesta.grabada_en)}</div>
                      </div>
                      <span style={{
                        ...s.estadoBadge,
                        background: respuesta.estado === 'completado' ? '#dcfce7' : '#f1f5f9',
                        color: respuesta.estado === 'completado' ? '#16a34a' : '#64748b'
                      }}>
                        {respuesta.estado === 'completado' ? 'Con video' : 'Sin video'}
                      </span>
                    </div>
                    {respuesta.url_video ? (
                      <video
                        controls
                        style={s.videoPlayer}
                        src={respuesta.url_video}
                      />
                    ) : (
                      <div style={s.sinVideo}>
                        Video no disponible
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '1100px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { marginBottom: '1.5rem' } as React.CSSProperties,
  volver: { fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' } as React.CSSProperties,
  subtitulo: { fontSize: '0.875rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  vacio: { textAlign: 'center' as const, padding: '2rem', color: '#64748b', fontSize: '0.875rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' } as React.CSSProperties,
  seccionTitulo: { fontSize: '11px', fontWeight: '500', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.75rem' } as React.CSSProperties,
  listaPreguntas: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' } as React.CSSProperties,
  preguntaItem: { display: 'flex', gap: '10px', alignItems: 'flex-start', border: '1.5px solid', borderRadius: '10px', padding: '0.875rem', cursor: 'pointer', transition: 'all 0.15s' } as React.CSSProperties,
  preguntaNum: { display: 'inline-flex', width: '22px', height: '22px', borderRadius: '50%', background: '#e2e8f0', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: 0 } as React.CSSProperties,
  preguntaTexto: { fontSize: '0.8rem', color: '#1e293b', lineHeight: '1.5', marginBottom: '2px' } as React.CSSProperties,
  preguntaMeta: { fontSize: '11px', color: '#94a3b8' } as React.CSSProperties,
  listaRespuestas: { display: 'flex', flexDirection: 'column' as const, gap: '1rem' } as React.CSSProperties,
  respuestaCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', overflow: 'hidden' } as React.CSSProperties,
  respuestaEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' } as React.CSSProperties,
  candidatoNombre: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' } as React.CSSProperties,
  candidatoEmail: { fontSize: '0.75rem', color: '#94a3b8' } as React.CSSProperties,
  respuestaFecha: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' } as React.CSSProperties,
  estadoBadge: { fontSize: '10px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  videoPlayer: { width: '100%', borderRadius: '8px', background: '#1e293b' } as React.CSSProperties,
  sinVideo: { background: '#f1f5f9', borderRadius: '8px', padding: '2rem', textAlign: 'center' as const, color: '#94a3b8', fontSize: '0.875rem' } as React.CSSProperties,
}