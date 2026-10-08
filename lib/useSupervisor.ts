'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '@/lib/useAdminRole'
import { useGateMfa } from '@/lib/useGateMfa'

/**
 * Guarda de las pantallas del supervisor (ver docs/PLAN_SUPERVISORES.md): sin sesion manda al ingreso; con otro rol
 * (administrador o solo lectura) a su panel; y exige el 2FA como el resto. `listo` es true solo para un supervisor.
 */
export function useSupervisorGate() {
  const router = useRouter()
  const { role, mfaRequerido, loading } = useAdminRole()
  useGateMfa(mfaRequerido)

  useEffect(() => {
    if (loading) return
    if (role === null) router.replace('/login')
    else if (role !== 'supervisor') router.replace('/panel')
  }, [loading, role, router])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return { listo: !loading && role === 'supervisor', cerrarSesion }
}
