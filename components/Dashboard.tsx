'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { 
  Users, CheckCircle, AlertTriangle, Clock, TrendingDown, 
  Download, MousePointer2, Smartphone, Monitor, ChevronRight
} from 'lucide-react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Dashboard() {
  const [cargando, setCargando] = useState(true)
  const [modalAlertasAbierto, setModalAlertasAbierto] = useState(false)
  const [alertasDetalle, setAlertasDetalle] = useState<any[]>([])
  const [datos, setDatos] = useState<any>({
    resumen: { total: 0, completados: 0, alertas: 0, tiempoMedio: 0 },
    porProceso: [],
    abandono: [],
    actividad: [],
    dispositivos: []
  })

  useEffect(() => {
    cargarEstadisticas()
  }, [])

  async function cargarEstadisticas() {
    try {
      const [
        { data: candidatos, error: ce },
        { data: procesos, error: pe }
      ] = await Promise.all([
        supabase.from('candidatos').select('id, nombre, apellido, creado_en'),
        supabase.from('procesos').select('id, nombre, cargo, bateria_tests')
      ])

      if (ce || pe || !candidatos || !procesos) return

      // Chunk candidate IDs to avoid the 1000-row PostgREST select limit in Supabase
      const candidateIds = candidatos.map((c: any) => c.id)
      const chunkSize = 50
      const chunks = []
      for (let i = 0; i < candidateIds.length; i += chunkSize) {
        chunks.push(candidateIds.slice(i, i + chunkSize))
      }

      let sesiones: any[] = []
      try {
        const results = await Promise.all(
          chunks.map(chunk =>
            supabase
              .from('sesiones')
              .select('*, candidatos(id), procesos(id, nombre, bateria_tests)')
              .in('candidato_id', chunk)
          )
        )
        results.forEach(res => {
          if (res.data) sesiones = sesiones.concat(res.data)
        })
      } catch (err) {
        console.error('Error chunking dashboard sessions load:', err)
      }

      // Agrupación de progreso real por candidato para estadísticas fidedignas
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
        'b8c9d0e1-f2a3-4567-bcde-888888888888': 'atencion-detail',
        'f6a7b8c9-d0e1-2345-fabc-666666666666': 'sjt-atencion',
        '7a8b9c0d-e1f2-4356-abcd-999999999999': 'dass21',
        'e9b2c3d4-f5a6-7890-bcde-999999999999': 'sjt-cobranzas',
        'f7a8b9c0-d1e2-4356-abcd-888888888888': 'frases-incompletas',
      }

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

      let parcialesCount = 0
      let terminadosCount = 0

      Object.values(candidatosStats).forEach(c => {
        const compCount = c.completados.size
        if (compCount === 0) return

        if (compCount >= c.total) {
          terminadosCount++
        } else {
          parcialesCount++
        }
      })

      // 1. Resumen General
      const totalCandidatos = candidatos?.length || 0
      const terminados = terminadosCount
      
      let totalAlertas = 0
      let tiempos: number[] = []
      const listaAlertasDetalle: any[] = []

      // Mapa rápido de candidatos por ID
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
          const candNombre = candidatosMap[s.candidato_id] || 'Candidato Anónimo'
          const procNombre = s.procesos?.nombre || 'Proceso de Selección'
          const testNombre = TEST_IDS_MAP[s.test_id] || s.test_id

          listaAlertasDetalle.push({
            id: s.id,
            candidato: candNombre,
            proceso: procNombre,
            test: testNombre,
            tabSwitches,
            copyPaste,
            total: totalFails
          })
        }

        const inicio = s.iniciada_en || s.created_at
        if (s.finalizada_en && inicio) {
          const diff = new Date(s.finalizada_en).getTime() - new Date(inicio).getTime()
          tiempos.push(diff / (1000 * 60)) // Minutos
        }
      })

      // Ordenar alertas por criticidad
      listaAlertasDetalle.sort((a, b) => b.total - a.total)
      setAlertasDetalle(listaAlertasDetalle)

      const tiempoMedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0

      // 2. Por Proceso
      const porProceso = procesos.map(p => ({
        name: p.cargo || p.nombre,
        candidatos: new Set(sesiones.filter(s => s.proceso_id === p.id).map(s => s.candidato_id)).size
      })).sort((a, b) => b.candidatos - a.candidatos).slice(0, 5)

      // 3. Embudo de Reclutamiento (Candidatos Únicos)
      const invitados = new Set(sesiones.map(s => s.candidato_id)).size
      const iniciaron = new Set(sesiones.filter(s => s.test_id).map(s => s.candidato_id)).size
      const avanceParcial = parcialesCount
      
      const abandono = [
        { name: 'Candidatos Invitados', valor: invitados },
        { name: 'Evaluación Iniciada', valor: iniciaron },
        { name: 'Avance Parcial', valor: avanceParcial },
        { name: 'Listos para Informe', valor: terminados }
      ]

      // 4. Actividad (Últimos 7 días)
      const actividad = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        const fechaStr = d.toISOString().split('T')[0]
        return {
          name: d.toLocaleDateString('es-AR', { weekday: 'short' }),
          completados: sesiones.filter(s => s.finalizada_en?.startsWith(fechaStr)).length
        }
      })

      setDatos({
        resumen: { total: totalCandidatos, completados: terminados, alertas: totalAlertas, tiempoMedio },
        porProceso,
        abandono,
        actividad,
        dispositivos: [
          { name: 'Escritorio', value: 85 },
          { name: 'Móvil', value: 15 }
        ]
      })

    } catch (error) {
      console.error("Error cargando dashboard:", error)
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

  if (cargando) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>

  return (
    <div className="animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Indicadores Estratégicos</h2>
          <p className="text-sm text-slate-500">Métricas de rendimiento y calidad en tiempo real</p>
        </div>
        <button 
          onClick={exportarPDF}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm"
        >
          <Download className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>

      <div id="dashboard-content" className="space-y-6">
        {/* CARDS DE RESUMEN */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardResumen 
            titulo="Total Candidatos" 
            valor={datos.resumen.total} 
            sub="Histórico total" 
            icon={<Users className="w-5 h-5 text-indigo-600" />}
            color="bg-indigo-50"
          />
          <CardResumen 
            titulo="Finalizados" 
            valor={datos.resumen.completados} 
            sub={`${Math.round((datos.resumen.completados / (datos.resumen.total || 1)) * 100)}% de éxito`} 
            icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
            color="bg-emerald-50"
          />
          <CardResumen 
            titulo="Alertas Integridad" 
            valor={datos.resumen.alertas} 
            sub="Incidencias detectadas" 
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
            color="bg-amber-50"
            onClick={() => setModalAlertasAbierto(true)}
          />
          <CardResumen 
            titulo="Tiempo Medio" 
            valor={`${datos.resumen.tiempoMedio}m`} 
            sub="Por cada evaluación" 
            icon={<Clock className="w-5 h-5 text-blue-600" />}
            color="bg-blue-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ACTIVIDAD RECIENTE */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
              <MousePointer2 className="w-4 h-4 text-indigo-500" />
              Actividad Semanal (Completados)
            </h3>
            <div className="h-[300px] w-full" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={datos.actividad}>
                  <defs>
                    <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="completados" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorAct)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DISPOSITIVOS */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              Origen de Sesión
            </h3>
            <div className="h-[200px] w-full" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={datos.dispositivos}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {datos.dispositivos.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {datos.dispositivos.map((d: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2 text-slate-500">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i]}} />
                    {d.name}
                  </span>
                  <span className="font-bold text-slate-800">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TOP PROCESOS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6">Top Procesos con más Tráfico</h3>
            <div className="h-[250px] w-full" style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={datos.porProceso} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} />
                  <Tooltip cursor={{fill: 'transparent'}} />
                  <Bar dataKey="candidatos" fill="#4f46e5" radius={[0, 10, 10, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* EMBUDO DE ABANDONO */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center justify-between">
              Embudo de Finalización
              <TrendingDown className="w-4 h-4 text-slate-400" />
            </h3>
            <div className="space-y-4">
              {datos.abandono.map((p: any, i: number) => {
                const total = datos.abandono[0].valor || 1
                const pct = Math.round((p.valor / total) * 100)
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-slate-500">{p.name}</span>
                      <span className="text-indigo-600">{p.valor} cand. ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${pct}%`, opacity: 1 - (i * 0.2) }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-6 text-[10px] text-slate-400 leading-relaxed italic">
              * El abandono se calcula comparando los candidatos que inician el primer test vs los que completan la batería completa.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE DE ALERTAS */}
      {modalAlertasAbierto && (
        <div 
          className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setModalAlertasAbierto(false)}
        >
          <div 
            className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Detalle de Alertas de Integridad
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Listado de postulantes que presentaron cambios de pestaña o intentos de copiar/pegar
                </p>
              </div>
              <button 
                onClick={() => setModalAlertasAbierto(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm transition-all"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo */}
            <div className="flex-1 overflow-y-auto p-6">
              {alertasDetalle.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No se han registrado incidencias de integridad en las evaluaciones.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3 pr-4">Postulante</th>
                        <th className="pb-3 pr-4">Proceso / Cargo</th>
                        <th className="pb-3 pr-4">Evaluación</th>
                        <th className="pb-3 pr-4 text-center">Pestañas</th>
                        <th className="pb-3 pr-4 text-center">Copiar/Pegar</th>
                        <th className="pb-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {alertasDetalle.map((a: any, idx: number) => {
                        const esCritico = a.total >= 10
                        return (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="py-3 pr-4 font-bold text-slate-900">{a.candidato}</td>
                            <td className="py-3 pr-4 text-slate-500 max-w-[180px] truncate" title={a.proceso}>{a.proceso}</td>
                            <td className="py-3 pr-4">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-650 rounded text-[9px] font-bold uppercase tracking-wider">
                                {a.test}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-center font-semibold">
                              {a.tabSwitches > 0 ? (
                                <span className="text-amber-600 flex items-center justify-center gap-1 text-[11px]">
                                  ⚠️ {a.tabSwitches}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 pr-4 text-center font-semibold">
                              {a.copyPaste > 0 ? (
                                <span className="text-rose-600 flex items-center justify-center gap-1 text-[11px]">
                                  ✂️ {a.copyPaste}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 text-right font-bold">
                              <span className={`px-2 py-0.5 rounded text-[11px] ${
                                esCritico ? 'bg-red-50 text-red-700 border border-red-100 font-bold' : 'bg-slate-100 text-slate-800'
                              }`}>
                                {a.total}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pie */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setModalAlertasAbierto(false)}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CardResumen({ titulo, valor, sub, icon, color, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-3xl p-5 shadow-sm transition-all group ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 active:scale-[0.98]' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`${color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI</div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{valor}</h3>
        <p className="text-xs font-bold text-slate-800 mt-1">{titulo}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}
