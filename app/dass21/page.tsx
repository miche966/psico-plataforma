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
  valor: number // 0-3
  factor: string
}

const DASS21_TEST_ID = '7a8b9c0d-e1f2-4356-abcd-999999999999'

export default function Dass21Page() {
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

  useEffect(() => {
    async function cargarDatos() {
      if (!candidatoId || !procesoId) return
      setError(null)
      const token = searchParams.get('token') || ''
      try {
        const response = await fetch(`/api/evaluacion/public-data?candidato=${encodeURIComponent(candidatoId)}&proceso=${encodeURIComponent(procesoId)}&token=${encodeURIComponent(token)}&test_id=${encodeURIComponent(DASS21_TEST_ID)}`, { cache: 'no-store' })
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

  useEffect(() => {
    if (finalizado) return
    const timer = setInterval(() => {
      setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [finalizado, tiempoInicio])

  function responder(valor: number) {
    const item = items[itemActual]
    const nuevaRespuesta: Respuesta = { item_id: item.id, valor, factor: item.factor }
    const nuevasRespuestas = [...respuestas, nuevaRespuesta]
    setRespuestas(nuevasRespuestas)

    if (itemActual + 1 >= items.length) {
      terminarTest(nuevasRespuestas)
    } else {
      setItemActual(itemActual + 1)
    }
  }

  async function terminarTest(todasLasRespuestas: Respuesta[]) {
    if (!candidatoId || !procesoId) return
    setErrorGuardado(null)
    const token = searchParams.get('token') || ''
    // El navegador solo informa el valor elegido (0 a 3) y la telemetria: el servidor suma por subescala y multiplica por 2
    const resultadoGuardado = await finalizarTestCrudo({
      candidatoId, procesoId, token, testId: DASS21_TEST_ID, metricasFraude,
      respuestas: todasLasRespuestas.map(r => ({ item_id: r.item_id, valor: r.valor })),
    })
    if (resultadoGuardado.ok) setFinalizado(true)
    else setErrorGuardado(resultadoGuardado.error)
  }

  if (cargando) return <EsqueletoPrueba />
  if (error) return <PantallaError mensaje={error} onReintentar={() => { setError(null); setCargando(true); setIntentoCarga(i => i + 1) }} />
  if (errorGuardado) return <PantallaGuardadoFallido mensaje={MENSAJE_ERROR_GUARDADO} onReintentar={() => terminarTest(respuestas)} />
  if (finalizado && enEvaluacion) return <PantallaSiguiente />
  if (finalizado) return <PantallaFin nombre={nombreCandidato} />

  const item = items[itemActual]
  if (!item) return <EsqueletoPrueba />

  return (
    <PruebaEscala
      nombre="DASS-21"
      actual={itemActual + 1}
      total={items.length}
      instruccion="Por favor, lee cada afirmación e indica cuánto se ha aplicado a ti durante la última semana. No hay respuestas correctas o incorrectas."
      transcurrido={tiempoTranscurrido}
      enunciado={item.contenido}
      opciones={item.opciones}
      numerosDesde={0}
      onElegir={responder}
    />
  )
}
