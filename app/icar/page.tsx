'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { useProctoring } from '@/hooks/useProctoring'
import { finalizarTestCrudo, MENSAJE_ERROR_GUARDADO } from '@/lib/finalizarTest'
import { ListaOpciones, MarcoPrueba } from '@/components/candidato/Prueba'
import { PantallaError, PantallaFin, PantallaGuardadoFallido, PantallaSiguiente } from '@/components/candidato/Estados'
import { EsqueletoPrueba } from '@/components/candidato/Esqueleto'

const ICAR_ID = 'f6a7b8c9-d0e1-2345-fabc-456789012345'

interface Item {
  id: string
  orden: number
  contenido: string
  opciones: string[]
  factor: string
  nivel_dificultad: number
  subtipo: string
}

function MatrizVisual({ codigo }: { codigo: string }) {
  const partes = codigo.split('|')
  const filas = partes.slice(1)
  const celdas = filas.join(',').split(',')

  const renderForma = (desc: string, size: number = 28) => {
    const d = desc.toLowerCase()
    const lleno = d.includes('lleno') || (!d.includes('vac') && !d.includes('empty'))
    const color = '#17594E'
    const s = size

    if (d.includes('círculo') || d.includes('circulo')) {
      return <svg width={s} height={s} viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="10" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/>
      </svg>
    }
    if (d.includes('cuadrado')) {
      return <svg width={s} height={s} viewBox="0 0 30 30">
        <rect x="5" y="5" width="20" height="20" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/>
      </svg>
    }
    if (d.includes('triángulo') || d.includes('triangulo')) {
      return <svg width={s} height={s} viewBox="0 0 30 30">
        <polygon points="15,4 26,26 4,26" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/>
      </svg>
    }
    if (d.includes('punto')) {
      const n = parseInt(d) || 1
      const positions = [[15,15],[10,10],[20,10],[10,20],[20,20],[15,8],[8,15],[22,15],[15,22]]
      return <svg width={s} height={s} viewBox="0 0 30 30">
        {Array.from({length: Math.min(n,9)}).map((_,i) => (
          <circle key={i} cx={positions[i][0]} cy={positions[i][1]} r="3" fill={color}/>
        ))}
      </svg>
    }
    return <svg width={s} height={s} viewBox="0 0 30 30"><text x="15" y="20" textAnchor="middle" fontSize="10" fill={color}>?</text></svg>
  }

  const esInterrogante = (desc: string) => desc.trim() === '?'

  return (
    <div className="pp-matriz" role="img" aria-label="Matriz de figuras con una celda incógnita">
      {celdas.map((celda, i) => (
        <div key={i} className={esInterrogante(celda) ? 'pp-celda pp-celda-incognita' : 'pp-celda'}>
          {esInterrogante(celda) ? '?' : renderForma(celda)}
        </div>
      ))}
    </div>
  )
}

function OpcionMatriz({ texto, seleccionada, onClick }: {
  texto: string, seleccionada: boolean, onClick: () => void
}) {
  const renderForma = (desc: string) => {
    const d = desc.toLowerCase()
    const lleno = d.includes('lleno') || (!d.includes('vac') && !d.includes('empty'))
    const color = seleccionada ? '#12332E' : '#17594E'
    if (d.includes('círculo') || d.includes('circulo'))
      return <svg width="24" height="24" viewBox="0 0 30 30"><circle cx="15" cy="15" r="10" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/></svg>
    if (d.includes('cuadrado'))
      return <svg width="24" height="24" viewBox="0 0 30 30"><rect x="5" y="5" width="20" height="20" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/></svg>
    if (d.includes('triángulo') || d.includes('triangulo'))
      return <svg width="24" height="24" viewBox="0 0 30 30"><polygon points="15,4 26,26 4,26" fill={lleno ? color : 'none'} stroke={color} strokeWidth="2"/></svg>
    return <span style={{ fontSize: '11px' }}>{texto}</span>
  }

  return (
    <button type="button" className="pp-matriz-opcion" aria-pressed={seleccionada} aria-label={texto} disabled={seleccionada} onClick={onClick}>
      {renderForma(texto)}
    </button>
  )
}

function FiguraRotacion({ codigo }: { codigo: string }) {
  const tipo = codigo.split('|')[0]
  const color = '#17594E'
  
  // Mapeo de figuras basadas en el banco de ítems de ICAR
  if (tipo === 'ROTACION_A') {
    return (
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="25" y="5" width="12" height="25" fill={color}/>
        <rect x="5" y="25" width="25" height="12" fill={color}/>
        <rect x="25" y="37" width="12" height="18" fill={color}/>
      </svg>
    )
  }
  if (tipo === 'ROTACION_B') {
    return (
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="10" y="10" width="40" height="12" fill={color}/>
        <rect x="24" y="22" width="12" height="28" fill={color}/>
        <rect x="10" y="35" width="12" height="10" fill={color}/>
      </svg>
    )
  }
  if (tipo === 'ROTACION_C') {
    return (
      <svg width="60" height="60" viewBox="0 0 60 60">
        <rect x="20" y="5" width="12" height="50" fill={color}/>
        <rect x="32" y="25" width="20" height="12" fill={color}/>
        <rect x="10" y="40" width="10" height="12" fill={color}/>
      </svg>
    )
  }
  // Default/Fallback
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <rect x="20" y="20" width="20" height="20" fill={color}/>
    </svg>
  )
}

export default function IcarPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intentoCarga, setIntentoCarga] = useState(0)
  const [finalizado, setFinalizado] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const [tiempoRestante, setTiempoRestante] = useState(60)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const nivelMax = Number(searchParams.get('max')) || 3
  const sinRotacion = searchParams.get('norot') === '1'

  const metricasFraude = useProctoring()
  const [sesionIdActual, setSesionIdActual] = useState<string | null>(null)

  useEffect(() => {
    async function iniciar() {
      if (!candidatoId || !procesoId) return
      setError(null)
      const token = searchParams.get('token') || ''
      const idUrl = searchParams.get('sesion') || undefined
      try {
        const response = await fetch('/api/evaluacion/public-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start_resumable', candidato_id: candidatoId, proceso_id: procesoId, token, test_id: ICAR_ID, sesion_id: idUrl }) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) { setError(payload.error || 'No se pudo iniciar el test.'); setCargando(false); return }
        if (payload.sesion?.id) setSesionIdActual(payload.sesion.id)
        const params = new URLSearchParams({ candidato: candidatoId, proceso: procesoId, token, test_id: ICAR_ID, nivel_max: String(nivelMax) })
        if (sinRotacion) params.set('sin_rotacion', '1')
        const datos = await fetch(`/api/evaluacion/public-data?${params.toString()}`, { cache: 'no-store' })
        const info = await datos.json().catch(() => ({}))
        if (!datos.ok) { setError(info.error || 'No se pudo cargar el test.'); setCargando(false); return }
        setItems(info.items || [])
        if (info.candidato) setNombreCandidato(`${info.candidato.nombre} ${info.candidato.apellido}`)
        setCargando(false)
      } catch {
        setError('No se pudo conectar con el servidor.')
        setCargando(false)
      }
    }
    setCargando(true)
    iniciar()
  }, [candidatoId, procesoId, searchParams, nivelMax, sinRotacion, intentoCarga])

  const avanzar = useCallback((respuestaActual?: string) => {
    const item = items[itemActual]
    if (!item) return
    const nuevasRespuestas = { ...respuestas }
    if (respuestaActual) nuevasRespuestas[item.id] = respuestaActual
    setRespuestas(nuevasRespuestas)
    if (itemActual + 1 >= items.length) {
      terminarTest(nuevasRespuestas, items)
    } else {
      setItemActual(itemActual + 1)
      setTiempoRestante(60)
      setSeleccionada(null)
    }
  }, [items, itemActual, respuestas])

  useEffect(() => {
    if (items.length === 0 || finalizado) return
    const timer = setInterval(() => {
      setTiempoRestante(prev => {
        if (prev <= 1) { avanzar(); return 60 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [items, finalizado, avanzar])

  async function terminarTest(todasLasRespuestas: Record<string, string>, todosLosItems: Item[]) {
    if (!sesionIdActual || !candidatoId || !procesoId) return
    setErrorGuardado(null)
    const token = searchParams.get('token') || ''
    // El navegador solo informa lo que el candidato eligio (indice de la opcion; null si se agoto el tiempo) y la telemetria:
    // el puntaje lo calcula el servidor. El nivel maximo y la rotacion los fija el token firmado; los de la URL solo se informan
    // para los enlaces emitidos antes de esa firma.
    const resultadoGuardado = await finalizarTestCrudo({
      candidatoId, procesoId, token, testId: ICAR_ID, sesionId: sesionIdActual, metricasFraude,
      configIcar: { nivelMax, sinRotacion },
      respuestas: todosLosItems.map(item => {
        const indice = item.opciones.indexOf(todasLasRespuestas[item.id])
        return { item_id: item.id, opcion: indice >= 0 ? indice : null }
      }),
    })
    if (resultadoGuardado.ok) setFinalizado(true)
    else setErrorGuardado(resultadoGuardado.error)
  }

  function responder(opcion: string) {
    setSeleccionada(opcion)
    setTimeout(() => avanzar(opcion), 400)
  }

  if (cargando) return <EsqueletoPrueba />
  if (error) return <PantallaError mensaje={error} onReintentar={() => { setError(null); setCargando(true); setIntentoCarga(i => i + 1) }} />
  if (errorGuardado) return <PantallaGuardadoFallido mensaje={MENSAJE_ERROR_GUARDADO} onReintentar={() => terminarTest(respuestas, items)} />
  if (finalizado && enEvaluacion) return <PantallaSiguiente />
  if (finalizado) return <PantallaFin nombre={nombreCandidato} />

  const item = items[itemActual]
  if (!item) return <EsqueletoPrueba />

  const esMatriz = item.contenido.startsWith('MATRIZ_')
  const esRotacion = item.contenido.startsWith('ROTACION_')

  const nivelLabel = ['', 'Básico', 'Intermedio', 'Avanzado'][item.nivel_dificultad] || ''
  const subtipoLabel = item.subtipo === 'series' ? 'Serie numérica' : item.subtipo === 'matrices' ? 'Matriz visual' : 'Rotación mental'

  return (
    <MarcoPrueba
      nombre="ICAR — Razonamiento Abstracto"
      actual={itemActual + 1}
      total={items.length}
      categoria={`${subtipoLabel}${nivelLabel ? ` (nivel ${nivelLabel.toLowerCase()})` : ''}`}
      restante={tiempoRestante}
      limite={60}
    >
      {!esMatriz && !esRotacion && (
        <>
          <h2 className="pp-enunciado">{item.contenido}</h2>
          <ListaOpciones opciones={item.opciones} elegida={seleccionada} onElegir={responder} />
        </>
      )}

      {esMatriz && (
        <>
          <p className="pp-consigna">¿Cuál figura completa correctamente la matriz?</p>
          <MatrizVisual codigo={item.contenido} />
          <div className="pp-matriz-opciones">
            {item.opciones.map((opcion, index) => (
              <OpcionMatriz
                key={index}
                texto={opcion}
                seleccionada={seleccionada === opcion}
                onClick={() => { if (!seleccionada) responder(opcion) }}
              />
            ))}
          </div>
        </>
      )}

      {esRotacion && (
        <>
          <p className="pp-consigna">¿Cuál es la misma figura rotada?</p>
          <div className="pp-figura">
            <FiguraRotacion codigo={item.contenido} />
            <small>Original</small>
          </div>
          <ListaOpciones opciones={item.opciones} elegida={seleccionada} onElegir={responder} />
        </>
      )}
    </MarcoPrueba>
  )
}
