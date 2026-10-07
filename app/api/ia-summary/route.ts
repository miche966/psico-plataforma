import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { GEMINI_MODEL } from '@/lib/server/geminiModel'
import { rlAdmin, verificarLimite, respuestaLimiteExcedido } from '@/lib/server/rateLimit'
import { mensajeParaCliente } from '@/lib/server/mensajesError'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { guardarResumen } from '@/lib/server/resumenesIa'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const bloqueado = requireFullAdmin(auth)
    if (bloqueado) return bloqueado

    const { prompt, candidato_id, proceso_id } = await req.json()

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'El contenido del resumen es obligatorio' }, { status: 400 })
    }
    if (prompt.length > 12000) {
      return NextResponse.json({ error: 'El contenido del resumen supera el límite permitido' }, { status: 413 })
    }
    const { permitido } = await verificarLimite(rlAdmin, auth.user.email)
    if (!permitido) return NextResponse.json(respuestaLimiteExcedido(), { status: 429 })

    let result = null
    let attempts = 0
    const maxAttempts = 3
    const apiCallStartTime = Date.now()

    console.log(`[INFO] [IA SUMMARY] Iniciando generación de resumen...`)

    while (attempts < maxAttempts) {
      try {
        attempts++
        console.log(`[INFO] [IA SUMMARY] Llamando a Gemini (Intento ${attempts}/${maxAttempts})...`)
        
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: {
            // Migrado a gemini-3.5-flash: en la simulación previa a la migración, 2000 se quedaba
            // corto (MAX_TOKENS) porque este modelo usó ~35% más tokens de "thinking" que 2.5-flash
            // para el mismo prompt real. Subido a 3500 con ese margen verificado.
            maxOutputTokens: 3500,
            temperature: 0.3
          }
        })
        
        const callStart = Date.now()
        result = await model.generateContent(prompt)
        const callDuration = ((Date.now() - callStart) / 1000).toFixed(2)
        
        console.log(`[INFO] [IA SUMMARY] Intento ${attempts} exitoso en ${callDuration}s.`)
        break
      } catch (err: any) {
        console.error(`[WARNING] [IA SUMMARY] Error en intento ${attempts}:`, err.message || err)
        if (attempts >= maxAttempts) {
          throw err
        }
        const delay = Math.pow(2, attempts) * 1000
        console.log(`[INFO] [IA SUMMARY] Reintentando en ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    if (!result) {
      throw new Error('Fallo la llamada a la API de Gemini tras superar los reintentos máximos.')
    }

    const summary = result.response.text()

    const totalDuration = ((Date.now() - apiCallStartTime) / 1000).toFixed(2)
    console.log(`[INFO] [IA SUMMARY] Resumen generado exitosamente en ${totalDuration}s.`)

    // Se conserva para que no se pierda al recargar; si no se puede guardar, igual se entrega lo generado
    const guardado = await guardarResumen(createSupabaseAdmin(), { candidatoId: candidato_id, procesoId: proceso_id, resumen: summary, email: auth.user.email })

    return NextResponse.json({ success: true, summary, guardado })

  } catch (error: any) {
    console.error('Error en ia-summary:', error)
    return NextResponse.json({ error: mensajeParaCliente(error, 'No se pudo generar el resumen. Intentá de nuevo.') }, { status: 500 })
  }
}
