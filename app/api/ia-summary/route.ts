import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent(prompt)
    const summary = result.response.text()

    return NextResponse.json({ success: true, summary })

  } catch (error: any) {
    console.error('Error en ia-summary:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
