'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { finalizarTestCrudo, MENSAJE_ERROR_GUARDADO } from '@/lib/finalizarTest'
import { PruebaEscala } from '@/components/candidato/Prueba'
import { PantallaCarga, PantallaError, PantallaFin, PantallaGuardadoFallido, PantallaSiguiente } from '@/components/candidato/Estados'

const TEST_ID = '0b6ade42-0c8f-4084-a4a5-9ff7869d73b6'

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

export default function IniciativaDinamismoPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemActual, setItemActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Respuesta[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intentoCarga, setIntentoCarga] = useState(0)
  const [finalizado, setFinalizado] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  const [sesionIdActual, setSesionIdActual] = useState<string | null>(null)
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

  useEffect(() => {
    async function iniciar() {
      if (!candidatoId || !procesoId) return
      setError(null)
      const token = searchParams.get('token') || ''
      try {
        const response = await fetch('/api/evaluacion/public-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', candidato_id: candidatoId, proceso_id: procesoId, token, test_id: TEST_ID }) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) { setError(payload.error || 'No se pudo iniciar el test.'); setCargando(false); return }
        if (payload.sesion?.id) { setSesionIdActual(payload.sesion.id); if (payload.alreadyCompleted) setFinalizado(true) }
        const datos = await fetch(`/api/evaluacion/public-data?candidato=${encodeURIComponent(candidatoId)}&proceso=${encodeURIComponent(procesoId)}&token=${encodeURIComponent(token)}&test_id=${encodeURIComponent(TEST_ID)}`, { cache: 'no-store' })
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
    const nuevaRespuesta: Respuesta = {
      item_id: item.id,
      valor,
      factor: item.factor
    }

    const nuevasRespuestas = [...respuestas, nuevaRespuesta]
    setRespuestas(nuevasRespuestas)

    if (itemActual + 1 >= items.length) {
      calcularResultado(nuevasRespuestas)
    } else {
      setItemActual(itemActual + 1)
    }
  }

  async function calcularResultado(todasLasRespuestas: Respuesta[]) {
    if (!sesionIdActual || !candidatoId || !procesoId) return
    setErrorGuardado(null)
    const token = searchParams.get('token') || ''
    // El navegador solo informa el valor elegido (1 a 5, sin invertir): el servidor invierte los items inversos y calcula los promedios
    const resultadoGuardado = await finalizarTestCrudo({
      candidatoId, procesoId, token, testId: TEST_ID, sesionId: sesionIdActual,
      respuestas: todasLasRespuestas.map(r => ({ item_id: r.item_id, valor: r.valor })),
    })
    if (resultadoGuardado.ok) setFinalizado(true)
    else setErrorGuardado(resultadoGuardado.error)
  }

  if (cargando) return <PantallaCarga />
  if (error) return <PantallaError mensaje={error} onReintentar={() => { setError(null); setCargando(true); setIntentoCarga(i => i + 1) }} />
  if (errorGuardado) return <PantallaGuardadoFallido mensaje={MENSAJE_ERROR_GUARDADO} onReintentar={() => calcularResultado(respuestas)} />
  if (finalizado && enEvaluacion) return <PantallaSiguiente />
  if (finalizado) return <PantallaFin nombre={nombreCandidato} />

  const item = items[itemActual]
  if (!item) return <PantallaCarga texto="Cargando la pregunta…" />

  return (
    <PruebaEscala
      nombre="Iniciativa y Dinamismo"
      actual={itemActual + 1}
      total={items.length}
      transcurrido={tiempoTranscurrido}
      limiteTotalMin={10}
      enunciado={item.contenido}
      opciones={item.opciones}
      onElegir={indice => responder(indice + 1)}
    />
  )
}
