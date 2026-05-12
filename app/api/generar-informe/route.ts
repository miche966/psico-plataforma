import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
  try {
    const { candidato, proceso, sesiones } = await req.json()
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'API Key missing' }, { status: 500 })
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    let datosCandidato = `Candidato: ${candidato.nombre} ${candidato.apellido}\nCargo: ${proceso?.cargo || 'N/A'}\n`
    let resultados = '--- RESULTADOS ---\n'
    sesiones.forEach((s: any) => {
      const data = s.puntaje_bruto?.por_factor || s.puntaje_bruto || {}
      resultados += `\n[TEST]: ${s.test_id}\n`
      Object.entries(data).forEach(([k, v]) => {
        if (typeof v === 'number') resultados += `- ${k}: ${v}/5\n`
      })
    })

    let scoreMatematico = 0
    const reqs = proceso?.competencias_requeridas || []
    if (reqs.length > 0) {
      const pcts: number[] = []
      reqs.forEach((r: any) => {
        let valCand = 2.5
        sesiones.forEach((s: any) => {
          const d = s.puntaje_bruto?.por_factor || s.puntaje_bruto || {}
          if (d[r.competencia?.toLowerCase()]) valCand = d[r.competencia.toLowerCase()]
        })
        pcts.push(Math.round((valCand / (r.nivel || 3)) * 100))
      })
      scoreMatematico = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    }

    const scoreSeguro = isNaN(scoreMatematico) ? 0 : scoreMatematico
    const dictamenHumano = scoreSeguro >= 70 ? 'RECOMENDADO' : 'NO RECOMENDADO'

    let ocean = { e: 2.5, o: 2.5, a: 2.5, c: 2.5, n: 2.5 }
    sesiones.forEach((s: any) => {
      const d = s.puntaje_bruto || {}
      if (d.extraversion) ocean.e = d.extraversion
      if (d.apertura) ocean.o = d.apertura
    })

    const mbtiCalculadoFinal = [
      ocean.e >= 2.7 ? 'E' : 'I',
      ocean.o >= 2.7 ? 'N' : 'S',
      ocean.a >= 2.7 ? 'F' : 'T',
      ocean.c >= 2.7 ? 'J' : 'P'
    ].join('')

    const prompt = `
Contexto: ${datosCandidato}
Resultados: ${resultados}
Referencia: Ajuste ${scoreSeguro}%, MBTI: ${mbtiCalculadoFinal}

Instrucciones:
1. Tono ejecutivo. PROHIBIDO mencionar etiquetas como "PUNTAJE" o "NaN".
2. Fortalezas: 3-5 puntos. Mejora: 2-4 puntos.

Devuelve JSON:
{
  "resumenEjecutivo": "...",
  "fortalezas": ["..."],
  "oportunidadesMejora": ["..."],
  "ajusteCargo": { "score": ${scoreSeguro}, "analisis": "..." },
  "mbtiType": "${mbtiCalculadoFinal}",
  "recomendacion": "${dictamenHumano}",
  "fundamentacion": "...",
  "ajusteMbti": "...",
  "interpretacionPorFactor": {},
  "metaCompetencias": { "liderazgo": 0, "adaptabilidad": 0, "resiliencia": 0, "colaboracion": 0, "comunicacion": 0 }
}
`

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const text = (await result.response).text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return NextResponse.json(JSON.parse(jsonMatch ? jsonMatch[0] : text))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
