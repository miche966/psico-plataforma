import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export function useEvaluacionRedirect(finalizado: boolean): boolean {
  const router = useRouter()
  const searchParams = useSearchParams()
  const evaluacion = searchParams.get('evaluacion')
  const candidato = searchParams.get('candidato')
  const proceso = searchParams.get('proceso')

  useEffect(() => {
    if (!finalizado) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
      }
      
      let lastBlurTime = 0
      const handleBlur = () => { lastBlurTime = Date.now() }
      const handleFocus = () => {
        if (lastBlurTime && (Date.now() - lastBlurTime) > 2000) {
          alert("Recordatorio: Toda salida de la pestaña o actividad inusual queda registrada en el sistema de auditoría. Por favor, completa el test sin distracciones.")
        }
        lastBlurTime = 0
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      window.addEventListener('blur', handleBlur)
      window.addEventListener('focus', handleFocus)
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('blur', handleBlur)
        window.removeEventListener('focus', handleFocus)
      }
    }
  }, [finalizado])

  useEffect(() => {
    if (finalizado && evaluacion === '1' && candidato && proceso) {
      const timer = setTimeout(() => {
        router.push(`/evaluacion?candidato=${candidato}&proceso=${proceso}&completed=1`)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [finalizado, evaluacion, candidato, proceso, router])

  return evaluacion === '1'
}
