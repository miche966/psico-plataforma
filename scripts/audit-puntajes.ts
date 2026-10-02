// Auditoria de SOLO LECTURA: recalcula el puntaje de cada sesion finalizada con lib/server/puntuacion.ts
// (a partir de las filas de `respuestas` y los `items`) y lo compara con `sesiones.puntaje_bruto`.
//
// Es la vara de verificacion del paso del puntaje al servidor: antes de activarlo, todo lo historico
// tiene que coincidir (salvo lo que esta explicado). No escribe nada ni imprime datos de candidatos.
//
// Uso: npm run audit:puntajes   (lee las credenciales de .env.local)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { calcularPuntaje, diferenciasDePuntaje, esPuntuable, bancoDeItems, esIcar, type ItemPuntuable } from '../lib/server/puntuacion.ts'

for (const linea of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function leerTodo<T>(tabla: string, columnas: string, filtro?: (q: any) => any): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    let q = db.from(tabla).select(columnas).order('id').range(desde, desde + 999)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...((data || []) as T[]))
    if (!data || data.length < 1000) break
  }
  return filas
}

async function main() {
  const [items, sesiones, respuestas] = await Promise.all([
    leerTodo<ItemPuntuable & { test_id: string }>('items', 'id,test_id,factor,inverso,respuesta_correcta,opciones,subtipo,nivel_dificultad'),
    leerTodo<{ id: string; test_id: string; puntaje_bruto: any }>('sesiones', 'id,test_id,puntaje_bruto', q => q.eq('estado', 'finalizado')),
    leerTodo<{ sesion_id: string; item_id: string; valor: number }>('respuestas', 'id,sesion_id,item_id,valor'),
  ])
  const itemsPorBanco = new Map<string, ItemPuntuable[]>()
  const bancoDeItem = new Map<string, string>()
  for (const it of items) {
    bancoDeItem.set(it.id, it.test_id)
    itemsPorBanco.set(it.test_id, [...(itemsPorBanco.get(it.test_id) || []), it])
  }
  const respPorSesion = new Map<string, Array<{ item_id: string; valor: number }>>()
  for (const r of respuestas) respPorSesion.set(r.sesion_id, [...(respPorSesion.get(r.sesion_id) || []), r])

  const resumen: Record<string, { sesiones: number; coincide: number; difiere: number; mezcla: number; duplicadas: number; sinRespuestas: number; sinPuntuar: number; ejemplos: string[] }> = {}
  for (const s of sesiones) {
    const r = (resumen[s.test_id] ??= { sesiones: 0, coincide: 0, difiere: 0, mezcla: 0, duplicadas: 0, sinRespuestas: 0, sinPuntuar: 0, ejemplos: [] })
    r.sesiones++
    if (!esPuntuable(s.test_id)) { r.sinPuntuar++; continue }
    const todas = respPorSesion.get(s.id)
    if (!todas) { r.sinRespuestas++; continue }
    const banco = bancoDeItems(s.test_id)
    // Filas repetidas del mismo item (inserciones dobles de versiones antiguas): se cuenta la primera
    const vistas = new Set<string>()
    const unicas = todas.filter(x => (vistas.has(x.item_id) ? false : (vistas.add(x.item_id), true)))
    if (unicas.length !== todas.length) r.duplicadas++
    const propias = unicas.filter(x => bancoDeItem.get(x.item_id) === banco)
    // Sesiones antiguas (29/4-5/5) guardaron las respuestas de toda la bateria en la sesion de Big Five
    if (propias.length !== unicas.length) r.mezcla++
    const bancoItems = itemsPorBanco.get(banco) || []
    // ICAR: el universo es lo que el candidato vio (depende de ?max= y ?norot= de su enlace), no todo el banco
    const universo = esIcar(s.test_id) ? bancoItems.filter(i => propias.some(p => p.item_id === i.id)) : bancoItems
    const calc = calcularPuntaje(s.test_id, universo, propias, { valoresInvertidos: true })
    if (!calc.ok) { r.difiere++; if (r.ejemplos.length < 5) r.ejemplos.push(`${s.id.slice(0, 8)}: ${calc.error}`); continue }
    // nivel_maximo y metricas_fraude no salen de las respuestas: se comparan solo las claves calculadas
    const guardado = s.puntaje_bruto || {}
    if (diferenciasDePuntaje(guardado, calc.puntaje).length === 0) r.coincide++
    else { r.difiere++; if (r.ejemplos.length < 5) r.ejemplos.push(`${s.id.slice(0, 8)}: guardado=${JSON.stringify(guardado).slice(0, 110)} recalculado=${JSON.stringify(calc.puntaje).slice(0, 110)}`) }
  }
  let totalDifiere = 0
  for (const [test, r] of Object.entries(resumen).sort()) {
    totalDifiere += r.difiere
    console.log(`${test}  sesiones=${r.sesiones} coincide=${r.coincide} difiere=${r.difiere} mezcla=${r.mezcla} duplicadas=${r.duplicadas} sinRespuestas=${r.sinRespuestas} noPuntuable=${r.sinPuntuar}`)
    for (const e of r.ejemplos) console.log(`    ${e}`)
  }
  console.log(`\nSesiones finalizadas: ${sesiones.length} | que difieren del recalculo: ${totalDifiere}`)
}

main().catch(e => { console.error(e); process.exit(1) })
