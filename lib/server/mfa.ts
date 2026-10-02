import { decodificarPayloadJwt } from './jwtPlano.ts'

/**
 * Verificacion en dos pasos de las cuentas del panel (ver docs/DOBLE_FACTOR.md).
 *
 * Supabase Auth marca el nivel de la sesion en el claim `aal` del JWT: 'aal1' despues de la contrasena y
 * 'aal2' despues de verificar el codigo de la app autenticadora. Modulo puro (sin next/server).
 */
export type NivelAal = 'aal1' | 'aal2'

/** Nivel de aseguramiento del token de la cabecera Authorization, o null si no se puede leer. */
export function nivelDeAseguramiento(authorization: string | null): NivelAal | null {
  if (!authorization || !authorization.startsWith('Bearer ')) return null
  const payload = decodificarPayloadJwt(authorization.slice('Bearer '.length).trim())
  const aal = payload?.aal
  return aal === 'aal1' || aal === 'aal2' ? aal : null
}

/**
 * Si el 2FA es obligatorio. Se activa con la variable de entorno MFA_OBLIGATORIO=true (y un nuevo despliegue);
 * apagada por defecto para que nadie quede afuera mientras se enrolan los dispositivos.
 */
export function mfaObligatorio(valor: string | undefined = process.env.MFA_OBLIGATORIO): boolean {
  return valor === 'true'
}

/** Con el 2FA obligatorio solo pasa una sesion 'aal2'; sin obligatoriedad pasa cualquiera. */
export function cumpleMfa(authorization: string | null, obligatorio: boolean = mfaObligatorio()): boolean {
  return !obligatorio || nivelDeAseguramiento(authorization) === 'aal2'
}
