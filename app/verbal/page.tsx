'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { useProctoring } from '@/hooks/useProctoring'
import { finalizarTestCrudo, MENSAJE_ERROR_GUARDADO } from '@/lib/finalizarTest'
import { PruebaEleccion } from '@/components/candidato/Prueba'
import { PantallaError, PantallaFin, PantallaGuardadoFallido, PantallaSiguiente } from '@/components/candidato/Estados'
import { EsqueletoPrueba } from '@/components/candidato/Esqueleto'

const TEST_ID = 'd4e5f6a7-b8c9-0123-defa-234567890123'

interface Item {
  id: string
  orden: number
  contenido: string
  opciones: string[]
  factor: string
}

export default function VerbalPage() {
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

  useEffect(() => {
    const cargarDatos = async () => {
      setError(null)
      const token = searchParams.get('token') || ''
      try {
        const response = await fetch(`/api/evaluacion/public-data?candidato=${encodeURIComponent(candidatoId || '')}&proceso=${encodeURIComponent(procesoId || '')}&token=${encodeURIComponent(token)}&test_id=${encodeURIComponent(TEST_ID)}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) { setError(payload.error || 'No se pudo cargar el test.'); setCargando(false); return }
        setItems(payload.items || [])
        if (payload.candidato) setNombreCandidato(`${payload.candidato.nombre} ${payload.candidato.apellido}`)
        setCargando(false)
      } catch {
        setError('No se pudo conectar con el servidor.')
        setCargando(false)
      }
    }
    setCargando(true)
    cargarDatos()
  }, [candidatoId, procesoId, searchParams, intentoCarga])

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
        if (prev <= 1) {
          avanzar()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [items, finalizado, avanzar])

  async function terminarTest(todasLasRespuestas: Record<string, string>, todosLosItems: Item[]) {
    if (!candidatoId || !procesoId) return
    setErrorGuardado(null)
    const token = searchParams.get('token') || ''
    // El navegador solo informa lo que el candidato eligio (indice de la opcion; null si se agoto el tiempo): el puntaje lo calcula el servidor
    const resultadoGuardado = await finalizarTestCrudo({
      candidatoId, procesoId, token, testId: TEST_ID,
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

  return (
    <PruebaEleccion
      nombre="Razonamiento Verbal"
      actual={itemActual + 1}
      total={items.length}
      categoria={item.factor === 'sinonimos' ? 'Sinónimos' :
      item.factor === 'analogias' ? 'Analogías' :
      item.factor === 'comprension' ? 'Comprensión' : 'Razonamiento verbal'}
      restante={tiempoRestante}
      limite={60}
      enunciado={item.contenido}
      opciones={item.opciones}
      elegida={seleccionada}
      onElegir={responder}
    />
  )
}
