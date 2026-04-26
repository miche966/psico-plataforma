'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function iniciarSesion() {
    if (!email || !password) {
      setError('Completá todos los campos.')
      return
    }

    setCargando(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError('Email o contraseña incorrectos.')
      setCargando(false)
      return
    }

    router.push('/panel')
  }

  return (
    <div style={s.fondo}>
      <div style={s.caja}>
        <div style={s.encabezado}>
          <h1 style={s.titulo}>PsicoPlataforma</h1>
          <p style={s.subtitulo}>Acceso evaluadores</p>
        </div>

        <div style={s.formulario}>
          <div style={s.campo}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              onKeyDown={e => e.key === 'Enter' && iniciarSesion()}
            />
          </div>

          <div style={s.campo}>
            <label style={s.label}>Contraseña</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && iniciarSesion()}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button
            style={{ ...s.boton, opacity: cargando ? 0.7 : 1 }}
            onClick={iniciarSesion}
            disabled={cargando}
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  fondo: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    fontFamily: 'sans-serif'
  } as React.CSSProperties,
  caja: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '400px'
  } as React.CSSProperties,
  encabezado: {
    textAlign: 'center' as const,
    marginBottom: '2rem'
  } as React.CSSProperties,
  titulo: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 4px'
  } as React.CSSProperties,
  subtitulo: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: 0
  } as React.CSSProperties,
  formulario: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem'
  } as React.CSSProperties,
  campo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px'
  } as React.CSSProperties,
  label: {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#475569'
  } as React.CSSProperties,
  input: {
    padding: '0.625rem 0.875rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.875rem',
    color: '#1e293b',
    outline: 'none',
    background: '#fff'
  } as React.CSSProperties,
  error: {
    fontSize: '0.8rem',
    color: '#dc2626',
    margin: 0,
    textAlign: 'center' as const
  } as React.CSSProperties,
  boton: {
    padding: '0.75rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '0.5rem'
  } as React.CSSProperties,
}