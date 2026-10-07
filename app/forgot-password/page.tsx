'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { Marco } from '@/components/candidato/Marco'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function solicitarRecuperacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMensaje(''); setError('')
    if (!email.trim()) { setError('Ingresá tu email.'); return }
    setCargando(true)
    // Pasa por el servidor para poder limitar los intentos (por IP y por email)
    const respuesta = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) }).catch(() => null)
    const datos = respuesta ? await respuesta.json().catch(() => ({})) : {}
    if (respuesta?.ok) setMensaje('Si el email está registrado, recibirás un enlace para crear una nueva contraseña.')
    else if (respuesta?.status === 429) setError(datos.error || 'Demasiados intentos. Esperá un rato e intentá de nuevo.')
    else setError('No se pudo enviar el correo de recuperación. Verificá el email e intentá nuevamente.')
    setCargando(false)
  }

  return (
    <Marco titulo="Recuperar contraseña" centrado>
      <div className="pp-acceso">
        <h1 className="pp-titulo">Recuperar contraseña</h1>
        <p className="pp-lead">Ingresá tu email y te enviaremos un enlace de recuperación.</p>
        <form className="pp-formulario" onSubmit={solicitarRecuperacion}>
          <div className="pp-campo">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" required />
          </div>
          {error && <div className="pp-alerta" role="alert"><p>{error}</p></div>}
          {mensaje && <div className="pp-exito" role="status"><p>{mensaje}</p></div>}
          <button type="submit" className="pp-boton pp-boton-ancho" disabled={cargando}>{cargando ? 'Enviando…' : 'Enviar enlace'}</button>
          <Link href="/login">Volver al inicio de sesión</Link>
        </form>
      </div>
    </Marco>
  )
}
