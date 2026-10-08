'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAdminHeaders } from '@/lib/evaluacionLink'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'
import { useSupervisorGate } from '@/lib/useSupervisor'
import { Marco } from '@/components/candidato/Marco'
import { PantallaCarga } from '@/components/candidato/Estados'

interface Evaluado {
  candidato_id: string
  proceso_id: string
  nombre: string
  apellido: string
  proceso_nombre: string | null
  cargo: string | null
  habilitado_en: string | null
  informe_disponible: boolean
  videos: number
}

// Area de los supervisores de la empresa (ver docs/PLAN_SUPERVISORES.md). Independiente del panel de administracion: no usa
// AppLayout. Lista las personas que el equipo de seleccion le compartio; cada una abre su ficha.
export default function SupervisorPage() {
  const { listo, cerrarSesion } = useSupervisorGate()
  const [evaluados, setEvaluados] = useState<Evaluado[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!listo) return
    let vivo = true
    ;(async () => {
      try {
        const res = await fetch('/api/supervisor/evaluados', { headers: await getAdminHeaders(), cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar tu lista de evaluados')
        if (vivo) setEvaluados(data.evaluados || [])
      } catch (e: any) {
        if (vivo) setError(e.message || 'No se pudo cargar tu lista de evaluados')
      }
    })()
    return () => { vivo = false }
  }, [listo])

  if (!listo) return <PantallaCarga texto="Cargando…" />

  return (
    <Marco titulo="Evaluados habilitados" ancho>
      <h1 className="pp-titulo">Evaluados habilitados</h1>
      <p className="pp-lead">Las personas que el equipo de selección te compartió, con sus videoentrevistas y un informe para acompañar su incorporación.</p>

      {error && <div className="pp-alerta" role="alert"><p>{error}</p></div>}
      {!error && evaluados === null && <p className="pp-muted" role="status">Cargando tu lista…</p>}
      {!error && evaluados?.length === 0 && (
        <p className="pp-muted">Todavía no tenés evaluados habilitados. Cuando el equipo de selección te comparta a alguien, vas a verlo acá.</p>
      )}

      {evaluados && evaluados.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '1.5rem 0 0', padding: 0, display: 'grid', gap: '0.75rem' }}>
          {evaluados.map(e => (
            <li key={`${e.candidato_id}:${e.proceso_id}`}>
              <Link
                href={`/supervisor/evaluado?candidato=${encodeURIComponent(e.candidato_id)}&proceso=${encodeURIComponent(e.proceso_id)}`}
                style={{ display: 'block', padding: '1rem 1.15rem', border: '1px solid var(--slate-200, #e2e8f0)', borderRadius: '12px', textDecoration: 'none', color: 'inherit', background: 'var(--white-bg, #fff)' }}
              >
                <span style={{ display: 'block', fontWeight: 700, fontSize: '1.1rem' }}>{`${e.nombre} ${e.apellido}`.trim()}</span>
                <span className="pp-muted" style={{ display: 'block', margin: '0.15rem 0 0.5rem' }}>
                  {[e.cargo, e.proceso_nombre ? nombreDeProcesoLegible(e.proceso_nombre) : null].filter(Boolean).join(' · ')}
                </span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.9rem' }}>
                  <span>{e.informe_disponible ? 'Informe disponible' : 'Informe en preparación'}</span>
                  <span>{e.videos === 0 ? 'Sin videoentrevistas' : e.videos === 1 ? '1 videoentrevista' : `${e.videos} videoentrevistas`}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '2rem' }}><button type="button" className="pp-enlace" onClick={cerrarSesion}>Cerrar sesión</button></p>
    </Marco>
  )
}
