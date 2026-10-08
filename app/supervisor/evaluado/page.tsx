'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { pdf } from '@react-pdf/renderer'
import { getAdminHeaders } from '@/lib/evaluacionLink'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'
import { useSupervisorGate } from '@/lib/useSupervisor'
import { SECCIONES_SUPERVISOR, type InformeSupervisor } from '@/lib/informeSupervisor'
import { Marco } from '@/components/candidato/Marco'
import { PantallaCarga } from '@/components/candidato/Estados'
import InformeSupervisorPDF from '@/components/InformeSupervisorPDF'

interface Detalle {
  nombre: string
  apellido: string
  proceso_nombre: string | null
  cargo: string | null
  informe: InformeSupervisor | null
  publicado_en: string | null
}
interface Video { id: string; pregunta: string; url: string | null }

function FichaEvaluado() {
  const { listo, cerrarSesion } = useSupervisorGate()
  const params = useSearchParams()
  const candidatoId = params.get('candidato') || ''
  const procesoId = params.get('proceso') || ''

  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [error, setError] = useState('')
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState('')
  const recargas = useRef(0)

  const consulta = `candidato_id=${encodeURIComponent(candidatoId)}&proceso_id=${encodeURIComponent(procesoId)}`

  const cargarVideos = useCallback(async () => {
    try {
      const res = await fetch(`/api/supervisor/videos?${consulta}`, { headers: await getAdminHeaders(), cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setVideos(data.videos || [])
      else setVideos([])
    } catch {
      setVideos([])
    }
  }, [consulta])

  useEffect(() => {
    if (!listo) return
    let vivo = true
    ;(async () => {
      try {
        const res = await fetch(`/api/supervisor/evaluado?${consulta}`, { headers: await getAdminHeaders(), cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!vivo) return
        if (res.status === 404) { setNoEncontrado(true); return }
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar esta persona')
        setDetalle(data.evaluado)
        cargarVideos()
      } catch (e: any) {
        if (vivo) setError(e.message || 'No se pudo cargar esta persona')
      }
    })()
    return () => { vivo = false }
  }, [listo, consulta, cargarVideos])

  // Los enlaces de video vencen a las 2 horas: si uno deja de andar se piden de nuevo (una vez por falla, hasta 3 veces)
  function alFallarVideo() {
    if (recargas.current >= 3) return
    recargas.current += 1
    cargarVideos()
  }

  async function descargar() {
    if (!detalle?.informe) return
    setDescargando(true)
    setErrorDescarga('')
    try {
      // Primero se registra la descarga; si el servidor no la autoriza, no se genera el PDF
      const res = await fetch('/api/supervisor/evaluado', { method: 'POST', headers: await getAdminHeaders(), body: JSON.stringify({ accion: 'descargar', candidato_id: candidatoId, proceso_id: procesoId }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo preparar la descarga')
      const blob = await pdf(
        <InformeSupervisorPDF datos={{
          nombre: `${detalle.nombre} ${detalle.apellido}`.trim(),
          cargo: detalle.cargo,
          proceso: detalle.proceso_nombre ? nombreDeProcesoLegible(detalle.proceso_nombre) : null,
          fecha: detalle.publicado_en,
          informe: detalle.informe,
        }} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Informe_para_la_incorporacion_${`${detalle.nombre} ${detalle.apellido}`.trim().replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e: any) {
      setErrorDescarga(e.message || 'No se pudo generar el PDF. Intentá de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  if (!listo) return <PantallaCarga texto="Cargando…" />

  const volver = <p><Link href="/supervisor" className="pp-enlace">← Volver a mis evaluados</Link></p>

  if (noEncontrado || !candidatoId || !procesoId) {
    return (
      <Marco titulo="Persona no encontrada" ancho>
        {volver}
        <h1 className="pp-titulo">No encontramos a esa persona</h1>
        <p className="pp-lead">No está entre las personas que te compartieron. Si creés que es un error, consultalo con el equipo de selección.</p>
      </Marco>
    )
  }
  if (error) return <Marco titulo="No se pudo cargar" ancho>{volver}<div className="pp-alerta" role="alert"><p>{error}</p></div></Marco>
  if (!detalle) return <PantallaCarga texto="Cargando…" />

  const nombre = `${detalle.nombre} ${detalle.apellido}`.trim()
  return (
    <Marco titulo={nombre} ancho>
      {volver}
      <h1 className="pp-titulo">{nombre}</h1>
      <p className="pp-lead">{[detalle.cargo, detalle.proceso_nombre ? nombreDeProcesoLegible(detalle.proceso_nombre) : null].filter(Boolean).join(' · ')}</p>

      <section aria-labelledby="sec-informe" style={{ marginTop: '2rem' }}>
        <h2 id="sec-informe" style={{ fontSize: '1.3rem', margin: '0 0 0.75rem' }}>Informe para la incorporación</h2>
        {detalle.informe ? (
          <>
            {SECCIONES_SUPERVISOR.map(s => detalle.informe![s.clave] ? (
              <div key={s.clave} style={{ margin: '1.1rem 0' }}>
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.3rem' }}>{s.titulo}</h3>
                <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{detalle.informe![s.clave]}</p>
              </div>
            ) : null)}
            <p className="pp-muted" style={{ margin: '1.25rem 0 0.75rem' }}>Informe orientativo: no reemplaza el criterio de quien conduce al equipo. Confidencial, no compartir fuera de la empresa.</p>
            <button type="button" className="pp-boton" onClick={descargar} disabled={descargando}>{descargando ? 'Preparando el PDF…' : 'Descargar PDF'}</button>
            {errorDescarga && <div className="pp-alerta" role="alert" style={{ marginTop: '0.75rem' }}><p>{errorDescarga}</p></div>}
          </>
        ) : (
          <p className="pp-muted">El informe todavía no está disponible. Te va a aparecer acá cuando el equipo de selección lo publique.</p>
        )}
      </section>

      <section aria-labelledby="sec-videos" style={{ marginTop: '2.5rem' }}>
        <h2 id="sec-videos" style={{ fontSize: '1.3rem', margin: '0 0 0.75rem' }}>Videoentrevistas</h2>
        {videos === null ? (
          <p className="pp-muted" role="status">Cargando las videoentrevistas…</p>
        ) : videos.length === 0 ? (
          <p className="pp-muted">Esta persona no tiene videoentrevistas en este proceso.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {videos.map((v, i) => (
              <figure key={v.id} style={{ margin: 0 }}>
                <figcaption style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{i + 1}. {v.pregunta || 'Pregunta'}</figcaption>
                {v.url ? (
                  <video controls preload="metadata" src={v.url} onError={alFallarVideo} style={{ width: '100%', maxHeight: '28rem', background: '#000', borderRadius: '8px' }}>
                    Tu navegador no puede reproducir este video.
                  </video>
                ) : (
                  <p className="pp-muted">Este video no está disponible por ahora.</p>
                )}
              </figure>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: '2.5rem' }}><button type="button" className="pp-enlace" onClick={cerrarSesion}>Cerrar sesión</button></p>
    </Marco>
  )
}

export default function EvaluadoSupervisorPage() {
  return (
    <Suspense fallback={<PantallaCarga texto="Cargando…" />}>
      <FichaEvaluado />
    </Suspense>
  )
}
