import { useState, useEffect, useRef } from 'react'

export interface MetricasFraude {
  tabSwitches: number
  copyPasteAttempts: number
  timeOutOfFocus: number
}

export function useProctoring() {
  const [metricas, setMetricas] = useState<MetricasFraude>({
    tabSwitches: 0,
    copyPasteAttempts: 0,
    timeOutOfFocus: 0,
  })

  const lastBlurTime = useRef<number | null>(null)

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        lastBlurTime.current = Date.now()
        setMetricas(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }))
      } else {
        if (lastBlurTime.current) {
          const outTime = Math.floor((Date.now() - lastBlurTime.current) / 1000)
          setMetricas(prev => ({ ...prev, timeOutOfFocus: prev.timeOutOfFocus + outTime }))
          lastBlurTime.current = null
        }
      }
    }

    function handleBlur() {
      if (!lastBlurTime.current) {
        lastBlurTime.current = Date.now()
        setMetricas(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }))
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
    }

    // Prevenir menú contextual
    function handleContextMenu(e: MouseEvent) {
      e.preventDefault()
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
