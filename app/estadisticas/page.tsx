'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { BarChart3, PieChart, TrendingUp } from 'lucide-react'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

interface Sesion {
  id: string
  candidato_id: string | null
  proceso_id?: string | null
  finalizada_en: string
  puntaje_bruto: Record<string, number>
  candidato?: Candidato
}

interface Proceso {
  id: string
  nombre: string
}

const factores = ['apertura', 'amabilidad', 'extraversion', 'neuroticismo', 'responsabilidad']
const etiquetas: Record<string, string> = {
  extraversion: 'Extraversión',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  neuroticismo: 'Neuroticismo',
  apertura: 'Apertura'
}
const coloresHex: Record<string, string> = {
  extraversion: '#2563eb', // blue-600
  amabilidad: '#16a34a', // green-600
  responsabilidad: '#9333ea', // purple-600
  neuroticismo: '#dc2626', // red-600
  apertura: '#ea580c' // orange-600
}
const coloresBg: Record<string, string> = {
  extraversion: 'bg-blue-600',
  amabilidad: 'bg-green-600',
  responsabilidad: 'bg-purple-600',
  neuroticismo: 'bg-red-600',
  apertura: 'bg-orange-600'
}
const coloresText: Record<string, string> = {
  extraversion: 'text-blue-700',
  amabilidad: 'text-green-700',
  responsabilidad: 'text-purple-700',
  neuroticismo: 'text-red-700',
  apertura: 'text-orange-700'
}
const coloresBadge: Record<string, string> = {
  extraversion: 'bg-blue-50 text-blue-700 border-blue-200',
  amabilidad: 'bg-green-50 text-green-700 border-green-200',
  responsabilidad: 'bg-purple-50 text-purple-700 border-purple-200',
  neuroticismo: 'bg-red-50 text-red-700 border-red-200',
  apertura: 'bg-orange-50 text-orange-700 border-orange-200'
}

export default function EstadisticasPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<'comparacion' | 'promedios' | 'radar'>('comparacion')
  const [sesionRadar, setSesionRadar] = useState<Sesion | null>(null)
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<string>('todos')
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

    const { data: procesosData } = await supabase
      .from('procesos')
      .select('id, nombre')
      .order('creado_en', { ascending: false })
      
    if (procesosData) setProcesos(procesosData)

    const resultadoCompleto = sesionesData.map(s => ({
      ...s,
      candidato: candidatos.find(c => c.id === s.candidato_id)
    }))

    // AGRUPAR POR CANDIDATO (Quedarse con la sesión más reciente que tenga datos de personalidad)
    const grupos: Record<string, Sesion> = {}
    
    resultadoCompleto.forEach(s => {
      const cId = s.candidato_id || 'anonimo'
      
      // Si no tenemos este candidato aún, o si esta sesión es más reciente que la guardada
      // PRIORIDAD: Sesiones que tienen factores de personalidad (no solo ceros)
      const tieneDatos = factores.some(f => (s.puntaje_bruto[f] || 0) > 0)
      const existenteTieneDatos = grupos[cId] ? factores.some(f => (grupos[cId].puntaje_bruto[f] || 0) > 0) : false

      if (!grupos[cId]) {
        grupos[cId] = s
      } else {
        // Si la nueva tiene datos y la vieja no, reemplazamos
        if (tieneDatos && !existenteTieneDatos) {
          grupos[cId] = s
        } 
        // Si ambas tienen (o no tienen) datos, nos quedamos con la más reciente
        else if (new Date(s.finalizada_en) > new Date(grupos[cId].finalizada_en)) {
          // Solo reemplazamos si no estamos perdiendo datos útiles
          if (tieneDatos || !existenteTieneDatos) {
            grupos[cId] = s
          }
        }
      }
    })

    const resultadoFinal = Object.values(grupos).sort((a, b) => 
      new Date(b.finalizada_en).getTime() - new Date(a.finalizada_en).getTime()
    )

    setSesiones(resultadoFinal)
    if (resultadoFinal.length > 0) setSesionRadar(resultadoFinal[0])
    setCargando(false)
  }

  const sesionesFiltradas = procesoSeleccionado === 'todos' 
    ? sesiones 
    : sesiones.filter(s => s.proceso_id === procesoSeleccionado)

  function promedios() {
    if (sesionesFiltradas.length === 0) return {}
    const sumas: Record<string, number> = {}
    factores.forEach(f => { sumas[f] = 0 })
    sesionesFiltradas.forEach(s => {
      if (s.puntaje_bruto) {
        factores.forEach(f => { sumas[f] += s.puntaje_bruto[f] || 0 })
      }
    })
    const result: Record<string, number> = {}
    factores.forEach(f => {
      result[f] = Math.round((sumas[f] / sesionesFiltradas.length) * 10) / 10
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

    const cx = 200, cy = 200, r = 140
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
      ctx.strokeStyle = '#f1f5f9'
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
      ctx.fillStyle = '#64748b'
      ctx.font = '600 11px Inter, sans-serif'
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
    ctx.fillStyle = 'rgba(148, 163, 184, 0.15)'
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
    ctx.fillStyle = 'rgba(79, 70, 229, 0.15)'
    ctx.fill()
    ctx.strokeStyle = '#4f46e5'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  if (cargando) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </AppLayout>
    )
  }

  const prom = promedios()

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Estadísticas y Análisis</h1>
          <p className="text-sm text-slate-500 mt-1">
            Basado en {sesionesFiltradas.length} evaluación{sesionesFiltradas.length !== 1 ? 'es' : ''} en total
          </p>
        </div>
        <div>
          <select
            value={procesoSeleccionado}
            onChange={(e) => {
              setProcesoSeleccionado(e.target.value)
              const sf = e.target.value === 'todos' ? sesiones : sesiones.filter(s => s.proceso_id === e.target.value)
              if (sf.length > 0 && !sf.find(s => s.id === sesionRadar?.id)) {
                setSesionRadar(sf[0])
              } else if (sf.length === 0) {
                setSesionRadar(null)
              }
            }}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="todos">Todos los procesos</option>
            {procesos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-slate-100 p-1 rounded-xl flex gap-1 w-fit mb-8 shadow-sm">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'comparacion' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('comparacion')}
        >
          <BarChart3 className="w-4 h-4" /> Comparación
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'promedios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('promedios')}
        >
          <TrendingUp className="w-4 h-4" /> Promedios Globales
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
            vista === 'radar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setVista('radar')}
        >
          <PieChart className="w-4 h-4" /> Gráfico Radar
        </button>
      </div>

      {vista === 'comparacion' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Candidato</th>
                  {factores.map(f => (
                    <th key={f} className={`px-5 py-3 text-xs font-bold uppercase tracking-wider ${coloresText[f]}`}>
                      {etiquetas[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sesionesFiltradas.map(sesion => (
                  <tr key={sesion.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{nombreCandidato(sesion)}</div>
                      {sesion.candidato && <div className="text-xs text-slate-500 mt-0.5">{sesion.candidato.email}</div>}
                    </td>
                    {factores.map(f => {
                      const val = sesion.puntaje_bruto?.[f] || 0
                      const nivel = val >= 4 ? 'Alto' : val >= 3 ? 'Medio' : 'Bajo'
                      return (
                        <td key={f} className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${coloresBadge[f]}`}>
                              {nivel}
                            </span>
                            <span className="text-sm font-bold text-slate-700">{val}</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {sesiones.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                      No hay datos suficientes para mostrar estadísticas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vista === 'promedios' && (
        <div className="max-w-3xl">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <p className="text-sm text-slate-500 mb-8 font-medium">
              Promedio ponderado basado en {sesionesFiltradas.length} evaluación{sesionesFiltradas.length !== 1 ? 'es' : ''} registrada{sesionesFiltradas.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-6">
              {factores.map(f => (
                <div key={f} className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-700 w-32 shrink-0">{etiquetas[f]}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${coloresBg[f]}`}
                      style={{ width: `${((prom[f] || 0) / 5) * 100}%` }} 
                    />
                  </div>
                  <span className={`text-sm font-bold w-8 text-right ${coloresText[f]}`}>{prom[f] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {vista === 'radar' && (
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-full md:w-1/3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-3">Seleccionar Candidato:</label>
            <select
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={sesionRadar?.id || ''}
              onChange={e => {
                const found = sesionesFiltradas.find(s => s.id === e.target.value)
                if (found) {
                  setSesionRadar(found)
                }
              }}
            >
              {sesionesFiltradas.map(s => (
                <option key={s.id} value={s.id}>{nombreCandidato(s)}</option>
              ))}
            </select>
            
            <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Leyenda del Gráfico</h4>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-indigo-600 shadow-sm shadow-indigo-600/30"></div>
                <span className="text-sm font-semibold text-slate-700">
                  {sesionRadar ? nombreCandidato(sesionRadar) : 'Candidato'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                <span className="text-sm font-medium text-slate-500">Promedio global ({sesionesFiltradas.length} evals)</span>
              </div>
            </div>
          </div>
          
          <div className="w-full md:w-2/3 flex justify-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-50 rounded-tr-full -z-10"></div>
            <canvas ref={canvasRef} width={400} height={400} className="max-w-full" />
          </div>
        </div>
      )}
    </AppLayout>
  )
}