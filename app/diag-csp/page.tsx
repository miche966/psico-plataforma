import { headers } from 'next/headers'

// TEMPORAL (diagnostico de la CSP en Vercel): se borra en el commit siguiente. Solo muestra si llegan ciertos
// encabezados de la peticion (si/no) y nombres de encabezados, nunca valores.
export const dynamic = 'force-dynamic'

export default async function Diag() {
  const h = await headers()
  const csp = h.get('content-security-policy')
  const nombres = [...h.keys()].filter(n => n.startsWith('x-') || n.startsWith('content-security') || n.startsWith('next-')).sort()
  return (
    <pre>{JSON.stringify({
      xNonce: !!h.get('x-nonce'),
      cspPeticion: !!csp,
      cspPeticionTraeNonce: !!csp && /'nonce-/.test(csp),
      reportOnlyPeticion: !!h.get('content-security-policy-report-only'),
      nombresDeEncabezados: nombres,
    }, null, 1)}</pre>
  )
}
