'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'

interface Pregunta {
  id: string
  orden: number
  pregunta: string
  tiempo_preparacion: number
  tiempo_respuesta: number
}

interface Entrevista {
  id: string
  nombre: string
  tiempo_respuesta: number
}

export default function CrearPreguntasPage() {
  const [entrevista, setEntrevista] = useState<Entrevista | null>(null)
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevaPregunta, setNuevaPregunta] = useState('')
  const [tiempoPrep, setTiempoPrep] = useState('30')
  const [tiempoResp, setTiempoResp] = useState('60')
  const [guardando, setGuardando] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const entrevistaId = searchParams.get('id')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    if (entrevistaId) {
      cargarDatos()
    }
  }, [entrevistaId])

  async function cargarDatos() {
    const { data: entrevistaData } = await supabase
      .from('entrevistas_video')
      .select('*')
      .eq('id', entrevistaId)
      .single()
    setEntrevista(entrevistaData)

    const { data: preguntasData } = await supabase
      .from('preguntas_video')
      .select('*')
      .eq('entrevista_id', entrevistaId)
      .order('orden')
    setPreguntas(preguntasData || [])
    setCargando(false)
  }

  async function agregarPregunta() {
    if (!nuevaPregunta.trim() || !entrevistaId) return
    setGuardando(true)
    const { error } = await supabase.from('preguntas_video').insert({
      entrevista_id: entrevistaId,
      orden: preguntas.length + 1,
      pregunta: nuevaPregunta.trim(),
      tiempo_preparacion: parseInt(tiempoPrep),
      tiempo_respuesta: parseInt(tiempoResp)
    })
    if (!error) {
      setNuevaPregunta('')
      cargarDatos()
    }
    setGuardando(false)
  }

  async function eliminarPregunta(id: string) {
    await supabase.from('preguntas_video').delete().eq('id', id)
    cargarDatos()
  }

  function copiarLink(candidatoId?: string) {
    const base = `${window.location.origin}/entrevista-video/responder?entrevista=${entrevistaId}`
    const url = candidatoId ? `${base}&candidato=${candidatoId}` : base
    navigator.clipboard.writeText(url)
    setLinkCopiado('copiado')
    setTimeout(() => setLinkCopiado(null), 2000)
  }

  if (cargando) return <div style={s.centro}><p>Cargando...</p></div>

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <a href="/entrevista-video" style={s.volver}>← Volver a entrevistas</a>
          <h1 style={s.titulo}>{entrevista?.nombre}</h1>
          <p style={s.subtitulo}>{preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''} configurada{preguntas.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          style={{ ...s.botonPrimario, background: linkCopiado ? '#16a34a' : '#2563eb' }}
          onClick={() => copiarLink()}
        >
          {linkCopiado ? '✓ Link copiado' : 'Copiar link de entrevista'}
        </button>
      </div>

      <div style={s.grid}>
        <div>
          <div style={s.seccionTitulo}>Preguntas configuradas</div>
          {preguntas.length === 0 ? (
            <div style={s.vacio}>
              <p>No hay preguntas todavía.</p>
              <p>Agregá la primera desde el formulario.</p>
            </div>
          ) : (
            <div style={s.listaPreguntas}>
              {preguntas.map((pregunta, index) => (
                <div key={pregunta.id} style={s.preguntaCard}>
                  <div style={s.preguntaNum}>{index + 1}</div>
                  <div style={s.preguntaContenido}>
                    <div style={s.preguntaTexto}>{pregunta.pregunta}</div>
                    <div style={s.preguntaMeta}>
                      Preparación: {pregunta.tiempo_preparacion}s · Respuesta: {pregunta.tiempo_respuesta}s
                    </div>
                  </div>
                  <button
                    style={s.botonEliminar}
                    onClick={() => eliminarPregunta(pregunta.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={s.seccionTitulo}>Agregar pregunta</div>
          <div style={s.formulario}>
            <div style={s.campo}>
              <label style={s.label}>Pregunta *</label>
              <textarea
                style={{ ...s.input, minHeight: '100px', resize: 'vertical' as const }}
                value={nuevaPregunta}
                onChange={e => setNuevaPregunta(e.target.value)}
                placeholder="Ej: Contanos sobre tu experiencia en atención al cliente y cómo manejaste una situación difícil."
              />
            </div>
            <div style={s.dosCols}>
              <div style={s.campo}>
                <label style={s.label}>Tiempo de preparación</label>
                <select style={s.input} value={tiempoPrep} onChange={e => setTiempoPrep(e.target.value)}>
                  <option value="15">15 segundos</option>
                  <option value="30">30 segundos</option>
                  <option value="60">1 minuto</option>
                </select>
              </div>
              <div style={s.campo}>
                <label style={s.label}>Tiempo de respuesta</label>
                <select style={s.input} value={tiempoResp} onChange={e => setTiempoResp(e.target.value)}>
                  <option value="30">30 segundos</option>
                  <option value="60">1 minuto</option>
                  <option value="90">1 min 30 seg</option>
                  <option value="120">2 minutos</option>
                </select>
              </div>
            </div>
            <button
              style={{ ...s.botonPrimario, width: '100%', opacity: guardando ? 0.7 : 1 }}
              onClick={agregarPregunta}
              disabled={guardando || !nuevaPregunta.trim()}
            >
              {guardando ? 'Guardando...' : '+ Agregar pregunta'}
            </button>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div style={s.seccionTitulo}>Vista previa del link</div>
            <div style={s.linkBox}>
              <div style={s.linkTexto}>
                {`${typeof window !== 'undefined' ? window.location.origin : ''}/entrevista-video/responder?entrevista=${entrevistaId}`}
              </div>
              <div style={s.linkNota}>
                Podés enviar este link directamente o ir a Candidatos para copiar un link personalizado por candidato.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '1000px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' } as React.CSSProperties,
  volver: { fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' } as React.CSSProperties,
  subtitulo: { fontSize: '0.875rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  botonPrimario: { padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' } as React.CSSProperties,
  seccionTitulo: { fontSize: '11px', fontWeight: '500', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.75rem' } as React.CSSProperties,
  vacio: { textAlign: 'center' as const, padding: '2rem', color: '#64748b', fontSize: '0.875rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' } as React.CSSProperties,
  listaPreguntas: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  preguntaCard: { display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.875rem' } as React.CSSProperties,
  preguntaNum: { display: 'inline-flex', width: '24px', height: '24px', borderRadius: '50%', background: '#E6F1FB', color: '#0C447C', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: 0 } as React.CSSProperties,
  preguntaContenido: { flex: 1 } as React.CSSProperties,
  preguntaTexto: { fontSize: '0.875rem', color: '#1e293b', lineHeight: '1.5', marginBottom: '4px' } as React.CSSProperties,
  preguntaMeta: { fontSize: '11px', color: '#94a3b8' } as React.CSSProperties,
  botonEliminar: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px', flexShrink: 0 } as React.CSSProperties,
  formulario: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' } as React.CSSProperties,
  campo: { display: 'flex', flexDirection: 'column' as const, gap: '4px', marginBottom: '0.75rem' } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: '500', color: '#475569' } as React.CSSProperties,
  input: { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: '#fff', outline: 'none', width: '100%' } as React.CSSProperties,
  dosCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } as React.CSSProperties,
  linkBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.875rem' } as React.CSSProperties,
  linkTexto: { fontSize: '11px', fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all' as const, marginBottom: '6px' } as React.CSSProperties,
  linkNota: { fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' } as React.CSSProperties,
}