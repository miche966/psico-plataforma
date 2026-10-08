'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAdminRole } from '@/lib/useAdminRole'
import { useGateMfa } from '@/lib/useGateMfa'
import { Marco } from '@/components/candidato/Marco'
import { PantallaCarga } from '@/components/candidato/Estados'

// Area de los supervisores de la empresa (ver docs/PLAN_SUPERVISORES.md). Independiente del panel de administracion:
// no usa AppLayout. En esta etapa solo existe el ingreso y la pantalla vacia; la lista de evaluados llega en la etapa 4.
export default function SupervisorPage() {
  const router = useRouter()
  const { role, mfaRequerido, loading } = useAdminRole()
  useGateMfa(mfaRequerido)

  useEffect(() => {
    if (loading) return
    // Sin sesion valida, al ingreso; con otro rol (administrador o solo lectura), a su panel
    if (role === null) router.replace('/login')
    else if (role !== 'supervisor') router.replace('/panel')
  }, [loading, role, router])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading || role !== 'supervisor') return <PantallaCarga texto="Cargando…" />

  return (
    <Marco titulo="Evaluados habilitados">
      <h1 className="pp-titulo">Evaluados habilitados</h1>
      <p className="pp-lead">Todavía no tenés evaluados habilitados. Cuando el equipo de selección te comparta a alguien, vas a verlo acá.</p>
      <button type="button" className="pp-enlace" onClick={cerrarSesion}>Cerrar sesión</button>
    </Marco>
  )
}
