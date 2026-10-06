'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Marco } from '@/components/candidato/Marco'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function iniciarSesion() {
    if (!email || !password) { setError('Completá todos los campos.'); return }
    setCargando(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.session) {
      setError(data.error || 'Email o contraseña incorrectos.')
      setCargando(false)
      return
    }
    await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
    // Si la cuenta tiene un dispositivo 2FA, la sesion recien iniciada (solo contrasena) todavia tiene que verificar el codigo
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    router.push(aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2' ? '/login/2fa' : '/panel')
  }

  return (
    <Marco titulo="Acceso de evaluadores">
      <div className="pp-acceso">
        <h1 className="pp-titulo">Acceso de evaluadores</h1>
        <p className="pp-lead">Ingresá con tu cuenta para ver las evaluaciones y los informes.</p>
        <form className="pp-formulario" onSubmit={e => { e.preventDefault(); iniciarSesion() }}>
          <div className="pp-campo">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
          </div>
          <div className="pp-campo">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tu contraseña" />
          </div>
          {error && <div className="pp-alerta" role="alert"><p>{error}</p></div>}
          <button type="submit" className="pp-boton pp-boton-ancho" disabled={cargando}>{cargando ? 'Ingresando…' : 'Ingresar'}</button>
          <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
        </form>
      </div>
    </Marco>
  )
}
