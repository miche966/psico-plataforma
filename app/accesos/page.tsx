'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { getAdminHeaders } from '@/lib/evaluacionLink'
import { UserPlus, Mail, CheckCircle2 } from 'lucide-react'

interface Proceso {
  id: string
  nombre: string
  cargo: string
}

interface CuentaViewer {
  email: string
  role: string
  creado_en: string
  invitado_por: string | null
  procesoIds: string[]
}

export default function AccesosPage() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [cuentas, setCuentas] = useState<CuentaViewer[]>([])
  const [cargando, setCargando] = useState(true)
  const [email, setEmail] = useState('')
  const [procesosElegidos, setProcesosElegidos] = useState<Set<string>>(new Set())
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  async function cargarDatos() {
    setCargando(true)
    try {
      const headers = await getAdminHeaders()
      const [resProcesos, resUsuarios] = await Promise.all([
        fetch('/api/admin/procesos', { headers, cache: 'no-store' }),
        fetch('/api/admin/usuarios', { headers, cache: 'no-store' }),
      ])
      const dataProcesos = await resProcesos.json().catch(() => ({}))
      const dataUsuarios = await resUsuarios.json().catch(() => ({}))
      if (resProcesos.ok) setProcesos(dataProcesos.data || [])
      if (resUsuarios.ok) setCuentas(dataUsuarios.cuentas || [])
    } catch (err) {
      console.error(err)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  function toggleProceso(id: string) {
    setProcesosElegidos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function crearCuenta() {
    setMensaje(null)
    if (!email.trim() || !email.includes('@')) {
      setMensaje({ tipo: 'error', texto: 'Ingresá un email válido.' })
      return
    }
    if (procesosElegidos.size === 0) {
      setMensaje({ tipo: 'error', texto: 'Elegí al menos un proceso para esta cuenta.' })
      return
    }
    setCreando(true)
    try {
      const headers = await getAdminHeaders()
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: email.trim().toLowerCase(), procesoIds: Array.from(procesosElegidos) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la cuenta')
      setMensaje({ tipo: 'ok', texto: `Invitación enviada a ${email}. Va a poder definir su contraseña desde el correo que le llegue.` })
      setEmail('')
      setProcesosElegidos(new Set())
      cargarDatos()
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setCreando(false)
    }
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accesos de solo lectura</h1>
        <p className="text-sm text-slate-500 mt-1">
          Invitá a otras personas a ver la plataforma sin poder modificar nada. Cada cuenta ve únicamente los procesos que le asignes acá.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600" /> Nueva cuenta de solo lectura
        </h2>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="persona@empresa.com"
            className="w-full max-w-sm px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-2">Procesos a los que va a tener acceso</label>
          {procesos.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No hay procesos cargados todavía.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-slate-100 rounded-xl p-3">
              {procesos.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={procesosElegidos.has(p.id)}
                    onChange={() => toggleProceso(p.id)}
                    className="rounded border-slate-300"
                  />
                  <span className="truncate">{p.nombre} <span className="text-slate-400">— {p.cargo}</span></span>
                </label>
              ))}
            </div>
          )}
        </div>

        {mensaje && (
          <p className={`text-xs mb-3 ${mensaje.tipo === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>{mensaje.texto}</p>
        )}

        <button
          onClick={crearCuenta}
          disabled={creando}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <Mail className="w-4 h-4" />
          {creando ? 'Invitando...' : 'Invitar cuenta'}
        </button>
        <p className="text-[11px] text-slate-400 mt-2">
          Se le manda un correo de invitación para que defina su propia contraseña. Antes de invitar a alguien, confirmá que el envío de correos de Supabase funciona (por ejemplo probando "¿Olvidaste tu contraseña?" en el login).
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-4">Cuentas de solo lectura existentes</h2>
        {cargando ? (
          <p className="text-xs text-slate-400">Cargando...</p>
        ) : cuentas.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Todavía no invitaste a nadie.</p>
        ) : (
          <div className="space-y-3">
            {cuentas.map(c => (
              <div key={c.email} className="flex items-center justify-between border border-slate-100 rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.email}</p>
                  <p className="text-[11px] text-slate-400">
                    {c.procesoIds.length} proceso{c.procesoIds.length !== 1 ? 's' : ''} asignado{c.procesoIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Solo lectura
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
