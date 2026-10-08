'use client'

import { useEffect, useState } from 'react'
import { getAdminHeaders } from '@/lib/evaluacionLink'
import { UserPlus, Mail, CheckCircle2, PauseCircle } from 'lucide-react'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'

interface Habilitacion {
  candidato_id: string
  proceso_id: string
  habilitado_en: string | null
  candidato_nombre: string
  proceso_nombre: string | null
  proceso_cargo: string | null
}

interface Supervisor {
  email: string
  nombre: string
  activo: boolean
  creado_en: string
  habilitaciones: Habilitacion[]
}

// Supervisores de la empresa (ver docs/PLAN_SUPERVISORES.md): alta, estado y evaluados que tienen habilitados.
// Los evaluados se habilitan desde la ficha de cada persona ("Compartir con supervisores").
export default function SupervisoresAccesos() {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [cargando, setCargando] = useState(true)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [invitando, setInvitando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function cargar() {
    setCargando(true)
    try {
      const res = await fetch('/api/admin/supervisores', { headers: await getAdminHeaders(), cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setSupervisores(data.supervisores || [])
      else setMensaje({ tipo: 'error', texto: data.error || 'No se pudieron cargar los supervisores' })
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function enviar(cuerpo: Record<string, unknown>, urlApi = '/api/admin/supervisores') {
    const res = await fetch(urlApi, { method: 'POST', headers: await getAdminHeaders(), body: JSON.stringify(cuerpo) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación')
    return data
  }

  async function invitar() {
    setMensaje(null)
    if (!email.trim() || !email.includes('@')) { setMensaje({ tipo: 'error', texto: 'Ingresá un email válido.' }); return }
    setInvitando(true)
    try {
      await enviar({ accion: 'alta', email: email.trim().toLowerCase(), nombre })
      setMensaje({ tipo: 'ok', texto: `Invitación enviada a ${email.trim()}. Va a poder definir su contraseña desde el correo que le llegue.` })
      setEmail('')
      setNombre('')
      cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setInvitando(false)
    }
  }

  async function cambiarEstado(s: Supervisor) {
    const accion = s.activo ? 'desactivar' : 'activar'
    if (s.activo && !confirm(`¿Desactivar a ${s.nombre || s.email}? Deja de poder ver a sus evaluados de inmediato; las habilitaciones se conservan.`)) return
    setMensaje(null)
    try {
      await enviar({ accion, email: s.email })
      setMensaje({ tipo: 'ok', texto: s.activo ? `${s.email} quedó desactivado.` : `${s.email} quedó activo.` })
      cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
  }

  async function restablecer2fa(s: Supervisor) {
    if (!confirm(`¿Restablecer el 2FA de ${s.email}? Se cierran sus sesiones y tendrá que configurar un dispositivo nuevo la próxima vez que ingrese.`)) return
    setMensaje(null)
    try {
      const data = await enviar({ accion: 'restablecer_2fa', email: s.email })
      setMensaje({ tipo: 'ok', texto: data.eliminados > 0 ? `Se restableció el 2FA de ${s.email}. En su próximo ingreso va a configurar un dispositivo nuevo.` : `${s.email} no tenía dispositivos configurados.` })
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
  }

  async function quitar(s: Supervisor, h: Habilitacion) {
    if (!confirm(`¿Quitar a ${h.candidato_nombre} de lo que ve ${s.nombre || s.email}? Deja de verlo de inmediato.`)) return
    setMensaje(null)
    try {
      await enviar({ accion: 'quitar', email: s.email, candidato_id: h.candidato_id, proceso_id: h.proceso_id }, '/api/admin/supervisor-evaluados')
      cargar()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
  }

  return (
    <>
      <div className="mt-12 mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Supervisores</h2>
        <p className="text-sm text-slate-500 mt-1">
          Personas de la empresa que entran con su propia cuenta a un panel aparte. Cada una ve solo las personas que le compartas desde su ficha, con sus videoentrevistas y el informe para supervisores.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600" /> Nuevo supervisor
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mb-4">
          <div>
            <label htmlFor="supervisor-email" className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input id="supervisor-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="persona@empresa.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label htmlFor="supervisor-nombre" className="block text-xs font-medium text-slate-600 mb-1">Nombre (opcional)</label>
            <input id="supervisor-nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} placeholder="Nombre y apellido"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400" />
          </div>
        </div>
        {mensaje && <p className={`text-xs mb-3 ${mensaje.tipo === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</p>}
        <button onClick={invitar} disabled={invitando}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          {invitando ? 'Invitando...' : 'Invitar supervisor'}
        </button>
        <p className="text-[11px] text-slate-400 mt-2">
          Se le manda un correo de invitación para que defina su propia contraseña. La primera vez que ingrese va a configurar la verificación en dos pasos. Una cuenta no puede ser a la vez supervisor, administrador o de solo lectura.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Supervisores existentes</h3>
        {cargando ? (
          <p className="text-xs text-slate-400">Cargando...</p>
        ) : supervisores.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Todavía no invitaste a ningún supervisor.</p>
        ) : (
          <div className="space-y-3">
            {supervisores.map(s => (
              <div key={s.email} className="border border-slate-100 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.nombre || s.email}</p>
                    {s.nombre && <p className="text-[11px] text-slate-400">{s.email}</p>}
                    <p className="text-[11px] text-slate-400">
                      {s.habilitaciones.length === 0 ? 'Sin evaluados habilitados' : `${s.habilitaciones.length} evaluado${s.habilitaciones.length !== 1 ? 's' : ''} habilitado${s.habilitaciones.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => restablecer2fa(s)} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800">Restablecer 2FA</button>
                    <button onClick={() => cambiarEstado(s)} className="text-[11px] font-medium text-slate-600 hover:text-slate-900">{s.activo ? 'Desactivar' : 'Activar'}</button>
                    {s.activo ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Activo</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full"><PauseCircle className="w-3 h-3" /> Desactivado</span>
                    )}
                  </div>
                </div>
                {s.habilitaciones.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                    {s.habilitaciones.map(h => (
                      <li key={`${h.candidato_id}:${h.proceso_id}`} className="flex items-center justify-between gap-3 text-xs text-slate-700">
                        <span className="truncate">{h.candidato_nombre} <span className="text-slate-400">— {h.proceso_nombre ? nombreDeProcesoLegible(h.proceso_nombre) : 'Proceso'}{h.proceso_cargo ? ` (${h.proceso_cargo})` : ''}</span></span>
                        <button onClick={() => quitar(s, h)} className="text-[11px] font-medium text-rose-600 hover:text-rose-800 shrink-0">Quitar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
