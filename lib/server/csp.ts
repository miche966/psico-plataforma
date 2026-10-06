/**
 * Content-Security-Policy de la plataforma (ver docs/RIESGOS_ACEPTADOS.md).
 *
 * Hay dos politicas con los mismos origenes permitidos y una sola diferencia, en `script-src`:
 *  - vigente: `'unsafe-inline'` (la que bloquea hoy; permite cualquier script escrito en la pagina).
 *  - estricta: nonce por visita + `'strict-dynamic'`, sin `'unsafe-inline'`. Se publica primero SOLO como informe
 *    (Content-Security-Policy-Report-Only) para ver en los logs que se romperia antes de activarla.
 *
 * `style-src` conserva `'unsafe-inline'` en ambas: las pantallas usan atributos `style={...}` que ningun nonce habilita.
 * Modulo puro (sin next/server) para poder testearlo.
 */
export const SUPABASE_ORIGIN = 'https://wzhdidxssnwfvzzapfwu.supabase.co'
// El bucket de R2 es privado: los videos (subida y lectura) van solo por URL firmada. Esas URLs llevan el bucket como
// subdominio (host distinto del endpoint de la cuenta) y la CSP exige host exacto. Sin comodin: un comodin permitiria
// subir a cualquier cuenta de R2.
export const R2_FIRMADO_ORIGIN = 'https://video-psicoplataforma.8c662e7d3be33f7a66b01eefc1f0a051.r2.cloudflarestorage.com'
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

export const RUTA_INFORMES_CSP = '/api/csp-report'

/**
 * Modo de la CSP, segun la variable de entorno CSP_MODO:
 *  - vigente (por defecto): la politica de siempre, con 'unsafe-inline', desde next.config.ts. Paginas estaticas.
 *  - informe: la vigente BLOQUEA y la estricta (con nonce) solo informa a /api/csp-report. Sirve para observar en local
 *    (`next start`) que se rompería. En Vercel NO funciona: alli toda cabecera Content-Security-Policy se mezcla con la
 *    peticion y le tapa el nonce a Next.
 *  - estricta: la estricta (nonce + strict-dynamic) es la unica que bloquea; next.config.ts ya no define CSP.
 */
export type ModoCsp = 'vigente' | 'informe' | 'estricta'
export function modoCsp(env: Record<string, string | undefined> = process.env): ModoCsp {
  return env.CSP_MODO === 'informe' ? 'informe' : env.CSP_MODO === 'estricta' ? 'estricta' : 'vigente'
}

/** Nonce aleatorio de un solo uso (16 bytes, base64). Usa Web Crypto: sirve en el proxy y en Node. */
export function generarNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario)
}

interface OpcionesCsp {
  /** Desarrollo: React usa eval para mostrar los errores con detalle */
  dev?: boolean
  /** Si viene, se arma la politica estricta con este nonce; si no, la vigente (con 'unsafe-inline') */
  nonce?: string
  /** Solo la estricta: a donde mandan sus informes los navegadores */
  reportUri?: string
}

export function construirCsp({ dev = false, nonce, reportUri }: OpcionesCsp = {}): string {
  const unsafeEval = dev ? " 'unsafe-eval'" : ''
  // 'wasm-unsafe-eval': solo permite COMPILAR WebAssembly (no habilita eval de JavaScript). La libreria de PDF
  // (@react-pdf -> yoga-layout) lo necesita para armar el PDF en el navegador; sin esto el navegador lo bloqueaba.
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' ${TURNSTILE_ORIGIN}${unsafeEval}`
    : `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${TURNSTILE_ORIGIN}${unsafeEval}`
  const directivas = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
    `media-src 'self' blob: ${SUPABASE_ORIGIN} ${R2_FIRMADO_ORIGIN}`,
    // data: en connect-src: pedidos a datos embebidos (sin red); la generacion de PDF/imagenes los usa y se bloqueaban
    `connect-src 'self' data: ${SUPABASE_ORIGIN} ${R2_FIRMADO_ORIGIN}`,
    "font-src 'self'",
    "object-src 'none'",
    `frame-src ${TURNSTILE_ORIGIN}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  if (nonce && reportUri) directivas.push(`report-uri ${reportUri}`)
  return directivas.join('; ')
}

/**
 * Resume un informe de violacion de CSP en una linea segura para el log: solo la ruta de la pagina (sin parametros de
 * consulta ni fragmento, que pueden llevar tokens de evaluacion) y el tipo de recurso bloqueado (origen o palabra
 * clave como inline/eval), sin datos personales. Devuelve null si el cuerpo no es un informe valido.
 */
export function resumirInformeCsp(cuerpo: unknown): string | null {
  const r = (cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>)['csp-report'] : null) as Record<string, unknown> | null
  if (!r || typeof r !== 'object') return null
  const limpiar = (v: unknown, max = 100) => String(v ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, max)
  const ruta = (v: unknown) => {
    try { return limpiar(new URL(String(v)).pathname) } catch { return limpiar(v, 40) }
  }
  const bloqueado = (v: unknown) => {
    const s = String(v ?? '')
    if (!s || s === 'inline' || s === 'eval' || s === 'data' || s === 'blob' || s === 'self') return limpiar(s || 'desconocido', 20)
    try { return limpiar(new URL(s).origin) } catch { return limpiar(s, 30) }
  }
  const directiva = limpiar(r['effective-directive'] ?? r['violated-directive'], 60)
  if (!directiva) return null
  return `directiva=${directiva} bloqueado=${bloqueado(r['blocked-uri'])} pagina=${ruta(r['document-uri'])}`
}
