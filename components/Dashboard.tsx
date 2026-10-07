'use client'

import { useEffect, useRef, useState } from 'react'
import { getAdminHeaders } from '@/lib/evaluacionLink'
import { Download, X } from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'
import { EsqueletoLista } from '@/components/Esqueleto'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'

const TEST_IDS_MAP: Record<string, string> = {
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': 'bigfive',
  'f6a7b8c9-d0e1-2345-fabc-456789012345': 'icar',
  'd0e1f2a3-b4c5-6789-defa-000000000001': 'estres-laboral',
  'e1f2a3b4-c5d6-7890-efab-111222333444': 'creatividad',
  'e5f6a7b8-c9d0-1234-efab-345678901234': 'integridad',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': 'hexaco',
  'c3d4e5f6-a7b8-9012-cdef-123456789012': 'numerico',
  'd4e5f6a7-b8c9-0123-defa-234567890123': 'verbal',
  'a7b8c9d0-e1f2-3456-abcd-777777777777': 'sjt-ventas',
  'e5f6a7b8-c9d0-1234-efab-555555555555': 'tolerancia-frustracion',
  'f2a3b4c5-d6e7-8901-fabc-222333444555': 'sjt-problemas',
  'c9d0e1f2-a3b4-5678-cdef-999999999999': 'sjt-legal',
  'b2c3d4e5-f6a7-8901-bcde-222222222222': 'sjt-comercial',
  'a1b2c3d4-e5f6-7890-abcd-111111111111': 'comercial',
  'b8c9d0e1-f2a3-4567-bcde-888888888888': 'atencion-detalle',
  'f6a7b8c9-d0e1-2345-fabc-666666666666': 'sjt-atencion',
  '7a8b9c0d-e1f2-4356-abcd-999999999999': 'dass21',
  'e9b2c3d4-f5a6-7890-bcde-999999999999': 'sjt-cobranzas',
  'f7a8b9c0-d1e2-4356-abcd-888888888888': 'frases-incompletas',
  'd8e9f0a1-b2c3-4567-defa-888888888888': 'roleplay',
  'd8e9f0a1-b2c3-4567-defa-777777777777': 'roleplay_atencion',
  '0b6ade42-0c8f-4084-a4a5-9ff7869d73b6': 'iniciativa-dinamismo',
}

// Nombre de cada prueba tal como se lo muestra a quien evalua
const NOMBRE_PRUEBA: Record<string, string> = {
  bigfive: 'Big Five',
  icar: 'ICAR',
  'estres-laboral': 'Estrés laboral',
  creatividad: 'Creatividad',
  integridad: 'Integridad',
  hexaco: 'HEXACO',
  numerico: 'Razonamiento numérico',
  verbal: 'Razonamiento verbal',
  'sjt-ventas': 'SJT Ventas',
  'tolerancia-frustracion': 'Tolerancia a la frustración',
  'sjt-problemas': 'SJT Resolución de problemas',
  'sjt-legal': 'SJT Legal',
  'sjt-comercial': 'SJT Comercial',
  comercial: 'Perfil comercial',
  'atencion-detalle': 'Atención al detalle',
  'sjt-atencion': 'SJT Atención al cliente',
  dass21: 'DASS-21',
  'sjt-cobranzas': 'SJT Cobranzas',
  'frases-incompletas': 'Frases incompletas',
  roleplay: 'Roleplay con IA',
  roleplay_atencion: 'Roleplay con IA',
  'iniciativa-dinamismo': 'Iniciativa y dinamismo',
}

const SERIF = { fontFamily: 'var(--font-lectura), Georgia, serif' }

type Datos = {
  resumen: { total: number; iniciaron: number; completados: number; alertas: number; tiempoMedio: number }
  porProceso: { name: string; candidatos: number }[]
  actividad: { name: string; completados: number; hoy: boolean }[]
}

const DATOS_VACIOS: Datos = {
  resumen: { total: 0, iniciaron: 0, completados: 0, alertas: 0, tiempoMedio: 0 },
  porProceso: [],
  actividad: [],
}

export default function Dashboard() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [modalAlertasAbierto, setModalAlertasAbierto] = useState(false)
  const [alertasDetalle, setAlertasDetalle] = useState<any[]>([])
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS)
  const botonAlertasRef = useRef<HTMLButtonElement>(null)
  const botonCerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  // El modal se cierra con Escape, el foco entra al abrirlo y vuelve al botón que lo abrió
  useEffect(() => {
    if (!modalAlertasAbierto) return
    const disparador = botonAlertasRef.current
    botonCerrarRef.current?.focus()
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalAlertasAbierto(false)
      if (e.key === 'Tab') { e.preventDefault(); botonCerrarRef.current?.focus() } // el único control del modal es el botón de cerrar
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      disparador?.focus()
    }
  }, [modalAlertasAbierto])

  async function cargarEstadisticas() {
    setCargando(true)
    setError(false)
    try {
      const response = await fetch('/api/admin/estadisticas-data', {
        headers: await getAdminHeaders(),
        cache: 'no-store'
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { setError(true); return }

      const candidatos: any[] = payload.candidatos || []
      const procesos: any[] = payload.procesos || []
      if (!candidatos.length || !procesos.length) { setDatos(DATOS_VACIOS); return }

      const procesosPorId = new Map(procesos.map((p: any) => [p.id, p]))
      const sesiones: any[] = (payload.sesiones || []).map((s: any) => ({
        ...s,
        procesos: procesosPorId.get(s.proceso_id)
      }))

      // Agrupación de progreso real por candidato para estadísticas fidedignas
      const candidatosStats: Record<string, { completados: Set<string>; total: number }> = {}
      sesiones.forEach(s => {
        const cId = s.candidato_id
        if (!cId) return

        if (!candidatosStats[cId]) {
          const bateria = s.procesos?.bateria_tests || []
          candidatosStats[cId] = {
            completados: new Set(),
            total: (bateria.filter((b: string) => !b.startsWith('entrevista:')).length) || 1
          }
        }

        const slug = TEST_IDS_MAP[s.test_id] || s.test_id
        if (s.estado === 'finalizado') {
          candidatosStats[cId].completados.add(slug)
        }
      })

      let terminadosCount = 0
      Object.values(candidatosStats).forEach(c => {
        if (c.completados.size > 0 && c.completados.size >= c.total) terminadosCount++
      })

      let totalAlertas = 0
      const tiempos: number[] = []
      const listaAlertasDetalle: any[] = []

      const candidatosMap: Record<string, string> = {}
      candidatos.forEach((c: any) => {
        candidatosMap[c.id] = `${c.nombre || ''} ${c.apellido || ''}`.trim() || 'Candidato sin nombre'
      })

      sesiones.forEach(s => {
        const m = s.puntaje_bruto?.metricas_fraude as any
        const tabSwitches = m?.tabSwitches || 0
        const copyPaste = m?.copyPasteAttempts || 0
        const totalFails = tabSwitches + copyPaste

        if (totalFails > 0) {
          totalAlertas += totalFails
          const slug = TEST_IDS_MAP[s.test_id] || s.test_id
          listaAlertasDetalle.push({
            id: s.id,
            candidato: candidatosMap[s.candidato_id] || 'Candidato anónimo',
            proceso: nombreDeProcesoLegible(s.procesos?.nombre || 'Proceso de selección'),
            test: NOMBRE_PRUEBA[slug] || slug,
            tabSwitches,
            copyPaste,
            total: totalFails
          })
        }

        const inicio = s.iniciada_en || s.created_at
        if (s.finalizada_en && inicio) {
          const diff = new Date(s.finalizada_en).getTime() - new Date(inicio).getTime()
          if (diff >= 0) tiempos.push(diff / (1000 * 60)) // Minutos; una duracion negativa es un dato mal cargado
        }
      })

      listaAlertasDetalle.sort((a, b) => b.total - a.total)
      setAlertasDetalle(listaAlertasDetalle)

      const tiempoMedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0

      const porProceso = procesos.map(p => ({
        name: nombreDeProcesoLegible(p.cargo || p.nombre),
        candidatos: new Set(sesiones.filter(s => s.proceso_id === p.id).map(s => s.candidato_id)).size
      })).sort((a, b) => b.candidatos - a.candidatos).slice(0, 6)

      const iniciaron = new Set(sesiones.filter(s => s.test_id).map(s => s.candidato_id)).size

      // Últimos 7 días, contados por día local (no por día UTC: pasadas las 21 h de Uruguay el día se corría)
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const actividad = Array.from({ length: 7 }).map((_, i) => {
        const desde = new Date(hoy)
        desde.setDate(hoy.getDate() - (6 - i))
        const hasta = new Date(desde)
        hasta.setDate(desde.getDate() + 1)
        return {
          name: desde.toLocaleDateString('es-UY', { weekday: 'short' }).replace('.', ''),
          completados: sesiones.filter(s => {
            if (!s.finalizada_en) return false
            const t = new Date(s.finalizada_en).getTime()
            return t >= desde.getTime() && t < hasta.getTime()
          }).length,
          hoy: i === 6,
        }
      })

      setDatos({
        resumen: { total: candidatos.length, iniciaron, completados: terminadosCount, alertas: totalAlertas, tiempoMedio },
        porProceso,
        actividad,
      })

    } catch (err) {
      console.error('Error cargando dashboard:', err)
      setError(true)
    } finally {
      setCargando(false)
    }
  }

  async function exportarPDF() {
    const input = document.getElementById('dashboard-content')
    if (!input) return

    const canvas = await html2canvas(input, { scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgProps = pdf.getImageProperties(imgData)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save('Dashboard_Evaluaciones.pdf')
  }

  if (cargando) return <EsqueletoLista />

  if (error) {
    return (
      <div role="alert" className="py-12 text-center">
        <p className="text-slate-900 font-medium mb-1">No se pudieron cargar los indicadores.</p>
        <p className="text-sm text-slate-500 mb-4">Revisá tu conexión y probá de nuevo.</p>
        <button
          type="button"
          onClick={cargarEstadisticas}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const { resumen, porProceso, actividad } = datos
  const sinEmpezar = Math.max(0, resumen.total - resumen.iniciaron)
  const aMedias = Math.max(0, resumen.iniciaron - resumen.completados)
  const pct = (n: number) => (resumen.total ? Math.round((n / resumen.total) * 100) : 0)
  const maxActividad = Math.max(1, ...actividad.map(a => a.completados))
  const maxProceso = Math.max(1, ...porProceso.map(p => p.candidatos))
  const pasos = [
    { nombre: 'Registrados', valor: resumen.total },
    { nombre: 'Empezaron', valor: resumen.iniciaron },
    { nombre: 'Completaron toda la batería', valor: resumen.completados },
  ]

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Indicadores</h2>
        {resumen.total > 0 && (
        <button
          type="button"
          onClick={exportarPDF}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Exportar PDF
        </button>
        )}
      </div>

      {resumen.total === 0 ? (
        <p className="py-12 text-center text-slate-500">Todavía no hay candidatos. Cuando se registren, vas a ver acá su avance.</p>
      ) : (
        <div id="dashboard-content" className="space-y-8">
          <section className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-10 gap-y-5 pb-8 border-b border-slate-200" aria-label="Resumen">
            <div>
              <div className="text-4xl font-semibold leading-none tabular-nums text-slate-900" style={SERIF}>{resumen.total}</div>
              <div className="text-sm text-slate-500 mt-1">candidatos</div>
            </div>
            <div>
              <div className="text-4xl font-semibold leading-none tabular-nums text-slate-900" style={SERIF}>{resumen.completados}</div>
              <div className="text-sm text-slate-500 mt-1">completaron la batería ({pct(resumen.completados)} %)</div>
            </div>
            <div>
              <div className="text-4xl font-semibold leading-none tabular-nums text-slate-900" style={SERIF}>
                {resumen.tiempoMedio}<span className="text-xl font-normal text-slate-500"> min</span>
              </div>
              <div className="text-sm text-slate-500 mt-1">promedio por prueba</div>
            </div>
            <div>
              <div className="text-4xl font-semibold leading-none tabular-nums text-slate-900" style={SERIF}>{resumen.alertas}</div>
              {resumen.alertas > 0 ? (
                <button
                  ref={botonAlertasRef}
                  type="button"
                  onClick={() => setModalAlertasAbierto(true)}
                  className="text-sm text-slate-500 mt-1 underline decoration-dotted underline-offset-4 hover:text-slate-900 transition-colors text-left"
                >
                  alertas de integridad · ver detalle
                </button>
              ) : (
                <div className="text-sm text-slate-500 mt-1">alertas de integridad</div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
            <section aria-labelledby="dash-avance">
              <h3 id="dash-avance" className="text-lg font-semibold text-slate-900 mb-4" style={SERIF}>Avance de los candidatos</h3>
              <ul className="space-y-4">
                {pasos.map(p => (
                  <li key={p.nombre}>
                    <div className="flex justify-between gap-3 text-sm mb-1.5">
                      <span className="text-slate-700">{p.nombre}</span>
                      <span className="tabular-nums text-slate-900 font-semibold">{p.valor}<span className="font-normal text-slate-500"> · {pct(p.valor)} %</span></span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct(p.valor)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {(sinEmpezar > 0 || aMedias > 0) && (
                <p className="mt-4 text-sm text-slate-500">
                  {[sinEmpezar > 0 && `${sinEmpezar} sin empezar`, aMedias > 0 && `${aMedias} con la batería a medias`].filter(Boolean).join(' · ')}
                </p>
              )}
            </section>

            <section aria-labelledby="dash-actividad">
              <h3 id="dash-actividad" className="text-lg font-semibold text-slate-900 mb-4" style={SERIF}>Pruebas completadas, últimos 7 días</h3>
              <div
                className="flex items-end gap-2 h-40"
                role="img"
                aria-label={`Pruebas completadas por día: ${actividad.map(a => `${a.name} ${a.completados}`).join(', ')}`}
              >
                {actividad.map(a => (
                  <div key={a.name + a.hoy} className="flex-1 flex flex-col justify-end items-center h-full gap-1">
                    <span className="text-sm tabular-nums text-slate-700">{a.completados}</span>
                    <div
                      className={`w-full rounded-t-md ${a.hoy ? 'bg-marcador' : 'bg-indigo-600'}`}
                      style={{ height: `${Math.max(a.completados ? 4 : 2, (a.completados / maxActividad) * 100)}%`, opacity: a.completados ? 1 : 0.35 }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2" aria-hidden="true">
                {actividad.map(a => (
                  <span key={a.name + a.hoy} className={`flex-1 text-center text-sm ${a.hoy ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{a.hoy ? 'hoy' : a.name}</span>
                ))}
              </div>
            </section>
          </div>

          {porProceso.length > 0 && (
            <section aria-labelledby="dash-procesos" className="pt-8 border-t border-slate-200">
              <h3 id="dash-procesos" className="text-lg font-semibold text-slate-900 mb-4" style={SERIF}>Procesos con más candidatos</h3>
              <ul className="space-y-4 max-w-3xl">
                {porProceso.map(p => (
                  <li key={p.name}>
                    <div className="flex justify-between gap-4 text-sm mb-1.5">
                      <span className="text-slate-700">{p.name}</span>
                      <span className="tabular-nums text-slate-900 font-semibold shrink-0">{p.candidatos}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(p.candidatos / maxProceso) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {modalAlertasAbierto && (
        <div
          className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 p-4"
          onClick={() => setModalAlertasAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alertas-titulo"
            className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 flex justify-between items-start gap-4">
              <div>
                <h3 id="alertas-titulo" className="text-lg font-semibold text-slate-900" style={SERIF}>Alertas de integridad</h3>
                <p className="text-sm text-slate-500 mt-1">Pruebas en las que el postulante cambió de pestaña o intentó copiar y pegar.</p>
              </div>
              <button
                ref={botonCerrarRef}
                type="button"
                onClick={() => setModalAlertasAbierto(false)}
                className="p-2 -m-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Cerrar el detalle de alertas"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {alertasDetalle.length === 0 ? (
                <p className="text-center py-12 text-slate-500">No hay alertas de integridad registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th scope="col" className="pb-3 pr-4 font-medium">Postulante</th>
                        <th scope="col" className="pb-3 pr-4 font-medium">Proceso</th>
                        <th scope="col" className="pb-3 pr-4 font-medium">Prueba</th>
                        <th scope="col" className="pb-3 pr-4 font-medium text-right">Cambios de pestaña</th>
                        <th scope="col" className="pb-3 pr-4 font-medium text-right">Copiar y pegar</th>
                        <th scope="col" className="pb-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {alertasDetalle.map((a: any) => (
                        <tr key={a.id}>
                          <td className="py-3 pr-4 font-semibold text-slate-900">{a.candidato}</td>
                          <td className="py-3 pr-4 text-slate-600">{a.proceso}</td>
                          <td className="py-3 pr-4 text-slate-600">{a.test}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{a.tabSwitches || '–'}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{a.copyPaste || '–'}</td>
                          <td className="py-3 text-right">
                            <span className={`px-2 py-0.5 rounded tabular-nums font-semibold ${a.total >= 10 ? 'bg-red-50 text-red-700 border border-red-200' : 'text-slate-900'}`}>
                              {a.total}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
