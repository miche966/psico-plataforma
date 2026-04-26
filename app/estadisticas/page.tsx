'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

interface Sesion {
  id: string
  candidato_id: string | null
  finalizada_en: string
  puntaje_bruto: Record<string, number>
  candidato?: Candidato
}

const factores = ['apertura', 'amabilidad', 'extraversion', 'neuroticismo', 'responsabilidad']
const etiquetas: Record<string, string> = {
  extraversion: 'Extraversión',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  neuroticismo: 'Neuroticismo',
  apertura: 'Apertura'
}
const colores: Record<string, string> = {
  extraversion: '#2563eb',
  amabilidad: '#16a34a',
  responsabilidad: '#9333ea',
  neuroticismo: '#dc2626',
  apertura: '#ea580c'
}

export default function EstadisticasPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<'comparacion' | 'promedios' | 'radar'>('comparacion')
  const [sesionRadar, setSesionRadar] = useState<Sesion | null>(null)
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarDatos()
  }, [])

  useEffect(() => {
    if (vista === 'radar' && sesionRadar && canvasRef.current) {
      dibujarRadar()
    }
  }, [vista, sesionRadar])

  async function cargarDatos() {
    const { data: sesionesData } = await supabase
      .from('sesiones')
      .select('*')
      .not('puntaje_bruto', 'is', null)
      .order('finalizada_en', { ascending: false })

    if (!sesionesData) { setCargando(false); return }

    const ids = sesionesData.filter(s => s.candidato_id).map(s => s.candidato_id)
    let candidatos: Candidato[] = []

    if (ids.length > 0) {
      const { data } = await supabase
        .from('candidatos')
        .select('id, nombre, apellido, email')
        .in('id', ids)
      candidatos = data || []
    }

    const resultado = sesionesData.map(s => ({
      ...s,
      candidato: candidatos.find(c => c.id === s.candidato_id)
    }))

    setSesiones(resultado)
    if (resultado.length > 0) setSesionRadar(resultado[0])
    setCargando(false)
  }

  function promedios() {
    if (sesiones.length === 0) return {}
    const sumas: Record<string, number> = {}
    factores.forEach(f => { sumas[f] = 0 })
    sesiones.forEach(s => {
      if (s.puntaje_bruto) {
        factores.forEach(f => { sumas[f] += s.puntaje_bruto[f] || 0 })
      }
    })
    const result: Record<string, number> = {}
    factores.forEach(f => {
      result[f] = Math.round((sumas[f] / sesiones.length) * 10) / 10
    })
    return result
  }

  function nombreCandidato(s: Sesion) {
    return s.candidato ? `${s.candidato.nombre} ${s.candidato.apellido}` : 'Anónimo'
  }

  function dibujarRadar() {
    const canvas = canvasRef.current
    if (!canvas || !sesionRadar?.puntaje_bruto) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cx = 200, cy = 200, r = 150
    const n = factores.length
    ctx.clearRect(0, 0, 400, 400)

    for (let level = 1; level <= 5; level++) {
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const angle = (i * 2 * Math.PI / n) - Math.PI / 2
        const x = cx + (r * level / 5) * Math.cos(angle)
        const y = cy + (r * level / 5) * Math.sin(angle)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
      ctx.strokeStyle = '#e2e8f0'
      ctx.stroke()

      const lx = cx + (r + 25) * Math.cos(angle)
      const ly = cy + (r + 25) * Math.sin(angle)
      ctx.fillStyle = '#475569'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(etiquetas[factores[i]], lx, ly)
    }

    const prom = promedios()

    // Dibujar promedio general
    ctx.beginPath()
    factores.forEach((f, i) => {
      const val = prom[f] || 0
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      const x = cx + (r * val / 5) * Math.cos(angle)
      const y = cy + (r * val / 5) * Math.sin(angle)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(100, 116, 139, 0.15)'
    ctx.fill()
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Dibujar candidato seleccionado
    ctx.beginPath()
    factores.forEach((f, i) => {
      const val = sesionRadar.puntaje_bruto[f] || 0
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2
      const x = cx + (r * val / 5) * Math.cos(angle)
      const y = cy + (r * val / 5) * Math.sin(angle)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(37, 99, 235, 0.2)'
    ctx.fill()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  if (cargando) return <div style={s.centro}><p>Cargando estadísticas...</p></div>

  const prom = promedios()

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <h1 style={s.titulo}>Estadísticas</h1>
          <p style={s.subtitulo}>{sesiones.length} evaluación{sesiones.length !== 1 ? 'es' : ''} en total</p>
        </div>
        <a href="/panel" style={s.botonSecundario}>← Panel</a>
      </div>

      <div style={s.tabs}>
        {(['comparacion', 'promedios', 'radar'] as const).map(v => (
          <button
            key={v}
            style={{ ...s.tab, ...(vista === v ? s.tabActivo : {}) }}
            onClick={() => setVista(v)}
          >
            {v === 'comparacion' ? 'Comparación' : v === 'promedios' ? 'Promedios' : 'Radar'}
          </button>
        ))}
      </div>

      {vista === 'comparacion' && (
        <div>
          <table style={s.tabla}>
            <thead>
              <tr>
                <th style={s.th}>Candidato</th>
                {factores.map(f => (
                  <th key={f} style={{ ...s.th, color: colores[f] }}>{etiquetas[f]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sesiones.map(sesion => (
                <tr key={sesion.id} style={s.tr}>
                  <td style={s.td}>
                    <div style={s.nombreCandidato}>{nombreCandidato(sesion)}</div>
                    {sesion.candidato && <div style={s.emailCandidato}>{sesion.candidato.email}</div>}
                  </td>
                  {factores.map(f => {
                    const val = sesion.puntaje_bruto?.[f] || 0
                    const nivel = val >= 4 ? 'Alto' : val >= 3 ? 'Medio' : 'Bajo'
                    return (
                      <td key={f} style={s.td}>
                        <div style={s.celdaFactor}>
                          <span style={{ ...s.nivelBadge, background: colores[f] + '20', color: colores[f] }}>
                            {nivel}
                          </span>
                          <span style={s.valorFactor}>{val}</span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vista === 'promedios' && (
        <div style={s.promediosContenedor}>
          <p style={s.promediosDesc}>
            Promedio de {sesiones.length} evaluación{sesiones.length !== 1 ? 'es' : ''} registrada{sesiones.length !== 1 ? 's' : ''}
          </p>
          {factores.map(f => (
            <div key={f} style={s.factorRow}>
              <span style={s.factorNombre}>{etiquetas[f]}</span>
              <div style={s.barraFondo}>
                <div style={{
                  ...s.barraRelleno,
                  width: `${((prom[f] || 0) / 5) * 100}%`,
                  background: colores[f]
                }} />
              </div>
              <span style={{ ...s.factorValor, color: colores[f] }}>{prom[f] || 0}</span>
            </div>
          ))}
        </div>
      )}

      {vista === 'radar' && (
        <div style={s.radarContenedor}>
          <div style={s.radarSelector}>
            <label style={s.label}>Candidato:</label>
            <select
              style={s.select}
              onChange={e => {
                const found = sesiones.find(s => s.id === e.target.value)
                if (found) {
                  setSesionRadar(found)
                  setTimeout(dibujarRadar, 50)
                }
              }}
            >
              {sesiones.map(s => (
                <option key={s.id} value={s.id}>{nombreCandidato(s)}</option>
              ))}
            </select>
          </div>
          <div style={s.radarWrap}>
            <canvas ref={canvasRef} width={400} height={400} />
          </div>
          <div style={s.leyenda}>
            <div style={s.leyendaItem}>
              <div style={{ ...s.leyendaDot, background: '#2563eb' }} />
              <span>{sesionRadar ? nombreCandidato(sesionRadar) : 'Candidato'}</span>
            </div>
            <div style={s.leyendaItem}>
              <div style={{ ...s.leyendaDot, background: '#94a3b8' }} />
              <span>Promedio general</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '1000px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' } as React.CSSProperties,
  subtitulo: { fontSize: '0.875rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  botonSecundario: { padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', textDecoration: 'none' } as React.CSSProperties,
  tabs: { display: 'flex', gap: '4px', marginBottom: '1.5rem', background: '#f1f5f9', padding: '4px', borderRadius: '10px', width: 'fit-content' } as React.CSSProperties,
  tab: { padding: '0.5rem 1.25rem', border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer', background: 'transparent', color: '#64748b', fontFamily: 'sans-serif' } as React.CSSProperties,
  tabActivo: { background: '#fff', color: '#1e293b', fontWeight: '500', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as React.CSSProperties,
  tabla: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.875rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.75rem 1rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '500', fontSize: '0.75rem', textTransform: 'uppercase' as const } as React.CSSProperties,
  tr: { borderBottom: '1px solid #f1f5f9' } as React.CSSProperties,
  td: { padding: '0.875rem 1rem', color: '#1e293b', verticalAlign: 'middle' as const } as React.CSSProperties,
  nombreCandidato: { fontSize: '0.875rem', fontWeight: '500', color: '#1e293b' } as React.CSSProperties,
  emailCandidato: { fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' } as React.CSSProperties,
  celdaFactor: { display: 'flex', alignItems: 'center', gap: '6px' } as React.CSSProperties,
  nivelBadge: { fontSize: '10px', padding: '2px 6px', borderRadius: '99px', fontWeight: '500' } as React.CSSProperties,
  valorFactor: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' } as React.CSSProperties,
  promediosContenedor: { maxWidth: '600px' } as React.CSSProperties,
  promediosDesc: { fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' } as React.CSSProperties,
  factorRow: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' } as React.CSSProperties,
  factorNombre: { fontSize: '0.875rem', color: '#1e293b', minWidth: '130px' } as React.CSSProperties,
  barraFondo: { flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' } as React.CSSProperties,
  barraRelleno: { height: '100%', borderRadius: '4px', transition: 'width 0.3s ease' } as React.CSSProperties,
  factorValor: { fontSize: '0.875rem', fontWeight: '600', minWidth: '30px', textAlign: 'right' as const } as React.CSSProperties,
  radarContenedor: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1rem' } as React.CSSProperties,
  radarSelector: { display: 'flex', alignItems: 'center', gap: '0.75rem', alignSelf: 'flex-start' as const } as React.CSSProperties,
  label: { fontSize: '0.875rem', color: '#475569', fontWeight: '500' } as React.CSSProperties,
  select: { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: '#fff' } as React.CSSProperties,
  radarWrap: { background: '#f8fafc', borderRadius: '16px', padding: '1rem', border: '1px solid #e2e8f0' } as React.CSSProperties,
  leyenda: { display: 'flex', gap: '1.5rem' } as React.CSSProperties,
  leyendaItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#64748b' } as React.CSSProperties,
  leyendaDot: { width: '10px', height: '10px', borderRadius: '50%' } as React.CSSProperties,
}