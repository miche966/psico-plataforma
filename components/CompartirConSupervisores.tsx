'use client'

import { useCallback, useEffect, useState } from 'react'
import { getAdminHeaders } from '@/lib/evaluacionLink'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'

interface Proceso { id: string; nombre: string; cargo: string }
interface Supervisor { email: string; nombre: string; activo: boolean }
interface Habilitacion { supervisor_email: string; proceso_id: string }

const SERIF = 'var(--font-lectura), Georgia, serif'

const estilos = {
  card: { background: 'var(--white-bg)', borderRadius: '12px', marginBottom: '1.75rem', overflow: 'hidden', border: '1px solid var(--slate-200)' },
  cabecera: { padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--slate-200)' },
  titulo: { fontFamily: SERIF, fontWeight: 600, color: 'var(--slate-900)', fontSize: '1.2rem', margin: 0 },
  cuerpo: { padding: '1.25rem' },
  ayuda: { fontSize: '0.9rem', color: 'var(--slate-500)', margin: '0 0 1rem' },
  fila: { display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0', borderTop: '1px solid var(--slate-100)' },
  select: { padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--slate-300)', background: 'var(--white-bg)', color: 'var(--slate-800)', fontSize: '0.95rem' },
  boton: { padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', background: 'var(--white-bg)', color: 'var(--slate-700)', border: '1px solid var(--slate-300)' },
  quitar: { background: 'none', border: 'none', color: 'var(--rose-600, #be123c)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' },
}

/**
 * Con que supervisores se comparte una persona (ver docs/PLAN_SUPERVISORES.md). Solo el administrador completo lo ve:
 * elegir supervisor y proceso, y quitar a quien ya tiene acceso. El supervisor ve las videoentrevistas de ese proceso y,
 * cuando se publique, el informe para supervisores; nunca el dictamen.
 */
export default function CompartirConSupervisores({ candidatoId }: { candidatoId: string }) {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [habilitaciones, setHabilitaciones] = useState<Habilitacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [email, setEmail] = useState('')
  const [procesoId, setProcesoId] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/supervisor-evaluados?candidato_id=' + encodeURIComponent(candidatoId), { headers: await getAdminHeaders(), cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar con quién se comparte esta persona')
      setProcesos(data.procesos || [])
      setSupervisores(data.supervisores || [])
      setHabilitaciones(data.habilitaciones || [])
      setProcesoId(actual => actual || data.procesos?.[0]?.id || '')
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setCargando(false)
    }
  }, [candidatoId])

  useEffect(() => { cargar() }, [cargar])

  async function enviar(accion: 'habilitar' | 'quitar', emailSupervisor: string, proceso: string) {
    const res = await fetch('/api/admin/supervisor-evaluados', {
      method: 'POST',
      headers: await getAdminHeaders(),
      body: JSON.stringify({ accion, email: emailSupervisor, candidato_id: candidatoId, proceso_id: proceso }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación')
  }

  async function compartir() {
    setMensaje(null)
    if (!email || !procesoId) { setMensaje({ tipo: 'error', texto: 'Elegí un supervisor y un proceso.' }); return }
    setOcupado(true)
    try {
      await enviar('habilitar', email, procesoId)
      setMensaje({ tipo: 'ok', texto: 'Listo: el supervisor ya puede ver a esta persona en ese proceso.' })
      setEmail('')
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setOcupado(false)
    }
  }

  async function quitar(h: Habilitacion) {
    const nombre = supervisores.find(s => s.email === h.supervisor_email)?.nombre || h.supervisor_email
    if (!confirm(`¿Dejar de compartir a esta persona con ${nombre}? Deja de verla de inmediato.`)) return
    setMensaje(null)
    try {
      await enviar('quitar', h.supervisor_email, h.proceso_id)
      await cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
  }

  const nombreProceso = (id: string) => {
    const p = procesos.find(x => x.id === id)
    return p ? `${nombreDeProcesoLegible(p.nombre)} (${p.cargo})` : 'Proceso'
  }
  const nombreSupervisor = (correo: string) => supervisores.find(s => s.email === correo)?.nombre || correo
  const activos = supervisores.filter(s => s.activo)

  return (
    <div style={estilos.card}>
      <div style={estilos.cabecera}><h2 style={estilos.titulo}>Compartir con supervisores</h2></div>
      <div style={estilos.cuerpo}>
        <p style={estilos.ayuda}>El supervisor verá la videoentrevista de este proceso y, cuando lo publiques, el informe para supervisores. Nunca ve el dictamen.</p>

        {cargando ? (
          <p style={estilos.ayuda}>Cargando…</p>
        ) : procesos.length === 0 ? (
          <p style={estilos.ayuda}>Esta persona todavía no participa de ningún proceso, así que no se puede compartir.</p>
        ) : activos.length === 0 ? (
          <p style={estilos.ayuda}>Todavía no hay supervisores activos. Se invitan desde Accesos.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <label htmlFor="compartir-supervisor" style={{ position: 'absolute', left: '-9999px' }}>Supervisor</label>
            <select id="compartir-supervisor" style={estilos.select} value={email} onChange={e => setEmail(e.target.value)}>
              <option value="">Elegí un supervisor</option>
              {activos.map(s => <option key={s.email} value={s.email}>{s.nombre || s.email}</option>)}
            </select>
            <label htmlFor="compartir-proceso" style={{ position: 'absolute', left: '-9999px' }}>Proceso</label>
            <select id="compartir-proceso" style={estilos.select} value={procesoId} onChange={e => setProcesoId(e.target.value)}>
              {procesos.map(p => <option key={p.id} value={p.id}>{nombreProceso(p.id)}</option>)}
            </select>
            <button type="button" style={{ ...estilos.boton, opacity: ocupado ? 0.6 : 1 }} disabled={ocupado} onClick={compartir}>{ocupado ? 'Compartiendo…' : 'Compartir'}</button>
          </div>
        )}

        {mensaje && (
          <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} style={{ fontSize: '0.9rem', margin: '0.75rem 0 0', color: mensaje.tipo === 'ok' ? 'var(--emerald-700, #047857)' : 'var(--rose-700, #be123c)' }}>{mensaje.texto}</p>
        )}

        {habilitaciones.length > 0 && (
          <div style={{ marginTop: '1.25rem' }}>
            <p style={{ ...estilos.ayuda, margin: '0 0 0.25rem', fontWeight: 600, color: 'var(--slate-700)' }}>Compartida con</p>
            {habilitaciones.map(h => (
              <div key={`${h.supervisor_email}:${h.proceso_id}`} style={estilos.fila}>
                <span style={{ fontSize: '0.95rem', color: 'var(--slate-800)' }}>{nombreSupervisor(h.supervisor_email)} <span style={{ color: 'var(--slate-500)' }}>— {nombreProceso(h.proceso_id)}</span></span>
                <button type="button" style={estilos.quitar} onClick={() => quitar(h)}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
