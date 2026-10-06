'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { useProctoring } from '@/hooks/useProctoring'
import { finalizarTestCrudo, MENSAJE_ERROR_GUARDADO } from '@/lib/finalizarTest'
import { PruebaEscala } from '@/components/candidato/Prueba'
import { PantallaError, PantallaFin, PantallaGuardadoFallido, PantallaSiguiente } from '@/components/candidato/Estados'
import { EsqueletoPrueba } from '@/components/candidato/Esqueleto'

interface Item {
  id: string
  orden: number
  contenido: string
  opciones: string[]
  factor: string
}

interface Respuesta {
  item_id: string
  valor: number
  factor: string
}

export default function TestPage() {
  const metricasFraude = useProctoring()
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const [nombreCandidato, setNombreCandidato] = useState<string>('')
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intentoCarga, setIntentoCarga] = useState(0)
  const [finalizado, setFinalizado] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [sesionIdActual, setSesionIdActual] = useState<string | null>(null)
  const BIG_FIVE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  useEffect(() => {
    setCargando(true)
    setError(null)
    initSesion()
    cargarItems()
  }, [candidatoId, procesoId, searchParams, intentoCarga])

  async function initSesion() {
    if (!candidatoId || !procesoId) return
    const token = searchParams.get('token') || ''
    const sesionId = searchParams.get('sesion') || ''
    try {
      const response = await fetch('/api/evaluacion/public-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', candidato_id: candidatoId, proceso_id: procesoId, token, sesion_id: sesionId, test_id: BIG_FIVE_ID })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { setError(payload.error || 'No se pudo iniciar el test.'); setCargando(false); return }
      if (payload.sesion?.id) setSesionIdActual(payload.sesion.id)
      if (payload.alreadyCompleted) setFinalizado(true)
    } catch {
      setError('No se pudo conectar con el servidor.')
      setCargando(false)
    }
  }

  useEffect(() => {
    // La carga se realiza junto con la validación server-side del enlace.
  }, [])

  useEffect(() => {
    if (finalizado) return
    const timer = setInterval(() => {
      setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [finalizado, tiempoInicio])

  async function cargarItems() {
    if (!candidatoId || !procesoId) return
    const token = searchParams.get('token') || ''
    try {
      const response = await fetch(`/api/evaluacion/public-data?candidato=${encodeURIComponent(candidatoId)}&proceso=${encodeURIComponent(procesoId)}&token=${encodeURIComponent(token)}&test_id=${encodeURIComponent(BIG_FIVE_ID)}`, { cache: 'no-store' })
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

  function responder(valor: number) {
    const item = items[itemActual]
    const nuevaRespuesta: Respuesta = { item_id: item.id, valor, factor: item.factor }
    const nuevasRespuestas = [...respuestas, nuevaRespuesta]
    setRespuestas(nuevasRespuestas)

    if (itemActual + 1 >= items.length) {
      calcularResultado(nuevasRespuestas)
    } else {
      setItemActual(itemActual + 1)
    }
  }

  async function calcularResultado(todasLasRespuestas: Respuesta[]) {
    if (sesionIdActual && candidatoId && procesoId) {
      setErrorGuardado(null)
      const token = searchParams.get('token') || ''
      // El navegador solo informa el valor elegido (1 a 5, sin invertir) y la telemetria: el servidor invierte los items inversos y promedia
      const resultadoGuardado = await finalizarTestCrudo({
        candidatoId, procesoId, token, testId: BIG_FIVE_ID, sesionId: sesionIdActual, metricasFraude,
        respuestas: todasLasRespuestas.map(r => ({ item_id: r.item_id, valor: r.valor })),
      })
      if (resultadoGuardado.ok) setFinalizado(true)
      else setErrorGuardado(resultadoGuardado.error)
    }
  }


  if (cargando) return <EsqueletoPrueba />
  if (error) return <PantallaError mensaje={error} onReintentar={() => { setError(null); setIntentoCarga(i => i + 1) }} />
  if (errorGuardado) return <PantallaGuardadoFallido mensaje={MENSAJE_ERROR_GUARDADO} onReintentar={() => calcularResultado(respuestas)} />
  if (finalizado && enEvaluacion) return <PantallaSiguiente />
  if (finalizado) return <PantallaFin nombre={nombreCandidato} />

  const item = items[itemActual]
  if (!item) return <EsqueletoPrueba />

  return (
    <PruebaEscala
      nombre="Cuestionario de personalidad"
      actual={itemActual + 1}
      total={items.length}
      transcurrido={tiempoTranscurrido}
      enunciado={item.contenido}
      opciones={item.opciones}
      onElegir={indice => responder(indice + 1)}
    />
  )
}
