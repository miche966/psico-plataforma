'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { finalizarTestCrudo, MENSAJE_ERROR_GUARDADO } from '@/lib/finalizarTest'
import { PruebaEscala } from '@/components/candidato/Prueba'
import { PantallaError, PantallaFin, PantallaGuardadoFallido, PantallaSiguiente } from '@/components/candidato/Estados'
import { EsqueletoPrueba } from '@/components/candidato/Esqueleto'

const TEST_ID = 'd0e1f2a3-b4c5-6789-defa-000000000001'

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

export default function EstresLaboralPage() {
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
  const [tiempoInicio] = useState(() => Date.now())
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)

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

  useEffect(() => {
    if (finalizado) return
    const timer = setInterval(() => {
      setTiempoTranscurrido(Math.floor((Date.now() - tiempoInicio) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [finalizado, tiempoInicio])


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
    if (!candidatoId || !procesoId) return
    setErrorGuardado(null)
    const token = searchParams.get('token') || ''
    // El navegador solo informa el valor elegido (1 a 5, sin invertir): el servidor invierte los items inversos y calcula los promedios
    const resultadoGuardado = await finalizarTestCrudo({
      candidatoId, procesoId, token, testId: TEST_ID,
      respuestas: todasLasRespuestas.map(r => ({ item_id: r.item_id, valor: r.valor })),
    })
    if (resultadoGuardado.ok) setFinalizado(true)
    else setErrorGuardado(resultadoGuardado.error)
  }

  if (cargando) return <EsqueletoPrueba />
  if (error) return <PantallaError mensaje={error} onReintentar={() => { setError(null); setCargando(true); setIntentoCarga(i => i + 1) }} />
  if (errorGuardado) return <PantallaGuardadoFallido mensaje={MENSAJE_ERROR_GUARDADO} onReintentar={() => calcularResultado(respuestas)} />
  if (finalizado && enEvaluacion) return <PantallaSiguiente />
  if (finalizado) return <PantallaFin nombre={nombreCandidato} />

  const item = items[itemActual]
  if (!item) return <EsqueletoPrueba />

  const factorLabel: Record<string, string> = {
    carga_laboral: 'Carga laboral',
    relaciones: 'Relaciones interpersonales',
    claridad_rol: 'Claridad de rol',
    equilibrio: 'Equilibrio vida-trabajo',
    burnout: 'Bienestar y burnout'
  }

  return (
    <PruebaEscala
      nombre="Evaluación de Estrés Laboral"
      actual={itemActual + 1}
      total={items.length}
      categoria={factorLabel[item.factor] || item.factor}
      instruccion="¿Con qué frecuencia experimentás esta situación en tu trabajo?"
      transcurrido={tiempoTranscurrido}
      limiteTotalMin={15}
      enunciado={item.contenido}
      opciones={item.opciones}
      onElegir={indice => responder(indice + 1)}
    />
  )
}
