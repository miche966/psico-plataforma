'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Marco } from '@/components/candidato/Marco'
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

  return (
    <Marco titulo="Crear nueva contraseña" centrado>
      <div className="pp-acceso">
        <h1 className="pp-titulo">Crear nueva contraseña</h1>
        <p className="pp-lead">Elegí una contraseña segura para tu cuenta.</p>
        <form className="pp-formulario" onSubmit={actualizarPassword}>
          <div className="pp-campo">
            <label htmlFor="password">Nueva contraseña</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="pp-campo">
            <label htmlFor="confirmacion">Repetir contraseña</label>
            <input id="confirmacion" type="password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} autoComplete="new-password" required />
          </div>
          {error && <div className="pp-alerta" role="alert"><p>{error}</p></div>}
          {mensaje && <div className="pp-exito" role="status"><p>{mensaje}</p></div>}
          <button type="submit" className="pp-boton pp-boton-ancho" disabled={cargando}>{cargando ? 'Guardando…' : 'Guardar contraseña'}</button>
          <Link href="/login">Volver al inicio de sesión</Link>
        </form>
      </div>
    </Marco>
  )
}
