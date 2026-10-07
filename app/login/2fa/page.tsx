'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Marco } from '@/components/candidato/Marco'
import { PantallaCarga } from '@/components/candidato/Estados'

interface Factor { id: string; friendly_name?: string }

// Segundo paso del ingreso: codigo de la app autenticadora. Independiente del panel (no usa AppLayout).
export default function Login2faPage() {
  const router = useRouter()
  const [factores, setFactores] = useState<Factor[]>([])
  const [factorId, setFactorId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    let vivo = true
    async function iniciar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal2') { router.replace('/panel'); return }
      const { data } = await supabase.auth.mfa.listFactors()
      const verificados = (data?.totp || []) as Factor[]
      if (!vivo) return
      // Sin dispositivo enrolado no hay codigo que pedir: se lo lleva a darlo de alta
      if (verificados.length === 0) { router.replace('/seguridad'); return }
      setFactores(verificados)
      setFactorId(verificados[0].id)
      setCargando(false)
    }
    iniciar()
    return () => { vivo = false }
  }, [router])

  async function verificar() {
    if (codigo.length !== 6 || !factorId) return
    setVerificando(true); setError('')
    const { error: errVerify } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo })
    if (errVerify) {
      setError('El código no es correcto o venció. Probá con el código nuevo de la app.')
      setCodigo(''); setVerificando(false)
      return
    }
    router.push('/panel')
  }

  async function volver() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (cargando) return <PantallaCarga texto="Cargando…" />

  return (
    <Marco titulo="Verificación en dos pasos" centrado>
      <div className="pp-acceso">
        <h1 className="pp-titulo">Verificación en dos pasos</h1>
        <p className="pp-lead">Ingresá el código de 6 dígitos de tu app autenticadora.</p>
        <form className="pp-formulario" onSubmit={e => { e.preventDefault(); verificar() }}>
          {factores.length > 1 && (
            <div className="pp-campo">
              <label htmlFor="dispositivo">Dispositivo</label>
              <select id="dispositivo" value={factorId} onChange={e => setFactorId(e.target.value)}>
                {factores.map(f => <option key={f.id} value={f.id}>{f.friendly_name || 'Dispositivo'}</option>)}
              </select>
            </div>
          )}
          <div className="pp-campo">
            <label htmlFor="codigo">Código</label>
            <input id="codigo" className="pp-codigo" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
          </div>
          {error && <div className="pp-alerta" role="alert"><p>{error}</p></div>}
          <button type="submit" className="pp-boton pp-boton-ancho" disabled={verificando || codigo.length !== 6}>{verificando ? 'Verificando…' : 'Verificar'}</button>
          <button type="button" className="pp-enlace" onClick={volver}>Volver al inicio de sesión</button>
        </form>
      </div>
    </Marco>
  )
}
