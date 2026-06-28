'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { useEvaluacionRedirect } from '@/lib/useEvaluacionRedirect'
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'

const FRASES_ESTIMULO: { id: number, texto: string }[] = [
  { id: 1, texto: 'Siempre me gustó' },
  { id: 2, texto: 'Cuando me enfrento a varias opciones' },
  { id: 3, texto: 'Lo más importante en la vida es' },
  { id: 4, texto: 'Siempre me preocupó' },
  { id: 5, texto: 'Creo que soy hábil para' },
  { id: 6, texto: 'Lo más difícil para mí es' },
  { id: 7, texto: 'Controlarme es muy difícil para mí cuando' },
  { id: 8, texto: 'Cuando las cosas no se dan como yo esperaba' },
  { id: 9, texto: 'En un grupo yo' },
  { id: 10, texto: 'En el futuro me veo' },
  { id: 11, texto: 'Nunca imaginé que yo' },
  { id: 12, texto: 'Me fastidia' },
  { id: 13, texto: 'No sé explicar por qué todos dicen' },
  { id: 14, texto: 'No estoy de acuerdo' },
  { id: 15, texto: 'Me aburre' },
  { id: 16, texto: 'El mayor cambio de mi vida' },
  { id: 17, texto: 'Cuando me enfrento a un cambio' },
  { id: 18, texto: 'Este cargo significa para mí' },
  { id: 19, texto: 'Mis jefes' },
  { id: 20, texto: 'Me gusta trabajar con' },
  { id: 21, texto: 'Mi mayor desafío ha sido' },
  { id: 22, texto: 'En síntesis, yo' }
]

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
    if (candidatoId) {
      supabase.from('candidatos').select('nombre, apellido')
        .eq('id', candidatoId).single()
        .then(({ data }) => { 
          if (data) setNombreCandidato(`${data.nombre} ${data.apellido}`) 
        })
      
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
  }, [candidatoId])

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
      // Registrar la sesión finalizada en Supabase
      const { error } = await supabase.from('sesiones').insert({
        test_id: 'f7a8b9c0-d1e2-4356-abcd-888888888888',
        candidato_id: candidatoId || null,
        proceso_id: procesoId || null,
        estado: 'finalizado',
        iniciada_en: new Date(Date.now() - (900 - tiempoRestante) * 1000).toISOString(),
        finalizada_en: new Date().toISOString(),
        puntaje_bruto: datosRespuestas
      })

      if (error) throw error

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

  if (cargando) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <p className="text-slate-500 font-medium">Cargando evaluación...</p>
      </div>
    )
  }

  if (finalizado && enEvaluacion) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 font-sans">
        <p className="text-slate-500 font-medium animate-pulse">Guardando y redirigiendo...</p>
      </div>
    )
  }

  if (finalizado) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-slate-100">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Evaluación Completada</h1>
          {nombreCandidato && <p className="text-slate-600 mb-6">Gracias, <strong>{nombreCandidato}</strong>.</p>}
          <p className="text-slate-500 text-sm mb-8">Tus respuestas de frases incompletas fueron registradas correctamente.</p>
        </div>
      </div>
    )
  }

  const minutos = Math.floor(tiempoRestante / 60)
  const segundos = tiempoRestante % 60
  const tiempoCritico = tiempoRestante <= 180 // Menos de 3 minutos

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
        
        {/* HEADER FLOTANTE DEL TEST */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-200 flex justify-between items-center z-10">
          <div>
            <h1 className="text-lg font-black text-slate-900">Frases Incompletas</h1>
            <p className="text-xs text-slate-400 font-medium">Asociación libre y proyección laboral</p>
          </div>
          
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-sm transition-colors ${
            tiempoCritico 
              ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' 
              : 'bg-indigo-50 border-indigo-100 text-indigo-700'
          }`}>
            <Clock className="w-4 h-4" />
            <span>{minutos}:{String(segundos).padStart(2, '0')}</span>
          </div>
        </div>

        {/* INSTRUCCIONES */}
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 text-slate-600 space-y-3">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Instrucciones de la Prueba:
          </p>
          <ul className="text-xs space-y-2 pl-4 list-disc text-slate-500 leading-relaxed">
            <li>A continuación verás 22 frases incompletas. Completa cada una de ellas con el <strong>primer pensamiento</strong> que te venga a la mente.</li>
            <li>Intenta ser espontáneo y natural. No pienses demasiado tus respuestas.</li>
            <li>Dispones de un tiempo total de <strong>15 minutos</strong>. Si el tiempo finaliza, tus respuestas se guardarán de forma automática.</li>
            <li>No recargues la página ni cierres el portal hasta finalizar la prueba.</li>
          </ul>
        </div>

        {mensajeProrroga && (
          <div className="mx-6 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800 animate-pulse">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="text-xs font-semibold leading-relaxed">
              {mensajeProrroga}
            </div>
          </div>
        )}

        {/* FORMULARIO DE FRASES */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          <div className="space-y-6">
            {FRASES_ESTIMULO.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 p-4 bg-slate-50/40 border border-slate-100 rounded-2xl hover:border-slate-200 transition-colors">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Frase {item.id} de {FRASES_ESTIMULO.length}
                </label>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <span className="text-sm font-bold text-slate-800 shrink-0">
                    {item.texto}...
                  </span>
                  <input
                    type="text"
                    value={respuestas[item.id] || ''}
                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                    placeholder="Completa la frase aquí..."
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                    spellCheck="false"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    maxLength={150}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={enviando}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none"
            >
              {enviando ? 'Guardando...' : 'Finalizar Evaluación'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
