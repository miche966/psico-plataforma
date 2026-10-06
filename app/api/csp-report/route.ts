import { NextResponse } from 'next/server'
import { resumirInformeCsp } from '@/lib/server/csp'
import { rlCsp, verificarLimite } from '@/lib/server/rateLimit'

// Informes de violacion de la Content-Security-Policy que mandan los navegadores (modo "solo informe").
// Ruta publica A PROPOSITO (los navegadores no mandan sesion): por eso solo escribe UNA linea de log sanitizada
// (ruta de la pagina sin parametros + tipo de recurso bloqueado), con tamano acotado y limite por IP. No guarda nada.
const MAX_BYTES = 8 * 1024

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida'
    const { permitido } = await verificarLimite(rlCsp, ip)
    if (!permitido) return new NextResponse(null, { status: 204 })
    const texto = await request.text()
    if (texto.length > MAX_BYTES) return new NextResponse(null, { status: 204 })
    let cuerpo: unknown
    try { cuerpo = JSON.parse(texto) } catch { return new NextResponse(null, { status: 204 }) }
    const linea = resumirInformeCsp(cuerpo)
    if (linea) console.warn(`[CSP] ${linea}`)
  } catch {
    // Un informe que no se puede procesar no es un error para nadie: se descarta
  }
  return new NextResponse(null, { status: 204 })
}
