'use client'

import { useEffect, useState } from 'react'
import { getAdminHeaders } from '@/lib/evaluacionLink'

export type AdminRole = 'admin' | 'viewer' | 'supervisor'

interface EstadoRol {
  role: AdminRole | null
  allowedProcesoIds: string[] | null
  /** El 2FA es obligatorio: la pantalla usa useGateMfa para mandar a verificar o a enrolar */
  mfaRequerido: boolean
  loading: boolean
}

/**
 * Pide una sola vez el rol de la cuenta actual (admin = acceso total, viewer =
 * solo lectura acotada a allowedProcesoIds). Mientras loading es true, role
 * es null -- las pantallas deben tratar ese estado como "todavia no se sabe",
 * no como "es viewer", para no ocultar controles de golpe antes de tiempo.
 */
export function useAdminRole(): EstadoRol {
  const [estado, setEstado] = useState<EstadoRol>({ role: null, allowedProcesoIds: null, mfaRequerido: false, loading: true })

  useEffect(() => {
    let vivo = true
    async function cargar() {
      try {
        const headers = await getAdminHeaders()
        const res = await fetch('/api/admin/whoami', { headers, cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!vivo) return
        if (res.ok && (data.role === 'admin' || data.role === 'viewer' || data.role === 'supervisor')) {
          setEstado({ role: data.role, allowedProcesoIds: data.allowedProcesoIds ?? null, mfaRequerido: data.mfaRequerido === true, loading: false })
        } else {
          setEstado({ role: null, allowedProcesoIds: null, mfaRequerido: false, loading: false })
        }
      } catch {
        if (vivo) setEstado({ role: null, allowedProcesoIds: null, mfaRequerido: false, loading: false })
      }
    }
    cargar()
    return () => { vivo = false }
  }, [])

  return estado
}
