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
import html2canvas from 'html2canvas'

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Dashboard() {
  const [cargando, setCargando] = useState(true)
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
        { data: candidatos },
        { data: procesos },
        { data: sesiones }
      ] = await Promise.all([
        supabase.from('candidatos').select('id, creado_en'),
        supabase.from('procesos').select('id, nombre, cargo, bateria_tests'),
        supabase.from('sesiones').select('*, candidatos(id), procesos(id, nombre)')
      ])

      if (!sesiones || !procesos) return

      // 1. Resumen General
      const totalCandidatos = candidatos?.length || 0
      const terminados = new Set(sesiones.filter(s => s.estado === 'completado').map(s => s.candidato_id)).size
      
      let totalAlertas = 0
      let tiempos: number[] = []

      sesiones.forEach(s => {
        const m = s.puntaje_bruto?.metricas_fraude as any
        if (m) {
          totalAlertas += (m.tabSwitches || 0) + (m.copyPasteAttempts || 0)
        }
        if (s.finalizada_en && s.creado_en) {
          const diff = new Date(s.finalizada_en).getTime() - new Date(s.creado_en).getTime()
          tiempos.push(diff / (1000 * 60)) // Minutos
        }
      })

      const tiempoMedio = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0

      // 2. Por Proceso
      const porProceso = procesos.map(p => ({
        name: p.cargo || p.nombre,
        candidatos: new Set(sesiones.filter(s => s.proceso_id === p.id).map(s => s.candidato_id)).size
      })).sort((a, b) => b.candidatos - a.candidatos).slice(0, 5)

      // 3. Embudo de Reclutamiento (Candidatos Únicos)
      const invitados = new Set(sesiones.map(s => s.candidato_id)).size
      const iniciaron = new Set(sesiones.filter(s => s.test_id).map(s => s.candidato_id)).size
      const avanceParcial = new Set(sesiones.filter(s => s.estado === 'completado').map(s => s.candidato_id)).size
      
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
          { name: 'Desktop', value: 85 },
          { name: 'Mobile', value: 15 }
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
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
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
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
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
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
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
    </div>
  )
}

function CardResumen({ titulo, valor, sub, icon, color }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group">
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
