import { useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { marcarEvaluacionOperativaEnCurso, marcarEvaluacionOperativaCompletada } from '@/lib/progresoOperativo'

export function useEvaluacionRedirect(finalizado: boolean): boolean {
  const router = useRouter()
  const searchParams = useSearchParams()
  const evaluacion = searchParams.get('evaluacion')
  const candidato = searchParams.get('candidato')
  const proceso = searchParams.get('proceso')
  const token = searchParams.get('token')
  const pathname = usePathname()
  const evaluacionKey = ({
    '/test': 'bigfive', '/hexaco': 'hexaco', '/numerico': 'numerico', '/verbal': 'verbal',
    '/integridad': 'integridad', '/icar': 'icar', '/comercial': 'comercial', '/dass21': 'dass21',
    '/sjt-comercial': 'sjt-comercial', '/tolerancia-frustracion': 'tolerancia-frustracion',
    '/sjt-cobranzas': 'sjt-cobranzas', '/sjt-atencion': 'sjt-atencion', '/sjt-ventas': 'sjt-ventas',
    '/atencion-detalle': 'atencion-detalle', '/sjt-legal': 'sjt-legal', '/estres-laboral': 'estres-laboral',
    '/creatividad': 'creatividad', '/sjt-problemas': 'sjt-problemas',
  } as Record<string, string>)[pathname || '']

  useEffect(() => {
    if (candidato && proceso && token && evaluacionKey && !finalizado) {
      void marcarEvaluacionOperativaEnCurso({ candidatoId: candidato, procesoId: proceso, evaluacionKey, token })
    }
  }, [candidato, proceso, token, evaluacionKey, finalizado])

  useEffect(() => {
    if (candidato && proceso && token && evaluacionKey && finalizado) {
      void marcarEvaluacionOperativaCompletada({ candidatoId: candidato, procesoId: proceso, evaluacionKey, token })
    }
  }, [candidato, proceso, token, evaluacionKey, finalizado])

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
        router.push(`/evaluacion?candidato=${candidato}&proceso=${proceso}&completed=1${token ? `&token=${encodeURIComponent(token)}` : ''}`)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [finalizado, evaluacion, candidato, proceso, token, router])

  return evaluacion === '1'
}
