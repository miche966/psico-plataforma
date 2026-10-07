// Genera lib/baremoCognitivoDatos.ts: la distribucion de aciertos de cada prueba cognitiva entre las personas ya evaluadas.
//
// Solo LEE la base (sesiones finalizadas). Cuenta UNA sesion por persona y prueba (la mas reciente) para no dar doble peso a
// quien repitio una prueba. No imprime ni guarda datos de personas: solo cuantas hay con cada porcentaje de aciertos.
//
// Uso: npm run baremo:cognitivo   (lee las credenciales de .env.local; despues revisar el cambio y commitearlo)
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { TESTS_COGNITIVOS } from '../lib/testsCognitivos.ts'
import { porcentajeDeAciertos, MUESTRA_MINIMA } from '../lib/baremoCognitivo.ts'

for (const linea of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false, autoRefreshToken: false } })

type Fila = { test_id: string; candidato_id: string; puntaje_bruto: any; finalizada_en: string | null }
const filas: Fila[] = []
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await db.from('sesiones').select('test_id, candidato_id, puntaje_bruto, finalizada_en').eq('estado', 'finalizado').in('test_id', Object.keys(TESTS_COGNITIVOS)).order('id').range(desde, desde + 999)
  if (error) throw new Error(error.message)
  filas.push(...((data || []) as Fila[]))
  if (!data || data.length < 1000) break
}

// Una sesion por persona y prueba: la mas reciente
const ultima = new Map<string, Fila>()
for (const f of filas) {
  if (porcentajeDeAciertos(f.puntaje_bruto?.correctas, f.puntaje_bruto?.total) === null) continue
  const clave = `${f.candidato_id}|${f.test_id}`
  const previa = ultima.get(clave)
  if (!previa || new Date(f.finalizada_en || 0).getTime() >= new Date(previa.finalizada_en || 0).getTime()) ultima.set(clave, f)
}

const baremos: Record<string, { n: number; histograma: Record<string, number> }> = {}
for (const f of ultima.values()) {
  const pct = porcentajeDeAciertos(f.puntaje_bruto.correctas, f.puntaje_bruto.total) as number
  const b = (baremos[f.test_id] ||= { n: 0, histograma: {} })
  b.n++
  b.histograma[pct] = (b.histograma[pct] || 0) + 1
}

const hoy = new Date().toISOString().slice(0, 10)
const cuerpo = Object.entries(baremos).map(([id, b]) => {
  const hist = Object.keys(b.histograma).map(Number).sort((x, y) => x - y).map(k => `'${k}': ${b.histograma[k]}`).join(', ')
  return `  // ${TESTS_COGNITIVOS[id]}\n  '${id}': { n: ${b.n}, histograma: { ${hist} } },`
}).join('\n')
writeFileSync('lib/baremoCognitivoDatos.ts', `// GENERADO por scripts/generar-baremo-cognitivo.ts el ${hoy}. No editar a mano: volver a correr \`npm run baremo:cognitivo\`.
// Distribucion de aciertos (en %, de 0 a 100) de las personas evaluadas en cada prueba cognitiva, una sesion por persona.
// Se usa en lib/baremoCognitivo.ts. Ver docs/BAREMO_COGNITIVO.md.
export const FECHA_BAREMO = '${hoy}'
export const BAREMOS: Record<string, { n: number; histograma: Record<string, number> }> = {
${cuerpo}
}
`)
console.log(`Baremo generado (${hoy}):`)
for (const [id, b] of Object.entries(baremos)) console.log(`  ${TESTS_COGNITIVOS[id].padEnd(24)} personas: ${b.n}${b.n < MUESTRA_MINIMA ? `  (menos de ${MUESTRA_MINIMA}: no se usará)` : ''}`)
