'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { Marco } from '@/components/candidato/Marco'
import { PantallaCarga, PantallaFin, PantallaSiguiente } from '@/components/candidato/Estados'
import { FRASES_INCOMPLETAS_ID, FRASES_ESTIMULO } from '@/lib/frasesIncompletas'

export default function FrasesIncompletasPage() {
  const [respuestas, setRespuestas] = useState<Record<number, string>>({})
  const [cargando, setCargando] = useState(true)
  const [finalizado, setFinalizado] = useState(false)
  const enEvaluacion = useEvaluacionRedirect(finalizado)
  const [nombreCandidato, setNombreCandidato] = useState('')
  const searchParams = useSearchParams()
  const candidatoId = searchParams.get('candidato')
  const procesoId = searchParams.get('proceso')
  
  const [tiempoRestante, setTiempoRestante] = useState(900) // 15 minutos en segundos
  const [prorrogaConcedida, setProrrogaConcedida] = useState(false)
  const [mensajeProrroga, setMensajeProrroga] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Cargar datos y respuestas parciales
  useEffect(() => {
    async function cargarDatos() {
      if (candidatoId && procesoId) {
        const token = searchParams.get('token') || ''
        const response = await fetch(`/api/evaluacion/public-data?candidato=${encodeURIComponent(candidatoId)}&proceso=${encodeURIComponent(procesoId)}&token=${encodeURIComponent(token)}&test_id=${encodeURIComponent(FRASES_INCOMPLETAS_ID)}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload.candidato) setNombreCandidato(`${payload.candidato.nombre} ${payload.candidato.apellido}`)

        // Intentar recuperar autoguardado local
        const saved = localStorage.getItem(`frases_draft_${candidatoId}`)
        if (saved) {
          try {
            setRespuestas(JSON.parse(saved))
          } catch (e) {
            console.error(e)
          }
        }
      }
      setCargando(false)
    }
    cargarDatos()
  }, [candidatoId, procesoId, searchParams])

  // Temporizador de cuenta regresiva
  useEffect(() => {
    if (finalizado || cargando) return
    
    const interval = setInterval(() => {
      setTiempoRestante(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          
          // Evaluar si otorgar prórroga
          const totalFrases = FRASES_ESTIMULO.length
          const respondidas = Object.values(respuestas).filter(val => val.trim().length > 0).length
          const faltantes = totalFrases - respondidas

          if (faltantes > 0 && !prorrogaConcedida) {
            setProrrogaConcedida(true)
            const minutosExtra = faltantes // 1 minuto por frase
            setMensajeProrroga(`¡Tiempo inicial agotado! Se te ha concedido una prórroga extraordinaria de ${minutosExtra} ${minutosExtra === 1 ? 'minuto' : 'minutos'} para que puedas completar las ${faltantes} ${faltantes === 1 ? 'frase restante' : 'frases restantes'}.`)
            return minutosExtra * 60
          } else {
            // Forzar envío automático
            enviarRespuestas(respuestas, true)
            return 0
          }
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [finalizado, cargando, respuestas, prorrogaConcedida])

  // Guardado en LocalStorage ante cambios
  function handleInputChange(id: number, val: string) {
    const nuevas = { ...respuestas, [id]: val }
    setRespuestas(nuevas)
    if (candidatoId) {
      localStorage.setItem(`frases_draft_${candidatoId}`, JSON.stringify(nuevas))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const contestadas = Object.values(respuestas).filter(val => val.trim().length > 0).length
    const faltantes = FRASES_ESTIMULO.length - contestadas

    if (faltantes > 0) {
      alert(`No es posible finalizar la prueba de forma manual porque te faltan completar ${faltantes} ${faltantes === 1 ? 'frase' : 'frases'}. Por favor, completa todo el test.`)
      return
    }

    await enviarRespuestas(respuestas, false)
  }

  async function enviarRespuestas(datosRespuestas: Record<number, string>, esAutomatico = false) {
    if (enviando) return
    setEnviando(true)

    try {
      if (!candidatoId || !procesoId) throw new Error('Faltan candidato o proceso en la URL')
      const token = searchParams.get('token') || ''
      const response = await fetch('/api/evaluacion/public-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize', candidato_id: candidatoId, proceso_id: procesoId, token, test_id: FRASES_INCOMPLETAS_ID, puntaje_bruto: datosRespuestas, respuestas: [] })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Error al guardar la evaluación')

      // Limpiar borrador local
      if (candidatoId) {
        localStorage.removeItem(`frases_draft_${candidatoId}`)
      }

      setFinalizado(true)
      
      if (esAutomatico) {
        alert("El tiempo de la prueba ha finalizado. Tus respuestas se han guardado automáticamente.")
      }

    } catch (err) {
      console.error("Error guardando evaluación:", err)
      alert("Hubo un problema al guardar tus respuestas. Por favor, vuelve a intentarlo.")
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return <PantallaCarga texto="Cargando la evaluación…" />
  if (finalizado && enEvaluacion) return <PantallaSiguiente />
  if (finalizado) return <PantallaFin nombre={nombreCandidato}>Tus respuestas de frases incompletas fueron registradas correctamente.</PantallaFin>

  const minutos = Math.floor(tiempoRestante / 60)
  const segundos = tiempoRestante % 60
  const tiempoCritico = tiempoRestante <= 180 // Menos de 3 minutos

  return (
    <Marco titulo="Frases incompletas">
      <div className="pp-fijo">
        <div>
          <h1 className="pp-prueba-nombre">Frases incompletas</h1>
          <p className="pp-prueba-avance">Asociación libre y proyección laboral</p>
        </div>
        <div className="pp-tiempo" data-estado={tiempoCritico ? 'alarma' : 'normal'} role="timer" aria-label={`Tiempo restante: ${minutos} minutos ${segundos} segundos`}>
          <span className="pp-tiempo-num">{minutos}:{String(segundos).padStart(2, '0')}</span>
        </div>
      </div>

      <section className="pp-aparte" aria-labelledby="pp-instrucciones">
        <h2 id="pp-instrucciones">Antes de empezar</h2>
        <ul className="pp-instrucciones">
          <li>A continuación verás {FRASES_ESTIMULO.length} frases incompletas. Completá cada una con el <strong>primer pensamiento</strong> que te venga a la mente.</li>
          <li>Intentá ser espontáneo y natural. No pienses demasiado tus respuestas.</li>
          <li>Tenés un tiempo total de <strong>15 minutos</strong>. Si el tiempo termina, tus respuestas se guardan de forma automática.</li>
          <li>No recargues la página ni cierres el portal hasta terminar la prueba.</li>
        </ul>
      </section>

      {mensajeProrroga && (
        <div className="pp-alerta pp-alerta-aviso" role="status">
          <p>{mensajeProrroga}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pp-frases">
        {FRASES_ESTIMULO.map((item) => (
          <div key={item.id} className="pp-frase">
            <label htmlFor={`frase-${item.id}`}>
              <span className="pp-frase-numero">Frase {item.id} de {FRASES_ESTIMULO.length}</span>
              <span className="pp-frase-texto">{item.texto}…</span>
            </label>
            <input
              id={`frase-${item.id}`}
              type="text"
              value={respuestas[item.id] || ''}
              onChange={(e) => handleInputChange(item.id, e.target.value)}
              placeholder="Completá la frase acá"
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              maxLength={150}
            />
          </div>
        ))}

        <button type="submit" className="pp-boton pp-boton-ancho" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Finalizar evaluación'}
        </button>
      </form>
    </Marco>
  )
}
