// Tiempo que puede quedar abierta la pantalla del segundo factor (/login/2fa) sin que nadie la toque. Pasado ese limite se
// cierra la sesion provisional (la que solo tiene contrasena) y se vuelve al ingreso, para no dejar una sesion a medias
// abierta en una computadora compartida o abandonada.
export const INACTIVIDAD_2FA_MS = 5 * 60 * 1000

/** Cada cuanto se revisa. No alcanza con un unico setTimeout: si la computadora se suspende, el temporizador no avanza. */
export const REVISION_2FA_MS = 10 * 1000

/** true si pasaron mas de `limite` milisegundos desde la ultima actividad. Un reloj que va hacia atras no vence nada. */
export function inactividadVencida(ultimaActividad: number, ahora: number, limite: number = INACTIVIDAD_2FA_MS): boolean {
  return ahora - ultimaActividad > limite
}
