'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { getAdminHeaders } from '@/lib/evaluacionLink'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'
import { informeVacio, normalizarInformeSupervisor, revisarTerminos, seccionesFaltantes, LARGO_MAXIMO_SECCION, SECCIONES_SUPERVISOR, type InformeSupervisor } from '@/lib/informeSupervisor'
import InformeSupervisorPDF from '@/components/InformeSupervisorPDF'

interface Proceso { id: string; nombre: string; cargo: string }
interface Estado {
  borrador: InformeSupervisor | null
  publicado: InformeSupervisor | null
  publicado_en: string | null
  hayInformeTecnico: boolean
}

const SERIF = 'var(--font-lectura), Georgia, serif'
const e = {
  card: { background: 'var(--white-bg)', borderRadius: '12px', marginBottom: '1.75rem', overflow: 'hidden', border: '1px solid var(--slate-200)' },
  cabecera: { padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--slate-200)' },
  titulo: { fontFamily: SERIF, fontWeight: 600, color: 'var(--slate-900)', fontSize: '1.2rem', margin: 0 },
  cuerpo: { padding: '1.25rem' },
  ayuda: { fontSize: '0.9rem', color: 'var(--slate-500)', margin: '0 0 1rem', lineHeight: 1.5 },
  label: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '6px', display: 'block' },
  ta: { width: '100%', padding: '0.7rem 0.9rem', borderRadius: '8px', border: '1px solid var(--slate-300)', fontSize: '0.95rem', lineHeight: 1.55, color: 'var(--slate-800)', background: 'var(--white-bg)', fontFamily: 'inherit', minHeight: '96px' },
  select: { padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--slate-300)', background: 'var(--white-bg)', color: 'var(--slate-800)', fontSize: '0.95rem', maxWidth: '100%' },
  boton: { padding: '0.6rem 1.1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', background: 'var(--white-bg)', color: 'var(--slate-700)', border: '1px solid var(--slate-300)', textDecoration: 'none', display: 'inline-block' },
  principal: { padding: '0.6rem 1.1rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', background: 'var(--slate-900)', color: 'var(--white-bg)', border: '1px solid var(--slate-900)' },
}

/**
 * Informe para supervisores (ver docs/PLAN_SUPERVISORES.md): generar un borrador con IA a partir del informe psicolaboral ya
 * guardado, editarlo, revisarlo y publicarlo. El supervisor solo ve lo publicado. Solo lo ve el administrador completo.
 */
export default function InformeSupervisorEditor({ candidatoId, nombre }: { candidatoId: string; nombre: string }) {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [procesoId, setProcesoId] = useState('')
  const [estado, setEstado] = useState<Estado | null>(null)
  const [texto, setTexto] = useState<InformeSupervisor>(informeVacio())
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<'' | 'generar' | 'guardar' | 'publicar' | 'despublicar'>('')
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const cargarProcesos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/supervisor-evaluados?candidato_id=' + encodeURIComponent(candidatoId), { headers: await getAdminHeaders(), cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los procesos de esta persona')
      setProcesos(data.procesos || [])
      setProcesoId(actual => actual || data.procesos?.[0]?.id || '')
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setCargando(false)
    }
  }, [candidatoId])

  const cargarInforme = useCallback(async (proceso: string) => {
    if (!proceso) return
    setEstado(null)
    try {
      const res = await fetch(`/api/admin/informe-supervisor?candidato_id=${encodeURIComponent(candidatoId)}&proceso_id=${encodeURIComponent(proceso)}`, { headers: await getAdminHeaders(), cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el informe para supervisores')
      setEstado({ borrador: data.borrador, publicado: data.publicado, publicado_en: data.publicado_en, hayInformeTecnico: !!data.hayInformeTecnico })
      setTexto(data.borrador || data.publicado || informeVacio())
    } catch (err: any) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
  }, [candidatoId])

  useEffect(() => { cargarProcesos() }, [cargarProcesos])
  useEffect(() => { setMensaje(null); cargarInforme(procesoId) }, [procesoId, cargarInforme])

  async function enviar(accion: string, extra: Record<string, unknown> = {}) {
    const res = await fetch('/api/admin/informe-supervisor', {
      method: 'POST',
      headers: await getAdminHeaders(),
      body: JSON.stringify({ accion, candidato_id: candidatoId, proceso_id: procesoId, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'No se pudo completar la operación')
    return data
  }

  async function ejecutar(tipo: typeof ocupado, trabajo: () => Promise<void>) {
    setMensaje(null)
    setOcupado(tipo)
    try { await trabajo() } catch (err: any) { setMensaje({ tipo: 'error', texto: err.message }) } finally { setOcupado('') }
  }

  const hayTexto = SECCIONES_SUPERVISOR.some(s => texto[s.clave])
  const generar = () => ejecutar('generar', async () => {
    if (hayTexto && !confirm('Ya hay un texto en este informe. Generar uno nuevo lo reemplaza. ¿Seguimos?')) return
    const data = await enviar('generar')
    setTexto(data.borrador)
    await cargarInforme(procesoId)
    setMensaje({ tipo: 'ok', texto: 'Borrador generado. Revisalo y editalo: el supervisor no ve nada hasta que lo publiques.' })
  })
  const guardar = () => ejecutar('guardar', async () => {
    await enviar('guardar_borrador', { borrador: texto })
    await cargarInforme(procesoId)
    setMensaje({ tipo: 'ok', texto: 'Borrador guardado. Lo que ve el supervisor no cambió.' })
  })
  const publicar = () => ejecutar('publicar', async () => {
    if (!confirm(`¿Publicar este informe? Los supervisores con acceso a ${nombre} en este proceso lo van a ver.`)) return
    await enviar('guardar_borrador', { borrador: texto })
    await enviar('publicar')
    await cargarInforme(procesoId)
    setMensaje({ tipo: 'ok', texto: 'Informe publicado. Los supervisores habilitados ya lo ven.' })
  })
  const despublicar = () => ejecutar('despublicar', async () => {
    if (!confirm('¿Retirar el informe publicado? Los supervisores dejan de verlo; el borrador se conserva.')) return
    await enviar('despublicar')
    await cargarInforme(procesoId)
    setMensaje({ tipo: 'ok', texto: 'Informe retirado: ya no lo ven los supervisores.' })
  })

  // Revision en vivo, igual a la que hace el servidor al publicar
  const revision = useMemo(() => revisarTerminos(normalizarInformeSupervisor(texto)), [texto])
  const faltan = useMemo(() => seccionesFaltantes(normalizarInformeSupervisor(texto)), [texto])
  const proceso = procesos.find(p => p.id === procesoId)
  const editado = JSON.stringify(normalizarInformeSupervisor(texto)) !== JSON.stringify(estado?.borrador ?? null)
  const publicadoIgual = !!estado?.publicado && JSON.stringify(normalizarInformeSupervisor(texto)) === JSON.stringify(estado.publicado)
  const fechaPublicado = estado?.publicado_en ? new Date(estado.publicado_en).toLocaleDateString('es-UY') : null

  let situacion = 'Sin informe todavía.'
  if (estado?.publicado && publicadoIgual) situacion = `Publicado el ${fechaPublicado}. Es lo que ven los supervisores.`
  else if (estado?.publicado) situacion = `Hay una versión publicada (${fechaPublicado}) y cambios sin publicar.`
  else if (estado?.borrador || hayTexto) situacion = 'Borrador sin publicar: los supervisores todavía no ven nada.'

  return (
    <div style={e.card}>
      <div style={e.cabecera}><h2 style={e.titulo}>Informe para supervisores</h2></div>
      <div style={e.cuerpo}>
        <p style={e.ayuda}>
          Un texto corto y sin tecnicismos para la jefatura: cómo trabaja la persona y cómo acompañarla. No lleva puntajes, datos de salud ni el dictamen. Se genera a partir del informe psicolaboral que ya guardaste, y el supervisor solo ve lo que publiques.
        </p>

        {cargando ? (
          <p style={e.ayuda}>Cargando…</p>
        ) : procesos.length === 0 ? (
          <p style={e.ayuda}>Esta persona todavía no participa de ningún proceso.</p>
        ) : (
          <>
            <label htmlFor="informe-sup-proceso" style={e.label}>Proceso</label>
            <select id="informe-sup-proceso" style={{ ...e.select, marginBottom: '1rem' }} value={procesoId} onChange={ev => setProcesoId(ev.target.value)}>
              {procesos.map(p => <option key={p.id} value={p.id}>{nombreDeProcesoLegible(p.nombre)} ({p.cargo})</option>)}
            </select>

            {!estado ? (
              <p style={e.ayuda}>Cargando el informe…</p>
            ) : (
              <>
                <p role="status" style={{ ...e.ayuda, fontWeight: 600, color: 'var(--slate-700)' }}>{situacion}</p>

                {!estado.hayInformeTecnico && !hayTexto && (
                  <p style={{ ...e.ayuda, color: 'var(--amber-700, #b45309)' }}>Para generarlo con IA, primero guardá el informe psicolaboral de esta persona (botón «Guardar cambios» de arriba). También podés escribirlo a mano.</p>
                )}

                {SECCIONES_SUPERVISOR.map(s => (
                  <div key={s.clave} style={{ marginBottom: '1rem' }}>
                    <label htmlFor={`informe-sup-${s.clave}`} style={e.label}>{s.titulo}{s.obligatoria ? '' : ' (opcional)'}</label>
                    <textarea
                      id={`informe-sup-${s.clave}`}
                      style={e.ta}
                      value={texto[s.clave] || ''}
                      maxLength={LARGO_MAXIMO_SECCION}
                      onChange={ev => setTexto(t => ({ ...t, [s.clave]: ev.target.value }))}
                      placeholder={s.ayuda}
                    />
                  </div>
                ))}

                {revision.bloqueantes.length > 0 && (
                  <div role="alert" style={{ border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#991b1b' }}>
                    <strong>No se puede publicar mientras aparezca esto:</strong>
                    <ul style={{ margin: '0.4rem 0 0 1.1rem' }}>
                      {revision.bloqueantes.map((h, i) => <li key={i}>«{h.texto}» en «{h.seccion}»: {h.motivo}.</li>)}
                    </ul>
                  </div>
                )}
                {revision.advertencias.length > 0 && (
                  <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#92400e' }}>
                    <strong>Conviene revisar:</strong>
                    <ul style={{ margin: '0.4rem 0 0 1.1rem' }}>
                      {revision.advertencias.map((h, i) => <li key={i}>«{h.texto}» en «{h.seccion}»: {h.motivo}.</li>)}
                    </ul>
                  </div>
                )}
                {faltan.length > 0 && hayTexto && (
                  <p style={{ ...e.ayuda, color: 'var(--slate-600)' }}>Para publicar faltan: {faltan.join(', ')}.</p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                  <button type="button" style={{ ...e.boton, opacity: ocupado ? 0.6 : 1 }} disabled={!!ocupado || !estado.hayInformeTecnico} onClick={generar} title={estado.hayInformeTecnico ? undefined : 'Guardá primero el informe psicolaboral'}>
                    {ocupado === 'generar' ? 'Generando…' : 'Generar con IA'}
                  </button>
                  <button type="button" style={{ ...e.boton, opacity: ocupado || !hayTexto ? 0.6 : 1 }} disabled={!!ocupado || !hayTexto} onClick={guardar}>
                    {ocupado === 'guardar' ? 'Guardando…' : editado ? 'Guardar borrador' : 'Borrador guardado'}
                  </button>
                  <button type="button" style={{ ...e.principal, opacity: ocupado || faltan.length > 0 || revision.bloqueantes.length > 0 || publicadoIgual ? 0.5 : 1 }} disabled={!!ocupado || faltan.length > 0 || revision.bloqueantes.length > 0 || publicadoIgual} onClick={publicar}>
                    {ocupado === 'publicar' ? 'Publicando…' : 'Publicar'}
                  </button>
                  {estado.publicado && (
                    <button type="button" style={{ ...e.boton, opacity: ocupado ? 0.6 : 1 }} disabled={!!ocupado} onClick={despublicar}>
                      {ocupado === 'despublicar' ? 'Retirando…' : 'Despublicar'}
                    </button>
                  )}
                  {hayTexto && (
                    <PDFDownloadLink
                      document={<InformeSupervisorPDF datos={{ nombre, cargo: proceso?.cargo || null, proceso: proceso ? nombreDeProcesoLegible(proceso.nombre) : null, fecha: publicadoIgual ? estado.publicado_en : null, informe: normalizarInformeSupervisor(texto), borrador: !publicadoIgual }} />}
                      fileName={`Informe_para_supervisores_${nombre.replace(/\s+/g, '_')}.pdf`}
                      style={e.boton}
                    >
                      {/* @ts-ignore */}
                      {({ loading }) => (loading ? 'Preparando el PDF…' : 'Vista previa en PDF')}
                    </PDFDownloadLink>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {mensaje && (
          <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} style={{ fontSize: '0.9rem', margin: '0.9rem 0 0', color: mensaje.tipo === 'ok' ? '#047857' : '#be123c' }}>{mensaje.texto}</p>
        )}
      </div>
    </div>
  )
}
