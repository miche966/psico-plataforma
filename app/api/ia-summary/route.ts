import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const bloqueado = requireFullAdmin(auth)
    if (bloqueado) return bloqueado

    const { prompt } = await req.json()

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'El contenido del resumen es obligatorio' }, { status: 400 })
    }
    if (prompt.length > 12000) {
      return NextResponse.json({ error: 'El contenido del resumen supera el límite permitido' }, { status: 413 })
    }

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
          model: 'gemini-2.5-flash',
          generationConfig: {
            // 500 arriesgaba el mismo corte que en generar-informe/roleplay: gemini-2.5-flash usa
            // "thinking" por defecto, que resta presupuesto antes de escribir los 2 parrafos pedidos.
            maxOutputTokens: 2000,
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

    return NextResponse.json({ success: true, summary })

  } catch (error: any) {
    console.error('Error en ia-summary:', error)
    return NextResponse.json({ error: error.message || 'Error desconocido' }, { status: 500 })
  }
}
