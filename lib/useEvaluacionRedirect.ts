import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export function useEvaluacionRedirect(finalizado: boolean): boolean {
  const router = useRouter()
  const searchParams = useSearchParams()
  const evaluacion = searchParams.get('evaluacion')
  const candidato = searchParams.get('candidato')
  const proceso = searchParams.get('proceso')

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
