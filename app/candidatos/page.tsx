'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
  documento: string
  creado_en: string
}

export default function CandidatosPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    documento: ''
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarCandidatos()
  }, [])

  async function cargarCandidatos() {
    const { data, error } = await supabase
      .from('candidatos')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setCandidatos(data || [])
    setCargando(false)
  }

  async function guardarCandidato() {
    if (!form.nombre || !form.apellido || !form.email) return

    setGuardando(true)

    const { error } = await supabase
      .from('candidatos')
      .insert({
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        documento: form.documento
      })

    if (error) {
      console.error(error)
      setGuardando(false)
      return
    }

    setForm({ nombre: '', apellido: '', email: '', documento: '' })
    setMostrarForm(false)
    setGuardando(false)
    cargarCandidatos()
  }

  function copiarLink(candidatoId: string, test: string = 'bigfive') {
    const ruta = test === 'hexaco' ? '/hexaco' : '/test'
    const link = `${window.location.origin}${ruta}?candidato=${candidatoId}`
    navigator.clipboard.writeText(link)
    setLinkCopiado(candidatoId + test)
    setTimeout(() => setLinkCopiado(null), 2000)
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (cargando) {
    return <div style={s.centro}><p>Cargando candidatos...</p></div>
  }

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <h1 style={s.titulo}>Candidatos</h1>
          <p style={s.subtitulo}>{candidatos.length} candidato{candidatos.length !== 1 ? 's' : ''} registrado{candidatos.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={s.botonesEncabezado}>
          <a href="/panel" style={s.botonSecundario}>Ver panel</a>
          <button style={s.botonPrimario} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? 'Cancelar' : '+ Nuevo candidato'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div style={s.formulario}>
          <h2 style={s.formTitulo}>Nuevo candidato</h2>
          <div style={s.formGrid}>
            <div style={s.campo}>
              <label style={s.label}>Nombre *</label>
              <input
                style={s.input}
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Juan"
              />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Apellido *</label>
              <input
                style={s.input}
                value={form.apellido}
                onChange={e => setForm({ ...form, apellido: e.target.value })}
                placeholder="Pérez"
              />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Email *</label>
              <input
                style={s.input}
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="juan@email.com"
              />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Documento</label>
              <input
                style={s.input}
                value={form.documento}
                onChange={e => setForm({ ...form, documento: e.target.value })}
                placeholder="12345678"
              />
            </div>
          </div>
          <button
            style={{
              ...s.botonPrimario,
              opacity: guardando ? 0.6 : 1
            }}
            onClick={guardarCandidato}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar candidato'}
          </button>
        </div>
      )}

      {candidatos.length === 0 ? (
        <div style={s.vacio}>
          <p>No hay candidatos todavía.</p>
          <p>Creá el primero con el botón de arriba.</p>
        </div>
      ) : (
        <table style={s.tabla}>
          <thead>
            <tr>
              <th style={s.th}>Nombre</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Documento</th>
              <th style={s.th}>Registrado</th>
              <th style={s.th}>Link de evaluación</th>
            </tr>
          </thead>
          <tbody>
            {candidatos.map(candidato => (
              <tr key={candidato.id} style={s.tr}>
                <td style={s.td}>
                  {candidato.nombre} {candidato.apellido}
                </td>
                <td style={s.td}>{candidato.email}</td>
                <td style={s.td}>{candidato.documento || '—'}</td>
                <td style={s.td}>{formatearFecha(candidato.creado_en)}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      style={{
                        ...s.botonCopiar,
                        background: linkCopiado === candidato.id + 'bigfive' ? '#16a34a' : '#2563eb',
                      }}
                      onClick={() => copiarLink(candidato.id, 'bigfive')}
                    >
                      {linkCopiado === candidato.id + 'bigfive' ? '✓ Copiado' : 'Big Five'}
                    </button>
                    <button
                      style={{
                        ...s.botonCopiar,
                        background: linkCopiado === candidato.id + 'hexaco' ? '#16a34a' : '#0891b2',
                      }}
                      onClick={() => copiarLink(candidato.id, 'hexaco')}
                    >
                      {linkCopiado === candidato.id + 'hexaco' ? '✓ Copiado' : 'HEXACO'}
                    </button>
                    <button
                      style={{
                        ...s.botonCopiar,
                        background: linkCopiado === candidato.id + 'numerico' ? '#16a34a' : '#7c3aed',
                      }}
                      onClick={() => copiarLink(candidato.id, 'numerico')}
                    >
                      {linkCopiado === candidato.id + 'numerico' ? '✓ Copiado' : 'Numérico'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const s = {
  centro: {
    display: 'flex', justifyContent: 'center',
    alignItems: 'center', height: '100vh', fontFamily: 'sans-serif'
  } as React.CSSProperties,
  contenedor: {
    maxWidth: '1000px', margin: '0 auto',
    padding: '2rem', fontFamily: 'sans-serif'
  } as React.CSSProperties,
  encabezado: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '1.5rem'
  } as React.CSSProperties,
  titulo: {
    fontSize: '1.5rem', fontWeight: '600',
    color: '#1e293b', margin: '0 0 4px'
  } as React.CSSProperties,
  subtitulo: {
    fontSize: '0.875rem', color: '#64748b', margin: 0
  } as React.CSSProperties,
  botonesEncabezado: {
    display: 'flex', gap: '0.75rem', alignItems: 'center'
  } as React.CSSProperties,
  botonPrimario: {
    padding: '0.5rem 1rem', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '0.875rem',
    cursor: 'pointer'
  } as React.CSSProperties,
  botonSecundario: {
    padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569',
    border: '1px solid #e2e8f0', borderRadius: '8px',
    fontSize: '0.875rem', textDecoration: 'none'
  } as React.CSSProperties,
  formulario: {
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem'
  } as React.CSSProperties,
  formTitulo: {
    fontSize: '1rem', fontWeight: '600',
    color: '#1e293b', margin: '0 0 1rem'
  } as React.CSSProperties,
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '1rem', marginBottom: '1rem'
  } as React.CSSProperties,
  campo: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  label: { fontSize: '0.75rem', fontWeight: '500', color: '#475569' } as React.CSSProperties,
  input: {
    padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0',
    borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b',
    background: '#fff', outline: 'none'
  } as React.CSSProperties,
  vacio: {
    textAlign: 'center' as const, padding: '3rem',
    color: '#64748b', fontSize: '0.875rem'
  },
  tabla: {
    width: '100%', borderCollapse: 'collapse' as const,
    fontSize: '0.875rem'
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const, padding: '0.75rem 1rem',
    borderBottom: '2px solid #e2e8f0', color: '#475569',
    fontWeight: '500', fontSize: '0.75rem', textTransform: 'uppercase' as const
  } as React.CSSProperties,
  tr: { borderBottom: '1px solid #f1f5f9' } as React.CSSProperties,
  td: { padding: '0.875rem 1rem', color: '#1e293b' } as React.CSSProperties,
  botonCopiar: {
    padding: '0.375rem 0.75rem', color: '#fff',
    border: 'none', borderRadius: '6px', fontSize: '0.75rem',
    cursor: 'pointer', transition: 'background 0.2s ease'
  } as React.CSSProperties,
}
