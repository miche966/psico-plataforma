'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
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

export default function ComercialPage() {
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
  const TEST_ID = 'a1b2c3d4-e5f6-7890-abcd-111111111111'
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

  // Los items y el candidato se cargan junto con la validación server-side del enlace.

  function responder(valor: number) {
    const item = items[itemActual]
    const nuevasRespuestas = [...respuestas, { item_id: item.id, valor, factor: item.factor }]
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
    const resultado = await finalizarTestCrudo({
      candidatoId, procesoId, token, testId: TEST_ID, sesionId: sesionIdActual,
      respuestas: todasLasRespuestas.map(r => ({ item_id: r.item_id, valor: r.valor })),
    })
    if (resultado.ok) setFinalizado(true)
    else setErrorGuardado(resultado.error)
  }

  if (cargando) return <EsqueletoPrueba />
  if (error) return <PantallaError mensaje={error} onReintentar={() => { setError(null); setCargando(true); setIntentoCarga(i => i + 1) }} />
  if (errorGuardado) return <PantallaGuardadoFallido mensaje={MENSAJE_ERROR_GUARDADO} onReintentar={() => calcularResultado(respuestas)} />
  if (finalizado && enEvaluacion) return <PantallaSiguiente />
  if (finalizado) return <PantallaFin nombre={nombreCandidato} />

  const item = items[itemActual]
  if (!item) return <EsqueletoPrueba />

  const factorLabel: Record<string, string> = {
    orientacion_cliente: 'Orientación al cliente',
    tolerancia_rechazo: 'Tolerancia al rechazo',
    motivacion_logro: 'Motivación de logro',
    proactividad: 'Proactividad comercial'
  }

  return (
    <PruebaEscala
      nombre="Orientación Comercial"
      actual={itemActual + 1}
      total={items.length}
      categoria={factorLabel[item.factor] || item.factor}
      transcurrido={tiempoTranscurrido}
      limiteTotalMin={15}
      enunciado={item.contenido}
      opciones={item.opciones}
      onElegir={indice => responder(indice + 1)}
    />
  )
}
