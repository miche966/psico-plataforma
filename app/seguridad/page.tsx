'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Factor { id: string; friendly_name?: string; status: string; created_at?: string }
interface Enrolando { factorId: string; qr: string; secret: string }

// Verificacion en dos pasos (app autenticadora). Pagina independiente del panel (no usa AppLayout) a proposito:
// tiene que funcionar tambien para una cuenta que todavia no tiene el 2FA y el panel se lo exige.
export default function SeguridadPage() {
  const router = useRouter()
  const [factores, setFactores] = useState<Factor[]>([])
  const [nivel, setNivel] = useState<string>('')
  const [cargando, setCargando] = useState(true)
  const [nombre, setNombre] = useState('')
  const [enrolando, setEnrolando] = useState<Enrolando | null>(null)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const [{ data: lista }, { data: aal }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    setFactores(((lista?.all || []) as any[]).filter(f => f.factor_type === 'totp') as Factor[])
    setNivel(aal?.currentLevel || '')
    setCargando(false)
  }, [router])

  useEffect(() => { cargar() }, [cargar])

  const verificados = factores.filter(f => f.status === 'verified')

  async function empezar() {
    setError(''); setMensaje(''); setOcupado(true)
    try {
      // Un intento anterior sin terminar deja un factor "unverified" que bloquea volver a enrolar con ese nombre
      for (const f of factores.filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
      const base = nombre.trim() || (verificados.length === 0 ? 'Teléfono' : 'Respaldo')
      const usados = new Set(verificados.map(f => f.friendly_name))
      let nombreFinal = base
      for (let n = 2; usados.has(nombreFinal); n++) nombreFinal = `${base} ${n}`
      const { data, error: errEnroll } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: nombreFinal, issuer: 'PsicoPlataforma' })
      if (errEnroll || !data) throw errEnroll || new Error('sin datos')
      setEnrolando({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
      setCodigo('')
    } catch (e: any) {
      setError(`No se pudo iniciar el alta del dispositivo. ${e?.message || ''}`.trim())
    } finally {
      setOcupado(false)
      cargar()
    }
  }

  async function confirmar() {
    if (!enrolando) return
    setError(''); setMensaje(''); setOcupado(true)
    const { error: errVerify } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolando.factorId, code: codigo.trim() })
    setOcupado(false)
    if (errVerify) { setError('El código no es correcto. Revisá la hora del teléfono y probá con el código nuevo.'); return }
    setEnrolando(null); setCodigo(''); setNombre('')
    setMensaje('Dispositivo agregado. A partir de ahora vas a necesitar el código de la app cada vez que ingreses.')
    cargar()
  }

  async function cancelar() {
    if (enrolando) await supabase.auth.mfa.unenroll({ factorId: enrolando.factorId })
    setEnrolando(null); setCodigo(''); setError('')
    cargar()
  }

  async function quitar(f: Factor) {
    if (!confirm(`¿Quitar el dispositivo "${f.friendly_name || 'sin nombre'}"? Ya no podrás usarlo para ingresar.`)) return
    setError(''); setMensaje(''); setOcupado(true)
    const { error: errQuitar } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    setOcupado(false)
    if (errQuitar) {
      setError(nivel === 'aal2' ? 'No se pudo quitar el dispositivo.' : 'Para quitar un dispositivo primero tenés que verificar tu código (cerrá sesión e ingresá de nuevo con el código).')
      return
    }
    setMensaje('Dispositivo quitado.')
    cargar()
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (cargando) return <div style={s.fondo}><p style={s.texto}>Cargando...</p></div>

  return (
    <div style={s.fondo}>
      <div style={s.caja}>
        <h1 style={s.titulo}>Seguridad de la cuenta</h1>
        <p style={s.texto}>Verificación en dos pasos con una app autenticadora (Google Authenticator, Microsoft Authenticator, Authy, etc.). Además de la contraseña, se pide un código de 6 dígitos que cambia cada 30 segundos.</p>

        <div style={s.aviso}>
          <strong>Agregá al menos dos dispositivos</strong> (por ejemplo tu teléfono y otro de respaldo). No hay códigos de recuperación: si perdés el único dispositivo, otra persona con acceso de administrador tiene que restablecerte el 2FA.
        </div>

        <h2 style={s.subtitulo}>Dispositivos</h2>
        {verificados.length === 0 ? (
          <p style={s.texto}>Todavía no agregaste ningún dispositivo.</p>
        ) : (
          <ul style={s.lista}>
            {verificados.map(f => (
              <li key={f.id} style={s.fila}>
                <span>{f.friendly_name || 'Sin nombre'}{f.created_at ? <span style={s.chico}> · {new Date(f.created_at).toLocaleDateString('es-UY')}</span> : null}</span>
                <button style={s.botonLink} onClick={() => quitar(f)} disabled={ocupado}>Quitar</button>
              </li>
            ))}
          </ul>
        )}

        {enrolando ? (
          <div style={s.panel}>
            <p style={s.texto}><strong>1.</strong> Escaneá este código QR con la app autenticadora:</p>
            <img src={enrolando.qr} alt="Código QR para la app autenticadora" style={{ width: 180, height: 180, alignSelf: 'center' }} />
            <p style={s.chico}>¿No podés escanearlo? Ingresá esta clave a mano: <code style={s.codigo}>{enrolando.secret}</code></p>
            <p style={s.texto}><strong>2.</strong> Escribí el código de 6 dígitos que muestra la app:</p>
            <input aria-label="Código de 6 dígitos de la app autenticadora" style={s.input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} placeholder="000000" onKeyDown={e => e.key === 'Enter' && codigo.length === 6 && confirmar()} />
            <div style={s.botones}>
              <button style={s.boton} onClick={confirmar} disabled={ocupado || codigo.length !== 6}>Confirmar dispositivo</button>
              <button style={s.botonSecundario} onClick={cancelar} disabled={ocupado}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={s.panel}>
            <label htmlFor="seguridad-nombre-dispositivo" style={s.label}>Nombre del dispositivo (opcional)</label>
            <input id="seguridad-nombre-dispositivo" style={s.input} value={nombre} onChange={e => setNombre(e.target.value)} placeholder={verificados.length === 0 ? 'Teléfono' : 'Respaldo'} maxLength={30} />
            <button style={s.boton} onClick={empezar} disabled={ocupado}>{verificados.length === 0 ? 'Activar verificación en dos pasos' : 'Agregar otro dispositivo'}</button>
          </div>
        )}

        {error && <p style={s.error}>{error}</p>}
        {mensaje && <p style={s.exito}>{mensaje}</p>}

        <div style={s.pie}>
          <Link href="/panel" style={s.enlace}>Ir al panel</Link>
          <button style={s.botonLink} onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  fondo: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'sans-serif', padding: '1rem' } as React.CSSProperties,
  caja: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  titulo: { fontSize: '1.4rem', fontWeight: '700', color: '#1e293b', margin: 0 } as React.CSSProperties,
  subtitulo: { fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: '0.5rem 0 0' } as React.CSSProperties,
  texto: { fontSize: '0.85rem', color: '#475569', margin: 0, lineHeight: 1.5 } as React.CSSProperties,
  chico: { fontSize: '0.75rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  aviso: { fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.6rem 0.75rem', lineHeight: 1.45 } as React.CSSProperties,
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' } as React.CSSProperties,
  fila: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 0.75rem' } as React.CSSProperties,
  panel: { display: 'flex', flexDirection: 'column' as const, gap: '0.6rem', marginTop: '0.5rem' } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: '500', color: '#475569' } as React.CSSProperties,
  input: { padding: '0.625rem 0.875rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', color: '#1e293b', outline: 'none', background: '#fff', letterSpacing: '0.05em' } as React.CSSProperties,
  codigo: { background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' as const } as React.CSSProperties,
  botones: { display: 'flex', gap: '0.5rem' } as React.CSSProperties,
  boton: { padding: '0.7rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' } as React.CSSProperties,
  botonSecundario: { padding: '0.7rem 1rem', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer' } as React.CSSProperties,
  botonLink: { background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', padding: 0 } as React.CSSProperties,
  enlace: { color: '#2563eb', fontSize: '0.8rem', textDecoration: 'none' } as React.CSSProperties,
  pie: { display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' } as React.CSSProperties,
  error: { fontSize: '0.8rem', color: '#dc2626', margin: 0 } as React.CSSProperties,
  exito: { fontSize: '0.8rem', color: '#15803d', margin: 0 } as React.CSSProperties,
}
