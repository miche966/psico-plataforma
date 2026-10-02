// Revierte la migracion del proyecto viejo (scripts/migrar-viejo.ts): borra EXACTAMENTE las filas y los videos de R2
// que anota el manifiesto (docs/migracion-manifiesto-2026-10-02.json), y nada mas. Por defecto solo informa.
//
// Uso: node --experimental-strip-types scripts/revertir-migracion.ts <manifiesto.json> [--ejecutar]
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

for (const linea of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const ruta = process.argv[2]
if (!ruta) { console.error('Falta el manifiesto: node --experimental-strip-types scripts/revertir-migracion.ts <manifiesto.json> [--ejecutar]'); process.exit(1) }
const manifiesto = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, string[]>
const ejecutar = process.argv.includes('--ejecutar')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!, { auth: { persistSession: false, autoRefreshToken: false } })
const r2 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } })

async function main() {
  // Orden inverso al de la insercion: primero lo que depende de otras filas
  for (const tabla of ['respuestas', 'respuestas_video', 'sesiones']) {
    const ids = manifiesto[tabla] || []
    console.log(`${tabla}: ${ids.length} filas del manifiesto`)
    if (!ejecutar) continue
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await db.from(tabla).delete().in('id', ids.slice(i, i + 100))
      if (error) throw new Error(`${tabla}: ${error.message}`)
    }
  }
  const claves = manifiesto.r2 || []
  console.log(`videos de R2: ${claves.length}`)
  if (ejecutar) for (const clave of claves) await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: clave }))
  console.log(ejecutar ? 'Reversion hecha.' : 'EN SECO: no se borro nada. Agregar --ejecutar para revertir.')
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
