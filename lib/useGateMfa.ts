'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Si el 2FA es obligatorio y la sesion todavia esta en aal1 (solo contrasena), manda a verificar el codigo
 * (/login/2fa) o, si la cuenta aun no tiene dispositivo, a enrolarlo (/seguridad). Lo usan las pantallas del
 * panel; las paginas /login/2fa y /seguridad NO lo usan (se redirigirian en bucle).
 *
 * Es solo la parte de pantalla: el servidor exige aal2 por su cuenta en cada ruta (requireAdminSession).
 * getAuthenticatorAssuranceLevel lee el token local, no hace ninguna llamada de red.
 */
export function useGateMfa(mfaRequerido: boolean) {
  const router = useRouter()
  useEffect(() => {
    if (!mfaRequerido) return
    let vivo = true
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!vivo || !data || data.currentLevel === 'aal2') return
      router.replace(data.nextLevel === 'aal2' ? '/login/2fa' : '/seguridad')
    })
    return () => { vivo = false }
  }, [mfaRequerido, router])
}
