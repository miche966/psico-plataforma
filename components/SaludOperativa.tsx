'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BellOff, Lock, RefreshCw } from 'lucide-react'
import { getAdminHeaders } from '@/lib/evaluacionLink'

interface SesionPendiente {
  candidato_id: string
  proceso_id: string
  test_id: string
  candidato_nombre: string
  candidato_email: string
  proceso_nombre: string
  proceso_activo: boolean | null
  ultimo_recordatorio: { enviado_en: string, estado: string } | null
}

interface ProgresoProblema {
  candidato_id: string
  proceso_id: string
  evaluacion_key: string
  estado: string
  ultima_actividad_en: string | null
  ultimo_error: string | null
  candidatos?: { nombre: string, apellido: string, email: string }
}

export default function SaludOperativa() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [sesionesPendientes, setSesionesPendientes] = useState<SesionPendiente[]>([])
  const [progresoProblemas, setProgresoProblemas] = useState<ProgresoProblema[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setError('')
    try {
      const response = await fetch('/api/admin/salud-operativa', { headers: await getAdminHeaders(), cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la salud operativa')
      setSesionesPendientes(payload.sesionesPendientes || [])
      setProgresoProblemas(payload.progresoProblemas || [])
    } catch (err: any) {
      setError(err.message || 'Error cargando la salud operativa')
    } finally {
      setCargando(false)
    }
  }

  const sinRecordatorio = sesionesPendientes.filter(s => !s.ultimo_recordatorio && s.proceso_activo)
  const enProcesoCerrado = sesionesPendientes.filter(s => s.proceso_activo === false)

  if (cargando) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
  }

  if (error) {
    return <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm">{error}</div>
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Salud Operativa</h2>
          <p className="text-sm text-slate-500">Candidatos y sesiones que requieren atención</p>
        </div>
        <button
          onClick={cargarDatos}
          className="px-4 py-2 text-sm font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      <section>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <BellOff className="w-4 h-4 text-amber-500" />
          Pendientes en procesos activos sin recordatorio ({sinRecordatorio.length})
        </h3>
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {sinRecordatorio.length === 0 && (
            <p className="p-4 text-sm text-slate-400">Ninguno — todos los candidatos con evaluaciones pendientes en procesos activos ya recibieron al menos un recordatorio.</p>
          )}
          {sinRecordatorio.map((s, i) => (
            <div key={`${s.candidato_id}-${s.proceso_id}-${i}`} className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-slate-800">{s.candidato_nombre || s.candidato_id}</p>
                <p className="text-xs text-slate-500">{s.candidato_email} · {s.proceso_nombre}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-slate-400" />
          Pendientes en procesos ya cerrados ({enProcesoCerrado.length})
        </h3>
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden max-h-96 overflow-y-auto">
          {enProcesoCerrado.length === 0 && (
            <p className="p-4 text-sm text-slate-400">Ninguno.</p>
          )}
          {enProcesoCerrado.map((s, i) => (
            <div key={`${s.candidato_id}-${s.proceso_id}-${i}`} className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-slate-800">{s.candidato_nombre || s.candidato_id}</p>
                <p className="text-xs text-slate-500">{s.candidato_email} · {s.proceso_nombre}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Sesiones operativas con problema ({progresoProblemas.length})
        </h3>
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {progresoProblemas.length === 0 && (
            <p className="p-4 text-sm text-slate-400">Ninguna sesión en estado pausada, con error o vencida.</p>
          )}
          {progresoProblemas.map((p, i) => (
            <div key={`${p.candidato_id}-${p.proceso_id}-${p.evaluacion_key}-${i}`} className="p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-slate-800">{p.candidatos ? `${p.candidatos.nombre} ${p.candidatos.apellido}` : p.candidato_id}</p>
                <p className="text-xs text-slate-500">{p.candidatos?.email} · {p.evaluacion_key}</p>
                {p.ultimo_error && <p className="text-xs text-red-500 mt-1">{p.ultimo_error}</p>}
              </div>
              <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-red-50 text-red-600">{p.estado}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
