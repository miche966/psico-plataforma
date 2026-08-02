'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function solicitarRecuperacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMensaje(''); setError('')
    if (!email.trim()) { setError('Ingresá tu email.'); return }
    setCargando(true)
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    if (recoveryError) setError('No se pudo enviar el correo de recuperación. Verificá el email e intentá nuevamente.')
    else setMensaje('Si el email está registrado, recibirás un enlace para crear una nueva contraseña.')
    setCargando(false)
  }

  return <main style={styles.fondo}><section style={styles.caja}>
    <h1 style={styles.titulo}>Recuperar contraseña</h1><p style={styles.descripcion}>Ingresá tu email y te enviaremos un enlace de recuperación.</p>
    <form onSubmit={solicitarRecuperacion} style={styles.formulario}><label style={styles.label} htmlFor="email">Email</label><input id="email" style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" required />
      {error && <p style={styles.error}>{error}</p>}{mensaje && <p style={styles.exito}>{mensaje}</p>}<button style={styles.boton} type="submit" disabled={cargando}>{cargando ? 'Enviando...' : 'Enviar enlace'}</button>
    </form><Link href="/login" style={styles.enlace}>Volver al inicio de sesión</Link>
  </section></main>
}

const styles = {
  fondo: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif' } as React.CSSProperties,
  caja: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '400px' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '700', color: '#1e293b', margin: '0 0 8px', textAlign: 'center' as const } as React.CSSProperties,
  descripcion: { color: '#64748b', fontSize: '0.875rem', lineHeight: 1.5, textAlign: 'center' as const, margin: '0 0 1.5rem' } as React.CSSProperties,
  formulario: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: '500', color: '#475569' } as React.CSSProperties,
  input: { padding: '0.625rem 0.875rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', outline: 'none', background: '#fff' } as React.CSSProperties,
  boton: { padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer', marginTop: '0.5rem' } as React.CSSProperties,
  error: { color: '#dc2626', fontSize: '0.8rem', margin: 0 } as React.CSSProperties,
  exito: { color: '#15803d', fontSize: '0.8rem', margin: 0 } as React.CSSProperties,
  enlace: { color: '#2563eb', fontSize: '0.8rem', textAlign: 'center' as const, textDecoration: 'none', display: 'block', marginTop: '1rem' } as React.CSSProperties,
}
