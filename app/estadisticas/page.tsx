'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'
import { EsqueletoPagina } from '@/components/Esqueleto'
import { TEST_IDS, calcularProgresoEvaluacion } from '@/lib/progresoEvaluacion'

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
  test_id: string
  estado: string
  finalizada_en: string
  puntaje_bruto: any
}

interface Proceso {
  id: string
  nombre: string
  bateria_tests?: string[]
  competencias_requeridas?: any
}

const SERIF = { fontFamily: 'var(--font-lectura), Georgia, serif' }

function calcularMatch(pb: any, proc: any) {
  if (!pb || !proc || !proc.competencias_requeridas) return null
  
  // Mapeo básico para el cálculo rápido
  const mapping: any = {
    'extraversion': ['Extraversión', 'Liderazgo', 'Comunicación'],
    'amabilidad': ['Amabilidad', 'Trabajo en equipo', 'Orientación al cliente'],
    'responsabilidad': ['Responsabilidad', 'Orientación a resultados', 'Integridad'],
    'neuroticismo': ['Neuroticismo', 'Tolerancia a la presión', 'Autocontrol'],
    'apertura': ['Apertura', 'Adaptabilidad al cambio', 'Creatividad e innovación']
  }

  const norm: Record<string, number> = {}
  const aliasesMap: Record<string, string[]> = {
    extraversion: ['extraversion', 'Extraversión', 'extraversión', 'Extraversion', 'Extraversion_Score', 'Sociabilidad'],
    amabilidad: ['amabilidad', 'Amabilidad', 'Amabilidad_Score', 'Cordialidad', 'cordialidad', 'Afabilidad'],
    responsabilidad: ['responsabilidad', 'Responsabilidad', 'Responsabilidad_Score', 'Escrupulosidad', 'escrupulosidad', 'Organización'],
    neuroticismo: ['neuroticismo', 'Neuroticismo', 'Estabilidad_Emocional', 'Emocionalidad', 'emocionalidad', 'Afectividad'],
    apertura: ['apertura', 'Apertura', 'apertura_experiencia', 'Apertura_Score', 'Apertura a la experiencia', 'Creatividad']
  }

  Object.entries(aliasesMap).forEach(([key, aliases]) => {
    const found = aliases.find(a => pb[a] !== undefined)
    if (found) {
      let val = Number(pb[found])
      if (val > 5) val = val / 20
      norm[key] = val
    }
  })
  
  let sumMatch = 0
  let count = 0

  proc.competencias_requeridas.forEach((r: any) => {
    const factor = Object.keys(mapping).find(f => mapping[f].includes(r.nombre))
    if (factor) {
      let val = norm[factor] || 0
      if (factor === 'neuroticismo') val = 6 - val
      const ideal = r.nivel === 'A' ? 5 : r.nivel === 'B' ? 4 : 3
      const diff = Math.abs(val - ideal)
      sumMatch += Math.max(0, 1 - (diff / 3))
      count++
    }
  })

  return count > 0 ? Math.round((sumMatch / count) * 100) : null
}

type Orden = 'match' | 'progreso' | 'alertas' | 'nombre'

export default function EstadisticasPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])
  const [respuestasVideo, setRespuestasVideo] = useState<any[]>([])
  const [preguntasVideo, setPreguntasVideo] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  // Filtros y ordenamiento
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState<string>('')
  const [ordenCriterio, setOrdenCriterio] = useState<Orden>('match')
  const router = useRouter()

  useEffect(() => {
    // Sin sesion se redirige al login sin pedir datos (antes se pedian igual y fallaban con "La sesion administrativa expiro")
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      cargarDatos()
    })
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setError(false)
    try {
      const auth = await supabase.auth.getSession()
      const token = auth.data.session?.access_token
      const response = await fetch('/api/admin/estadisticas-data', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store'
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las estadísticas')
      setProcesos(payload.procesos || [])
      setVinculos(payload.vinculos || [])
      setRespuestasVideo(payload.respuestasVideo || [])
      setPreguntasVideo(payload.preguntasVideo || [])
      setCandidatos(payload.candidatos || [])
      setSesiones(payload.sesiones || [])
    } catch (err) {
      console.error('Error cargando ranking de candidatos:', err)
      setError(true)
    } finally {
      setCargando(false)
    }
  }

  // Una fila por candidato y proceso: quien esta en dos procesos aparece en los dos, cada uno con su avance
  const candidatosPorId = new Map(candidatos.map(c => [c.id, c]))
  const vistos = new Set<string>()
  const rankingList = vinculos.flatMap(v => {
    const c = candidatosPorId.get(v.candidato_id)
    const clave = `${v.candidato_id}|${v.proceso_id}`
    if (!c || vistos.has(clave)) return []
    vistos.add(clave)
    const procId: string = v.proceso_id
    const proc = procesos.find(p => p.id === procId)
    const bateria = proc?.bateria_tests || []
    // Las sesiones sin proceso (carga antigua) se toman como del unico proceso del candidato
    const sesionesDe = sesiones.filter(s => s.candidato_id === c.id && (!s.proceso_id || s.proceso_id === procId))
    const videosDe = respuestasVideo.filter(r => r.candidato_id === c.id)

    // 1. Avance de la bateria (mismo calculo que el panel, videoentrevista incluida)
    const progreso = calcularProgresoEvaluacion(bateria, sesionesDe, videosDe, preguntasVideo)
    const totalBateria = progreso.total
    const completadosCount = progreso.completados
    const progresoPct = totalBateria > 0 ? Math.round((completadosCount / totalBateria) * 100) : 0

    // 2. Match Score (Big Five Match), reducido segun el avance de la bateria
    const sBF = sesionesDe.find(s => TEST_IDS[s.test_id] === 'bigfive')
    const matchBase = sBF && sBF.puntaje_bruto ? calcularMatch(sBF.puntaje_bruto, proc) : null
    const matchScore = matchBase !== null && totalBateria > 0
      ? Math.round(matchBase * (completadosCount / totalBateria))
      : matchBase

    // 3. Role Play Score (sjt-cobranzas o sjt-atencion); null si la bateria no lo incluye
    const aplicaRP = bateria.includes('sjt-cobranzas') || bateria.includes('sjt-atencion')
    const sRP = sesionesDe.find(s => TEST_IDS[s.test_id] === 'sjt-cobranzas' || TEST_IDS[s.test_id] === 'sjt-atencion')
    let scoreRP: string | null = aplicaRP ? 'Pendiente' : null
    if (aplicaRP && sRP && sRP.estado === 'finalizado') {
      const factoresRP = Object.values(sRP.puntaje_bruto?.por_factor || {})
      if (factoresRP.length > 0) {
        const suma = factoresRP.reduce((acc: number, val: any) => acc + (Number(val) || 0), 0)
        const promRP = suma / factoresRP.length
        const escalaRP = promRP > 5 ? (promRP / 20) : promRP
        scoreRP = `${(Math.round(escalaRP * 10) / 10).toFixed(1)} / 5`
      } else if (sRP.puntaje_bruto?.puntaje !== undefined) {
        const p = Number(sRP.puntaje_bruto.puntaje)
        const escalaRP = p > 5 ? (p / 20) : p
        scoreRP = `${(Math.round(escalaRP * 10) / 10).toFixed(1)} / 5`
      } else {
        scoreRP = 'Completado'
      }
    }

    // 4. Videoentrevista: no aplica / pendiente / en curso / completada
    const aplicaVideo = bateria.some(b => b.startsWith('entrevista:'))
    const videoCompleto = aplicaVideo && progreso.testsCompletados.some(b => b.startsWith('entrevista:'))
    const estadoVideo: 'no aplica' | 'pendiente' | 'en curso' | 'completada' =
      !aplicaVideo ? 'no aplica' : videoCompleto ? 'completada' : videosDe.length > 0 ? 'en curso' : 'pendiente'

    // 5. Alertas de Proctoring
    let totalAlertas = 0
    sesionesDe.forEach(s => {
      const m = s.puntaje_bruto?.metricas_fraude as any
      if (m) totalAlertas += (m.tabSwitches || 0) + (m.copyPasteAttempts || 0)
    })

    return [{
      ...c,
      procesoId: procId,
      procesoNombre: nombreDeProcesoLegible(proc?.nombre || 'Proceso sin nombre'),
      completadosCount,
      totalBateria,
      progresoPct,
      matchScore,
      scoreRP,
      estadoVideo,
      totalAlertas
    }]
  })

  const sinProceso = candidatos.filter(c => !vinculos.some(v => v.candidato_id === c.id)).length

  // Filtrado de candidatos
  const listaFiltrada = rankingList.filter(item => {
    if (procesoSeleccionado !== 'todos' && item.procesoId !== procesoSeleccionado) return false
    if (busqueda) {
      const b = busqueda.toLowerCase()
      const nombreCompleto = `${item.nombre} ${item.apellido}`.toLowerCase()
      return nombreCompleto.includes(b) || item.email.toLowerCase().includes(b)
    }
    return true
  })

  // Ordenamiento de candidatos
  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    if (ordenCriterio === 'match') {
      // 1. Priorizar candidatos que completaron el 100% de su batería
      const aCompleto = a.progresoPct >= 100 ? 1 : 0
      const bCompleto = b.progresoPct >= 100 ? 1 : 0
      if (aCompleto !== bCompleto) return bCompleto - aCompleto
      // 2. Si ambos están en el mismo grupo de completado/incompleto, ordenar por matchScore
      return (b.matchScore || 0) - (a.matchScore || 0)
    }
    if (ordenCriterio === 'progreso') return b.progresoPct - a.progresoPct
    if (ordenCriterio === 'alertas') return b.totalAlertas - a.totalAlertas
    if (ordenCriterio === 'nombre') return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
    return 0
  })

  // Cifras de arriba
  const matchesFiltrados = listaFiltrada.map(c => c.matchScore).filter(Boolean) as number[]
  const calcePromedioProc = matchesFiltrados.length > 0
    ? Math.round(matchesFiltrados.reduce((a, b) => a + b, 0) / matchesFiltrados.length)
    : 0
  const completadosProc = listaFiltrada.filter(c => c.progresoPct >= 100).length

  if (cargando) {
    return (
      <AppLayout>
        <EsqueletoPagina />
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div role="alert" className="py-16 text-center">
          <p className="text-slate-900 font-medium mb-1">No se pudo cargar el ranking.</p>
          <p className="text-sm text-slate-500 mb-4">Revisá tu conexión y probá de nuevo.</p>
          <button
            type="button"
            onClick={cargarDatos}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </AppLayout>
    )
  }

  const colorEncaje = (n: number) => (n >= 75 ? 'bg-indigo-600' : n < 50 ? 'bg-amber-500' : 'bg-slate-500')

  return (
    <AppLayout>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Ranking de candidatos</h1>
        <p className="text-slate-500 mt-1">Ordenados por encaje con el cargo y avance de la batería</p>
      </header>

      <section className="flex flex-wrap gap-x-10 gap-y-4 pb-6" aria-label="Resumen">
        {[
          { valor: listaFiltrada.length, etiqueta: 'postulaciones' },
          { valor: `${calcePromedioProc} %`, etiqueta: 'encaje promedio' },
          { valor: completadosProc, etiqueta: 'con la batería completa' },
        ].map(c => (
          <div key={c.etiqueta}>
            <div className="text-4xl font-semibold leading-none tabular-nums text-slate-900" style={SERIF}>{c.valor}</div>
            <div className="text-sm text-slate-500 mt-1">{c.etiqueta}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2.5 pb-5">
        <input
          type="text"
          aria-label="Buscar candidato por nombre o correo"
          placeholder="Buscar por nombre o correo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 min-w-[16rem] bg-white border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600"
        />
        <select
          aria-label="Proceso a analizar"
          value={procesoSeleccionado}
          onChange={(e) => setProcesoSeleccionado(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 max-w-[16rem]"
        >
          <option value="todos">Todos los procesos</option>
          {procesos.map(p => (
            <option key={p.id} value={p.id}>{nombreDeProcesoLegible(p.nombre)}</option>
          ))}
        </select>
        <select
          aria-label="Ordenar por"
          value={ordenCriterio}
          onChange={(e) => setOrdenCriterio(e.target.value as Orden)}
          className="bg-white border border-slate-300 rounded-lg py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600"
        >
          <option value="match">Mayor encaje primero</option>
          <option value="progreso">Mayor avance primero</option>
          <option value="alertas">Más alertas primero</option>
          <option value="nombre">Nombre</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th scope="col" className="pl-5 pr-2 py-3 font-medium w-12"><span className="sr-only">Posición</span></th>
                <th scope="col" className="px-3 py-3 font-medium">Candidato</th>
                <th scope="col" className="px-3 py-3 font-medium">Avance</th>
                <th scope="col" className="px-3 py-3 font-medium">Encaje</th>
                <th scope="col" className="px-3 py-3 font-medium">Role play</th>
                <th scope="col" className="px-3 py-3 font-medium">Video</th>
                <th scope="col" className="px-3 py-3 font-medium">Alertas</th>
                <th scope="col" className="pl-3 pr-5 py-3 font-medium"><span className="sr-only">Ficha</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaOrdenada.map((item, idx) => (
                <tr key={`${item.id}-${item.procesoId}`}>
                  <td className="pl-5 pr-2 py-4 tabular-nums text-slate-500" style={SERIF}>{idx + 1}</td>

                  <td className="px-3 py-4">
                    <div className="font-semibold text-slate-900">{item.nombre} {item.apellido}</div>
                    <div className="text-slate-500">{item.email}</div>
                    <div className="text-slate-600 mt-0.5">{item.procesoNombre}</div>
                  </td>

                  <td className="px-3 py-4">
                    <div className="tabular-nums text-slate-800">{item.completadosCount} de {item.totalBateria}</div>
                    <div className="w-24 h-1.5 mt-1.5 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${item.progresoPct}%` }} />
                    </div>
                  </td>

                  <td className="px-3 py-4">
                    {item.matchScore !== null ? (
                      <>
                        <div className="text-xl font-semibold leading-none tabular-nums text-slate-900" style={SERIF}>{item.matchScore} %</div>
                        <div className="w-20 h-1.5 mt-1.5 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                          <div className={`h-full rounded-full ${colorEncaje(item.matchScore)}`} style={{ width: `${Math.min(100, item.matchScore)}%` }} />
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500">Sin Big Five</span>
                    )}
                  </td>

                  <td className="px-3 py-4 tabular-nums whitespace-nowrap">
                    {item.scoreRP === null ? <span className="text-slate-500">—</span>
                      : item.scoreRP === 'Pendiente' ? <span className="text-slate-500">Pendiente</span>
                      : <span className="text-slate-800">{item.scoreRP}</span>}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap">
                    {item.estadoVideo === 'no aplica' ? <span className="text-slate-500">—</span>
                      : item.estadoVideo === 'completada' ? <span className="text-slate-800">Completada</span>
                      : item.estadoVideo === 'en curso' ? <span className="text-slate-800">En curso</span>
                      : <span className="text-slate-500">Pendiente</span>}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap">
                    {item.totalAlertas > 0 ? (
                      <span className={`px-2 py-0.5 rounded tabular-nums font-semibold ${item.totalAlertas >= 10 ? 'bg-red-50 text-red-700 border border-red-200' : 'text-amber-700'}`}>
                        {item.totalAlertas}
                      </span>
                    ) : (
                      <span className="text-slate-500">Sin alertas</span>
                    )}
                  </td>

                  <td className="pl-3 pr-5 py-4 text-right whitespace-nowrap">
                    <Link
                      href={`/panel?candidato=${item.id}&proceso=${item.procesoId}`}
                      className="text-indigo-600 font-semibold underline underline-offset-4 hover:text-indigo-700"
                      aria-label={`Ver la ficha de ${item.nombre} ${item.apellido}`}
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
              {listaOrdenada.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No hay candidatos que coincidan con la búsqueda o el proceso elegido.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        El encaje se calcula con el Big Five frente a las competencias del cargo y baja si la batería está incompleta.
        {sinProceso > 0 && ` ${sinProceso} candidatos sin proceso asignado no aparecen en el ranking.`}
      </p>
    </AppLayout>
  )
}
