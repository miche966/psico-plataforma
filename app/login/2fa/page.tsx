'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

  if (cargando) return <div style={s.fondo}><p style={s.texto}>Cargando...</p></div>

  return (
    <div style={s.fondo}>
      <div style={s.caja}>
        <h1 style={s.titulo}>Verificación en dos pasos</h1>
        <p style={s.texto}>Ingresá el código de 6 dígitos de tu app autenticadora.</p>
        {factores.length > 1 && (
          <select style={s.input} value={factorId} onChange={e => setFactorId(e.target.value)}>
            {factores.map(f => <option key={f.id} value={f.id}>{f.friendly_name || 'Dispositivo'}</option>)}
          </select>
        )}
        <input style={s.input} inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="000000" onKeyDown={e => e.key === 'Enter' && verificar()} />
        {error && <p style={s.error}>{error}</p>}
        <button style={{ ...s.boton, opacity: verificando || codigo.length !== 6 ? 0.7 : 1 }} onClick={verificar} disabled={verificando || codigo.length !== 6}>{verificando ? 'Verificando...' : 'Verificar'}</button>
        <button style={s.botonLink} onClick={volver}>Volver al inicio de sesión</button>
      </div>
    </div>
  )
}

const s = {
  fondo: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif', padding: '1rem' } as React.CSSProperties,
  caja: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column' as const, gap: '1rem' } as React.CSSProperties,
  titulo: { fontSize: '1.4rem', fontWeight: '700', color: '#1e293b', margin: 0, textAlign: 'center' as const } as React.CSSProperties,
  texto: { fontSize: '0.85rem', color: '#475569', margin: 0, textAlign: 'center' as const, lineHeight: 1.5 } as React.CSSProperties,
  input: { padding: '0.75rem 0.875rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1.2rem', color: '#1e293b', outline: 'none', background: '#fff', textAlign: 'center' as const, letterSpacing: '0.3em' } as React.CSSProperties,
  boton: { padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' } as React.CSSProperties,
  botonLink: { background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', padding: 0 } as React.CSSProperties,
  error: { fontSize: '0.8rem', color: '#dc2626', margin: 0, textAlign: 'center' as const } as React.CSSProperties,
}
