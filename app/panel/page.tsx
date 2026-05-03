'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { FileText, Download, X, Search, AlertTriangle } from 'lucide-react'

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

interface Sesion {
  id: string
  finalizada_en: string
  puntaje_bruto: Record<string, unknown>
  candidato_id: string | null
  candidato?: Candidato
}

const BIG_FIVE_KEYS = ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura']

function esBigFive(pb: Record<string, unknown>): boolean {
  return BIG_FIVE_KEYS.some(k => k in pb)
}

function esCognitivo(pb: Record<string, unknown>): boolean {
  return 'correctas' in pb && 'total' in pb
}

function valoresNumericos(pb: Record<string, unknown>): [string, number][] {
  return Object.entries(pb).filter((e): e is [string, number] => typeof e[1] === 'number')
}

function promedioPuntaje(pb: Record<string, unknown>): number {
  const nums = valoresNumericos(pb).map(([, v]) => v)
  if (!nums.length) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function datosCognitivos(pb: Record<string, unknown>) {
  const correctas = Number(pb.correctas) || 0
  const total = Number(pb.total) || 1
  const pct = Math.round((correctas / total) * 100)
  return { correctas, total, pct }
}

const etiquetas: Record<string, string> = {
  extraversion: 'Extraversión',
  amabilidad: 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  neuroticismo: 'Neuroticismo',
  apertura: 'Apertura'
}

const colores: Record<string, string> = {
  extraversion: 'bg-blue-600',
  amabilidad: 'bg-green-600',
  responsabilidad: 'bg-purple-600',
  neuroticismo: 'bg-red-600',
  apertura: 'bg-orange-600'
}

const textColores: Record<string, string> = {
  extraversion: 'text-blue-600',
  amabilidad: 'text-green-600',
  responsabilidad: 'text-purple-600',
  neuroticismo: 'text-red-600',
  apertura: 'text-orange-600'
}

export default function PanelPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [cargando, setCargando] = useState(true)
  const [seleccionada, setSeleccionada] = useState<Sesion | null>(null)
  const [filtro, setFiltro] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
  }, [])

  useEffect(() => {
    cargarSesiones()
  }, [])

  async function cargarSesiones() {
    const { data: sesionesData, error } = await supabase
      .from('sesiones')
      .select('*')
      .order('finalizada_en', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const candidatoIds = sesionesData
      ?.filter(s => s.candidato_id)
      .map(s => s.candidato_id) || []

    let candidatos: Candidato[] = []

    if (candidatoIds.length > 0) {
      const { data } = await supabase
        .from('candidatos')
        .select('id, nombre, apellido, email')
        .in('id', candidatoIds)

      candidatos = data || []
    }

    const sesionesConCandidato = sesionesData?.map(sesion => ({
      ...sesion,
      candidato: candidatos.find(c => c.id === sesion.candidato_id)
    })) || []

    setSesiones(sesionesConCandidato)
    setCargando(false)
  }

  function formatearFecha(fecha: string) {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function nombreCandidato(sesion: Sesion) {
    if (sesion.candidato) {
      return `${sesion.candidato.nombre} ${sesion.candidato.apellido}`
    }
    return 'Evaluación anónima'
  }

  const sesionesFiltradas = sesiones.filter(s => 
    nombreCandidato(s).toLowerCase().includes(filtro.toLowerCase()) || 
    (s.candidato?.email || '').toLowerCase().includes(filtro.toLowerCase())
  )

  if (cargando) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Panel del evaluador</h1>
          <p className="text-sm text-slate-500 mt-1">
            {sesiones.length} evaluación{sesiones.length !== 1 ? 'es' : ''} registrada{sesiones.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/test" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2">
            Nueva evaluación
          </a>
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Buscar candidato por nombre o email..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
      </div>

      {sesiones.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <p className="text-slate-500 mb-4">No hay evaluaciones todavía.</p>
          <a href="/candidatos" className="text-indigo-600 font-medium hover:text-indigo-700">Ir a candidatos →</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-3">
            {sesionesFiltradas.map(sesion => (
              <div
                key={sesion.id}
                onClick={() => setSeleccionada(sesion)}
                className={`p-4 rounded-xl border bg-white cursor-pointer transition-all duration-200 hover:shadow-md ${
                  seleccionada?.id === sesion.id 
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-slate-900">{nombreCandidato(sesion)}</div>
                    {sesion.candidato && (
                      <div className="text-xs text-slate-500 mt-0.5">{sesion.candidato.email}</div>
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                    {formatearFecha(sesion.finalizada_en)}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  {sesion.puntaje_bruto && (() => {
                    const pb = sesion.puntaje_bruto
                    if (esBigFive(pb)) {
                      return valoresNumericos(pb).map(([factor, valor]) => (
                        <div key={factor} className="flex items-center gap-3">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 w-24 truncate">{etiquetas[factor] || factor}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colores[factor] || 'bg-indigo-500'}`} style={{ width: `${(valor / 5) * 100}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 w-6 text-right">{valor}</span>
                        </div>
                      ))
                    }
                    if (esCognitivo(pb)) {
                      const { correctas, total, pct } = datosCognitivos(pb)
                      return (
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 w-24 truncate">Aciertos</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-slate-500 w-8 text-right">{correctas}/{total}</span>
                        </div>
                      )
                    }
                    const prom = promedioPuntaje(pb)
                    return (
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 w-24 truncate">Promedio</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min((prom / 5) * 100, 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 w-6 text-right">{prom}</span>
                      </div>
                    )
                  })()}

                  {sesion.puntaje_bruto && (sesion.puntaje_bruto as any).metricas_fraude && (() => {
                    const mf = (sesion.puntaje_bruto as any).metricas_fraude
                    if (mf.tabSwitches > 0 || mf.copyPasteAttempts > 0) {
                      return (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2.5 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-red-800">Alerta Anti-Fraude</p>
                            <p className="text-[10px] text-red-600 mt-0.5">
                              Cambios de pestaña: {mf.tabSwitches} | Copy/paste: {mf.copyPasteAttempts}
                            </p>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>
            ))}
            {sesionesFiltradas.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No se encontraron resultados para la búsqueda.
              </div>
            )}
          </div>

          <div className="sticky top-6">
            {seleccionada ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{nombreCandidato(seleccionada)}</h2>
                    {seleccionada.candidato && (
                      <p className="text-sm text-slate-500 mt-0.5">{seleccionada.candidato.email}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      Completado el {formatearFecha(seleccionada.finalizada_en)}
                    </p>
                  </div>
                  <button onClick={() => setSeleccionada(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex gap-2 mb-8">
                  <a
                    href={`/informe?candidato=${seleccionada.candidato_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    Abrir Informe Interactivo
                  </a>
                  <button
                    onClick={() => generarPDF(seleccionada)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    PDF Simple
                  </button>
                </div>

                <div className="space-y-5">
                  {seleccionada.puntaje_bruto && (() => {
                    const pb = seleccionada.puntaje_bruto
                    if (esBigFive(pb)) {
                      return valoresNumericos(pb).map(([factor, valor]) => {
                        const tc = textColores[factor] || 'text-indigo-600'
                        const bgc = colores[factor] || 'bg-indigo-600'
                        return (
                          <div key={factor}>
                            <div className="flex justify-between mb-1.5">
                              <span className="text-sm font-semibold text-slate-800">{etiquetas[factor] || factor}</span>
                              <span className={`text-sm font-bold ${tc}`}>{valor} / 5</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                              <div className={`h-full rounded-full transition-all duration-500 ease-out ${bgc}`} style={{ width: `${(valor / 5) * 100}%` }} />
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{interpretacion(factor, valor)}</p>
                          </div>
                        )
                      })
                    }
                    if (esCognitivo(pb)) {
                      const { correctas, total, pct } = datosCognitivos(pb)
                      const nivel = pct >= 80 ? 'Alto' : pct >= 60 ? 'Moderado' : 'En desarrollo'
                      const colorBg = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-orange-500' : 'bg-red-500'
                      const colorText = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-orange-600' : 'text-red-600'
                      
                      return (
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-sm font-semibold text-slate-800">Resultado Cognitivo</span>
                            <span className={`text-sm font-bold ${colorText}`}>{correctas} / {total} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div className={`h-full rounded-full transition-all duration-500 ease-out ${colorBg}`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">Desempeño detectado: {nivel}</p>
                        </div>
                      )
                    }
                    const prom = promedioPuntaje(pb)
                    const colorBg = prom >= 4 ? 'bg-green-500' : prom >= 3 ? 'bg-orange-500' : 'bg-red-500'
                    const colorText = prom >= 4 ? 'text-green-600' : prom >= 3 ? 'text-orange-600' : 'text-red-600'
                    
                    return (
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-sm font-semibold text-slate-800">Promedio general</span>
                          <span className={`text-sm font-bold ${colorText}`}>{prom} / 5</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                          <div className={`h-full rounded-full transition-all duration-500 ease-out ${colorBg}`} style={{ width: `${Math.min((prom / 5) * 100, 100)}%` }} />
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {prom >= 4 ? 'Nivel alto' : prom >= 3 ? 'Nivel moderado' : 'En desarrollo'}
                        </p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center h-64">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 mb-1">Ninguna evaluación seleccionada</h3>
                <p className="text-xs text-slate-500 max-w-[200px]">Selecciona una tarjeta de la lista para ver sus resultados en detalle.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}

async function generarPDF(sesion: Sesion) {
  const nombre = sesion.candidato
    ? `${sesion.candidato.nombre} ${sesion.candidato.apellido}`
    : 'Evaluación anónima'
  const fecha = new Date(sesion.finalizada_en).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  const coloresRGB: Record<string, [number, number, number]> = {
    extraversion: [37, 99, 235],
    amabilidad: [22, 163, 74],
    responsabilidad: [147, 51, 234],
    neuroticismo: [220, 38, 38],
    apertura: [234, 88, 12]
  }

  const etiquetasPDF: Record<string, string> = {
    extraversion: 'Extraversión',
    amabilidad: 'Amabilidad',
    responsabilidad: 'Responsabilidad',
    neuroticismo: 'Neuroticismo',
    apertura: 'Apertura'
  }

  const pdfData = {
    sesion, nombre, fecha,
    helpers: {
      esBigFive, esCognitivo, valoresNumericos, promedioPuntaje, datosCognitivos,
      coloresRGB, etiquetasPDF, interpretacion
    }
  }

  try {
    const { pdf } = await import('@react-pdf/renderer')
    const { SimplePDF } = await import('@/components/SimplePDF')

    const blob = await pdf(<SimplePDF data={pdfData} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe-${nombre.replace(/ /g, '-').toLowerCase()}-${fecha.replace(/\//g, '-')}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error generando PDF:', err)
    alert('Hubo un error al generar el PDF simple.')
  }
}

function interpretacion(factor: string, valor: number): string {
  const nivel = valor >= 4 ? 'alto' : valor >= 3 ? 'moderado' : 'bajo'
  const textos: Record<string, Record<string, string>> = {
    extraversion: {
      alto: 'Persona sociable, enérgica y orientada hacia el mundo externo. Disfruta del trabajo en equipo y los entornos dinámicos.',
      moderado: 'Equilibrio entre sociabilidad y reserva. Se adapta tanto a trabajos en equipo como a tareas individuales.',
      bajo: 'Persona reservada y reflexiva. Prefiere entornos tranquilos y el trabajo independiente.'
    },
    amabilidad: {
      alto: 'Alta orientación hacia los demás, cooperativa y empática. Facilita el trabajo en equipo y las relaciones interpersonales.',
      moderado: 'Equilibrio entre cooperación y asertividad. Puede trabajar bien con otros sin perder independencia de criterio.',
      bajo: 'Persona directa y orientada a resultados. Puede ser más competitiva que colaborativa.'
    },
    responsabilidad: {
      alto: 'Alta organización, disciplina y orientación al logro. Cumple compromisos y mantiene altos estándares de trabajo.',
      moderado: 'Nivel adecuado de organización y compromiso. Puede adaptarse a distintos niveles de estructura.',
      bajo: 'Estilo flexible y espontáneo. Puede tener dificultades con tareas que requieren alta planificación.'
    },
    neuroticismo: {
      alto: 'Mayor sensibilidad emocional y tendencia a experimentar estrés. Puede requerir entornos de trabajo estables.',
      moderado: 'Respuesta emocional equilibrada ante el estrés. Maneja bien la mayoría de las situaciones laborales.',
      bajo: 'Alta estabilidad emocional y resiliencia. Maneja bien la presión y los entornos de alta demanda.'
    },
    apertura: {
      alto: 'Alta curiosidad intelectual, creatividad y apertura al cambio. Destaca en roles que requieren innovación.',
      moderado: 'Equilibrio entre creatividad y pragmatismo. Se adapta tanto a entornos estructurados como creativos.',
      bajo: 'Preferencia por métodos conocidos y entornos predecibles. Destaca en roles con procesos claros y definidos.'
    }
  }
  return textos[factor]?.[nivel] || ''
}