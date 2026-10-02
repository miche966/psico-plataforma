/**
 * Lee el contenido (payload) de un JWT SIN verificar la firma. Sirve solo para filtros baratos (proxy.ts) o para
 * leer claims de un token que Supabase Auth acaba de validar (requireAdminSession); nunca como prueba de identidad.
 * Modulo puro (sin next/server) para poder testearlo.
 */
export function decodificarPayloadJwt(token: string): Record<string, unknown> | null {
  const partes = token.split('.')
  if (partes.length !== 3 || partes.some(p => !p)) return null
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    const payload = JSON.parse(json)
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}
