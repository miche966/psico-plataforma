// Decision pura (sin red ni next/server, para poder testearla) de quien es supervisor. La usa lib/server/supervisorAuth.ts.

export type DecisionRolSupervisor = 'supervisor' | 'doble_rol' | 'no_autorizado'

/**
 * Una cuenta es supervisor solo si esta en `supervisores` y activa, y no es a la vez administrador (ADMIN_EMAILS) ni cuenta
 * de solo lectura (admin_roles): una cuenta no puede tener dos roles.
 */
export function decidirRolSupervisor(entrada: {
  email: string
  esAdmin: boolean
  esViewer: boolean
  filaSupervisor: { activo?: boolean | null } | null
}): DecisionRolSupervisor {
  if (!entrada.email) return 'no_autorizado'
  if (!entrada.filaSupervisor || entrada.filaSupervisor.activo !== true) return 'no_autorizado'
  if (entrada.esAdmin || entrada.esViewer) return 'doble_rol'
  return 'supervisor'
}
