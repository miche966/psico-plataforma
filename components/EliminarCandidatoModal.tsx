'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getAdminHeaders } from '@/lib/evaluacionLink'

type Resumen = { sesiones: number; sesionesFinalizadas: number; respuestas: number; videos: number; procesos: number }
type Props = {
  candidato: { id: string; nombre: string; apellido: string; email?: string | null }
  onCerrar: () => void
  onEliminado: (candidatoId: string) => void
}

const SERIF = { fontFamily: 'var(--font-lectura), Georgia, serif' }
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Confirmacion para eliminar un candidato: muestra que se borraria y pide escribir su nombre completo.
 * La misma comprobacion la hace el servidor, que es quien decide.
 */
export default function EliminarCandidatoModal({ candidato, onCerrar, onEliminado }: Props) {
  const nombreCompleto = `${candidato.nombre} ${candidato.apellido}`.trim()
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const campoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vigente = true
    ;(async () => {
      try {
        const response = await fetch('/api/admin/candidatos', {
          method: 'POST',
          headers: await getAdminHeaders(),
          body: JSON.stringify({ action: 'resumen_eliminacion', candidatoId: candidato.id }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'No se pudo consultar al candidato')
        if (vigente) setResumen(payload.resumen)
      } catch (e: any) {
        if (vigente) setError(e.message)
      }
    })()
    return () => { vigente = false }
  }, [candidato.id])

  // El foco entra al abrir y vuelve al boton que abrio el cuadro; Escape lo cierra salvo mientras se elimina
  const cerrarRef = useRef(onCerrar)
  const eliminandoRef = useRef(false)
  cerrarRef.current = onCerrar
  eliminandoRef.current = eliminando
  useEffect(() => {
    const abridor = document.activeElement as HTMLElement | null
    campoRef.current?.focus()
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !eliminandoRef.current) cerrarRef.current() }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      abridor?.focus?.()
    }
  }, [])

  // El campo aparece recien cuando llega el resumen
  useEffect(() => { if (resumen && (resumen.videos ?? 0) === 0) campoRef.current?.focus() }, [resumen])

  const tieneVideos = (resumen?.videos ?? 0) > 0
  const coincide = normalizar(texto) === normalizar(nombreCompleto)
  const puedeEliminar = !!resumen && !tieneVideos && coincide && !eliminando

  async function eliminar() {
    if (!puedeEliminar) return
    setEliminando(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/candidatos', {
        method: 'POST',
        headers: await getAdminHeaders(),
        body: JSON.stringify({ action: 'eliminar_candidato', candidatoId: candidato.id, confirmacion: texto }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'No se pudo eliminar al candidato')
      onEliminado(candidato.id)
    } catch (e: any) {
      setError(e.message)
      setEliminando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => { if (!eliminando) onCerrar() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="eliminar-candidato-titulo"
        className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h3 id="eliminar-candidato-titulo" className="text-xl font-semibold text-slate-900" style={SERIF}>Eliminar candidato</h3>
            <p className="text-sm text-slate-500 mt-1">{nombreCompleto}{candidato.email ? ` · ${candidato.email}` : ''}</p>
          </div>
          <button type="button" onClick={onCerrar} disabled={eliminando} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Cerrar sin eliminar">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!resumen && !error && <p className="text-slate-600" role="status">Revisando qué se borraría…</p>}

          {resumen && (
            <>
              <p className="text-slate-700">Se va a borrar para siempre, sin posibilidad de recuperarlo:</p>
              <ul className="text-slate-700 list-disc pl-5 space-y-1">
                <li>El candidato y sus datos personales.</li>
                <li>{resumen.sesiones} {resumen.sesiones === 1 ? 'sesión' : 'sesiones'} de pruebas ({resumen.sesionesFinalizadas} {resumen.sesionesFinalizadas === 1 ? 'finalizada' : 'finalizadas'}) y {resumen.respuestas} {resumen.respuestas === 1 ? 'respuesta' : 'respuestas'}.</li>
                <li>Su vínculo con {resumen.procesos} {resumen.procesos === 1 ? 'proceso' : 'procesos'}, y sus informes y resúmenes guardados.</li>
              </ul>
              {resumen.sesionesFinalizadas > 0 && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2" role="status">
                  Tiene pruebas finalizadas: también dejará de contar en las estadísticas de sus procesos.
                </p>
              )}
              {tieneVideos && (
                <p className="text-sm text-rose-800 bg-rose-50 border border-rose-300 rounded-lg px-3 py-2" role="alert">
                  Tiene {resumen.videos} {resumen.videos === 1 ? 'videoentrevista guardada' : 'videoentrevistas guardadas'} y no se puede eliminar desde acá: los archivos de video quedarían sin borrar en el almacenamiento.
                </p>
              )}
              {!tieneVideos && (
                <div>
                  <label htmlFor="eliminar-candidato-nombre" className="block text-sm font-medium text-slate-800 mb-1.5">
                    Para confirmar, escribí el nombre completo: <span className="font-semibold">{nombreCompleto}</span>
                  </label>
                  <input
                    id="eliminar-candidato-nombre"
                    ref={campoRef}
                    type="text"
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') eliminar() }}
                    autoComplete="off"
                    disabled={eliminando}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  />
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-rose-800 bg-rose-50 border border-rose-300 rounded-lg px-3 py-2" role="alert">{error}</p>}
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCerrar} disabled={eliminando} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={eliminar}
            disabled={!puedeEliminar}
            className="px-4 py-2 bg-rose-700 text-white rounded-lg text-sm font-bold hover:bg-rose-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {eliminando ? 'Eliminando…' : 'Eliminar candidato'}
          </button>
        </div>
      </div>
    </div>
  )
}
