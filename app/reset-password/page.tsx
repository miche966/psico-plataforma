'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState(''); const [confirmacion, setConfirmacion] = useState(''); const [mensaje, setMensaje] = useState(''); const [error, setError] = useState(''); const [cargando, setCargando] = useState(false); const [sesionLista, setSesionLista] = useState(false)

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(({ data }) => { if (activo && data.session) setSesionLista(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => { if (activo && (event === 'PASSWORD_RECOVERY' || session)) setSesionLista(true) })
    return () => { activo = false; listener.subscription.unsubscribe() }
  }, [])

  async function actualizarPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMensaje(''); setError('')
    if (!sesionLista) { setError('El enlace de recuperación no es válido o ya venció. Solicitá uno nuevo.'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (password !== confirmacion) { setError('Las contraseñas no coinciden.'); return }
    setCargando(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError('No se pudo actualizar la contraseña. Solicitá un enlace nuevo e intentá nuevamente.')
    else { setMensaje('Contraseña actualizada correctamente. Ya podés iniciar sesión.'); setPassword(''); setConfirmacion('') }
    setCargando(false)
  }

  return <main style={styles.fondo}><section style={styles.caja}>
    <h1 style={styles.titulo}>Crear nueva contraseña</h1><p style={styles.descripcion}>Elegí una contraseña segura para tu cuenta.</p>
    <form onSubmit={actualizarPassword} style={styles.formulario}><label style={styles.label} htmlFor="password">Nueva contraseña</label><input id="password" style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required /><label style={styles.label} htmlFor="confirmacion">Repetir contraseña</label><input id="confirmacion" style={styles.input} type="password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} autoComplete="new-password" required />
      {error && <p style={styles.error}>{error}</p>}{mensaje && <p style={styles.exito}>{mensaje}</p>}<button style={styles.boton} type="submit" disabled={cargando}>{cargando ? 'Guardando...' : 'Guardar contraseña'}</button>
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
