import { useState, useEffect, useRef } from 'react'

export interface ProctoringEvent {
  tipo: 'tab_switch' | 'copy_paste' | 'context_menu' | 'blur'
  timestamp: string
  duracion?: number // Para saber cuánto tiempo estuvo afuera
}

export interface MetricasFraude {
  tabSwitches: number
  copyPasteAttempts: number
  timeOutOfFocus: number
  events: ProctoringEvent[]
}

export function useProctoring() {
  const [metricas, setMetricas] = useState<MetricasFraude>({
    tabSwitches: 0,
    copyPasteAttempts: 0,
    timeOutOfFocus: 0,
    events: []
  })

  const lastBlurTime = useRef<number | null>(null)

  const addEvent = (tipo: ProctoringEvent['tipo'], duracion?: number) => {
    const newEvent: ProctoringEvent = {
      tipo,
      timestamp: new Date().toISOString(),
      duracion
    }
    setMetricas(prev => ({
      ...prev,
      events: [...prev.events, newEvent]
    }))
  }

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        lastBlurTime.current = Date.now()
        setMetricas(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }))
        addEvent('tab_switch')
      } else {
        if (lastBlurTime.current) {
          const outTime = Math.floor((Date.now() - lastBlurTime.current) / 1000)
          setMetricas(prev => ({ ...prev, timeOutOfFocus: prev.timeOutOfFocus + outTime }))
          lastBlurTime.current = null
          
          // Alerta disuasoria al regresar
          alert("Atención: El sistema ha detectado que has salido de la ventana del test. Toda actividad inusual queda registrada para el equipo de selección. Por favor, mantente en la pestaña hasta finalizar.")
        }
      }
    }

    function handleBlur() {
      if (!lastBlurTime.current) {
        lastBlurTime.current = Date.now()
        setMetricas(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }))
        addEvent('blur')
      }
    }

    function handleFocus() {
      if (lastBlurTime.current) {
        const outTime = Math.floor((Date.now() - lastBlurTime.current) / 1000)
        setMetricas(prev => ({ ...prev, timeOutOfFocus: prev.timeOutOfFocus + outTime }))
        lastBlurTime.current = null
      }
    }

    function handleCopyPaste(e: ClipboardEvent) {
      e.preventDefault()
      setMetricas(prev => ({ ...prev, copyPasteAttempts: prev.copyPasteAttempts + 1 }))
      addEvent('copy_paste')
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault()
      addEvent('context_menu')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('copy', handleCopyPaste)
    document.addEventListener('paste', handleCopyPaste)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('copy', handleCopyPaste)
      document.removeEventListener('paste', handleCopyPaste)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  return metricas
}
