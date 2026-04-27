'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Entrevista {
  id: string
  nombre: string
  descripcion: string
  tiempo_respuesta: number
  activa: boolean
  creada_en: string
  proceso_id: string | null
}

export default function EntrevistaVideoPage() {
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nombre: '', descripcion: '', tiempo_respuesta: '60' })
  const [guardando, setGuardando] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarEntrevistas()
  }, [])

  async function cargarEntrevistas() {
    const { data } = await supabase
      .from('entrevistas_video')
      .select('*')
      .order('creada_en', { ascending: false })
    setEntrevistas(data || [])
    setCargando(false)
  }

  async function guardarEntrevista() {
    if (!form.nombre) return
    setGuardando(true)
    const { error } = await supabase.from('entrevistas_video').insert({
      nombre: form.nombre,
      descripcion: form.descripcion,
      tiempo_respuesta: parseInt(form.tiempo_respuesta),
      activa: true
    })
    if (!error) {
      setForm({ nombre: '', descripcion: '', tiempo_respuesta: '60' })
      setMostrarForm(false)
      cargarEntrevistas()
    }
    setGuardando(false)
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  if (cargando) return <div style={s.centro}><p>Cargando...</p></div>

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <h1 style={s.titulo}>Entrevistas en Video</h1>
          <p style={s.subtitulo}>{entrevistas.length} entrevista{entrevistas.length !== 1 ? 's' : ''} creada{entrevistas.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/panel" style={s.botonSecundario}>← Panel</a>
          <button style={s.botonPrimario} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? 'Cancelar' : '+ Nueva entrevista'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div style={s.formulario}>
          <h2 style={s.formTitulo}>Nueva entrevista en video</h2>
          <div style={s.campo}>
            <label style={s.label}>Nombre de la entrevista *</label>
            <input
              style={s.input}
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Entrevista Asesor de Crédito Q2 2026"
            />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Descripción</label>
            <input
              style={s.input}
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción opcional"
            />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Tiempo máximo de respuesta por pregunta</label>
            <select
              style={s.input}
              value={form.tiempo_respuesta}
              onChange={e => setForm({ ...form, tiempo_respuesta: e.target.value })}
            >
              <option value="30">30 segundos</option>
              <option value="60">1 minuto</option>
              <option value="90">1 minuto 30 segundos</option>
              <option value="120">2 minutos</option>
            </select>
          </div>
          <button
            style={{ ...s.botonPrimario, opacity: guardando ? 0.7 : 1 }}
            onClick={guardarEntrevista}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Crear entrevista'}
          </button>
        </div>
      )}

      {entrevistas.length === 0 ? (
        <div style={s.vacio}>
          <p>No hay entrevistas creadas todavía.</p>
          <p>Creá la primera con el botón de arriba.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {entrevistas.map(entrevista => (
            <div key={entrevista.id} style={s.tarjeta}>
              <div style={s.tarjetaEncabezado}>
                <div>
                  <div style={s.tarjetaNombre}>{entrevista.nombre}</div>
                  {entrevista.descripcion && (
                    <div style={s.tarjetaDesc}>{entrevista.descripcion}</div>
                  )}
                </div>
                <span style={{
                  ...s.estadoBadge,
                  background: entrevista.activa ? '#dcfce7' : '#f1f5f9',
                  color: entrevista.activa ? '#16a34a' : '#64748b'
                }}>
                  {entrevista.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <div style={s.tarjetaMeta}>
                <span>Tiempo por respuesta: {entrevista.tiempo_respuesta}s</span>
                <span>Creada: {formatearFecha(entrevista.creada_en)}</span>
              </div>
              <div style={s.tarjetaAcciones}>
                <a
                  href={`/entrevista-video/crear?id=${entrevista.id}`}
                  style={s.botonAccion}
                >
                  Gestionar preguntas
                </a>
                <a
                  href={`/entrevista-video/revisar?id=${entrevista.id}`}
                  style={{ ...s.botonAccion, background: '#f1f5f9', color: '#475569' }}
                >
                  Ver respuestas
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '900px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' } as React.CSSProperties,
  subtitulo: { fontSize: '0.875rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  botonPrimario: { padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer' } as React.CSSProperties,
  botonSecundario: { padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', textDecoration: 'none' } as React.CSSProperties,
  formulario: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' } as React.CSSProperties,
  formTitulo: { fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: '0 0 1rem' } as React.CSSProperties,
  campo: { display: 'flex', flexDirection: 'column' as const, gap: '4px', marginBottom: '0.75rem' } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: '500', color: '#475569' } as React.CSSProperties,
  input: { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: '#fff', outline: 'none' } as React.CSSProperties,
  vacio: { textAlign: 'center' as const, padding: '3rem', color: '#64748b', fontSize: '0.875rem' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } as React.CSSProperties,
  tarjeta: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' } as React.CSSProperties,
  tarjetaEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' } as React.CSSProperties,
  tarjetaNombre: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b', marginBottom: '2px' } as React.CSSProperties,
  tarjetaDesc: { fontSize: '0.75rem', color: '#64748b' } as React.CSSProperties,
  estadoBadge: { fontSize: '10px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  tarjetaMeta: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '0.75rem' } as React.CSSProperties,
  tarjetaAcciones: { display: 'flex', gap: '6px' } as React.CSSProperties,
  botonAccion: { flex: 1, padding: '0.5rem', background: '#2563eb', color: '#fff', borderRadius: '6px', fontSize: '0.75rem', textDecoration: 'none', textAlign: 'center' as const } as React.CSSProperties,
}