// Migracion de lo que falta del proyecto Supabase VIEJO al ACTUAL (ver docs/MIGRACION_PROYECTO_VIEJO.md).
//
// Principios: solo INSERTA (nunca update ni delete sobre filas del actual), es idempotente (upsert que ignora
// los id repetidos) y por defecto solo INFORMA: escribe unicamente con --ejecutar. Del proyecto viejo solo lee.
//
// Uso (desde la raiz del proyecto; el actual se lee de .env.local):
//   node --experimental-strip-types scripts/migrar-viejo.ts --viejo "<archivo con la clave sb_secret_ del viejo>"
//        [--foto <archivo.json>]            guarda la "foto" del actual (conteo y huella de cada tabla) antes de migrar
//        [--comparar-foto <archivo.json>]   comprueba que las filas preexistentes del actual NO cambiaron
//        [--ejecutar --manifiesto <archivo.json>]   inserta sesiones (y sus respuestas) y anota lo insertado
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { SLUG_TO_ID } from '../lib/server/catalogoTests.ts'

const URL_VIEJO = 'https://hgoumdjvusixbjkiexjd.supabase.co'

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const tiene = (nombre: string) => process.argv.includes(nombre)

for (const linea of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const archivoViejo = argumento('--viejo')
if (!archivoViejo) { console.error('Falta --viejo <archivo con la clave sb_secret_ del proyecto viejo>'); process.exit(1) }
const claveViejo = (readFileSync(archivoViejo, 'utf8').match(/sb_secret_[A-Za-z0-9_-]+/) || [])[0]
if (!claveViejo) { console.error('No encontre una clave sb_secret_ en el archivo'); process.exit(1) }

const sinSesion = { auth: { persistSession: false, autoRefreshToken: false } }
const viejo = createClient(URL_VIEJO, claveViejo, sinSesion)
const actual = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!, sinSesion)

type Fila = Record<string, any>

async function leerTodo(db: SupabaseClient, tabla: string, columnas = '*'): Promise<Fila[]> {
  const filas: Fila[] = []
  // candidatos_procesos no tiene columna id: su clave es (candidato_id, proceso_id)
  const orden = tabla === 'candidatos_procesos' ? ['candidato_id', 'proceso_id'] : ['id']
  for (let desde = 0; ; desde += 1000) {
    let consulta = db.from(tabla).select(columnas)
    for (const col of orden) consulta = consulta.order(col)
    const { data, error } = await consulta.range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...((data || []) as unknown as Fila[]))
    if (!data || data.length < 1000) break
  }
  return filas
}

// Columnas que tiene una tabla del actual (a partir del esquema que expone PostgREST)
async function columnasDe(tabla: string): Promise<string[]> {
  const claveActual = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!
  // La clave secret nueva no es un JWT: va solo en `apikey` (no como Authorization: Bearer)
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: claveActual.startsWith('sb_') ? { apikey: claveActual } : { apikey: claveActual, Authorization: `Bearer ${claveActual}` } })
  const j: any = await r.json()
  return Object.keys(j.definitions?.[tabla]?.properties || {})
}

const huella = (fila: Fila) => createHash('sha256').update(JSON.stringify(Object.keys(fila).sort().map(k => [k, fila[k]]))).digest('hex')

// ---------------------------------------------------------------------------------------------------------
// "Foto" del actual: por tabla, cantidad y una huella de todas las filas. Sirve para demostrar despues que lo
// que ya existia no cambio (comparar-foto ignora las filas que la migracion agrego, segun el manifiesto).
// ---------------------------------------------------------------------------------------------------------
const TABLAS_FOTO = ['candidatos', 'candidatos_procesos', 'procesos', 'items', 'entrevistas_video', 'preguntas_video', 'sesiones', 'respuestas', 'respuestas_video']
async function tomarFoto(excluir: Record<string, Set<string>> = {}): Promise<Record<string, { filas: number; huella: string }>> {
  const foto: Record<string, { filas: number; huella: string }> = {}
  for (const tabla of TABLAS_FOTO) {
    const filas = (await leerTodo(actual, tabla)).filter(f => !(excluir[tabla]?.has(String(f.id))))
    const lineas = filas.map(f => `${f.id ?? `${f.candidato_id}|${f.proceso_id}`}:${huella(f)}`).sort()
    foto[tabla] = { filas: filas.length, huella: createHash('sha256').update(lineas.join('\n')).digest('hex') }
  }
  return foto
}

async function main() {
  if (argumento('--foto')) {
    const foto = await tomarFoto()
    writeFileSync(argumento('--foto')!, JSON.stringify({ tomada: new Date().toISOString(), foto }, null, 2))
    console.log('Foto guardada:', Object.entries(foto).map(([t, v]) => `${t}=${v.filas}`).join(' '))
    return
  }
  if (argumento('--comparar-foto')) {
    const previa = JSON.parse(readFileSync(argumento('--comparar-foto')!, 'utf8'))
    const manifiesto = existsSync(argumento('--manifiesto') || '') ? JSON.parse(readFileSync(argumento('--manifiesto')!, 'utf8')) : { sesiones: [], respuestas: [] }
    const excluir: Record<string, Set<string>> = { sesiones: new Set(manifiesto.sesiones || []), respuestas: new Set(manifiesto.respuestas || []), respuestas_video: new Set(manifiesto.respuestas_video || []), preguntas_video: new Set(manifiesto.preguntas_video || []) }
    const ahora = await tomarFoto(excluir)
    let todoIgual = true
    for (const tabla of TABLAS_FOTO) {
      const igual = ahora[tabla].filas === previa.foto[tabla].filas && ahora[tabla].huella === previa.foto[tabla].huella
      if (!igual) todoIgual = false
      console.log(`${igual ? 'IGUAL    ' : 'DIFIERE  '} ${tabla}: antes ${previa.foto[tabla].filas} filas, ahora (sin lo agregado) ${ahora[tabla].filas}`)
    }
    console.log(todoIgual ? '\nLo que ya existia en el actual NO cambio.' : '\nATENCION: hay diferencias en filas preexistentes.')
    process.exit(todoIgual ? 0 : 2)
  }

  console.log('Leyendo ambos proyectos (solo lectura)...')
  const [candV, candA, procA, sesV, sesA, vidV, vidA, pregA] = await Promise.all([
    leerTodo(viejo, 'candidatos'), leerTodo(actual, 'candidatos'), leerTodo(actual, 'procesos'),
    leerTodo(viejo, 'sesiones'), leerTodo(actual, 'sesiones'),
    leerTodo(viejo, 'respuestas_video'), leerTodo(actual, 'respuestas_video'), leerTodo(actual, 'preguntas_video'),
  ])

  // --- Candidato viejo -> candidato actual: mismo id, o mismo email (sin distinguir mayusculas) ---
  const porId = new Map(candA.map(c => [c.id, c]))
  const porEmail = new Map<string, Fila[]>()
  for (const c of candA) { const e = String(c.email || '').trim().toLowerCase(); if (e) porEmail.set(e, [...(porEmail.get(e) || []), c]) }
  const mapa = new Map<string, string>()
  const traduccion = { porId: 0, porEmail: 0, ambiguos: [] as string[], sinEquivalente: [] as string[], docDistinto: [] as string[] }
  for (const c of candV) {
    if (porId.has(c.id)) { mapa.set(c.id, c.id); traduccion.porId++; continue }
    const posibles = porEmail.get(String(c.email || '').trim().toLowerCase()) || []
    if (posibles.length === 1) {
      mapa.set(c.id, posibles[0].id); traduccion.porEmail++
      if (c.documento && posibles[0].documento && String(c.documento) !== String(posibles[0].documento)) traduccion.docDistinto.push(c.id)
    } else if (posibles.length > 1) traduccion.ambiguos.push(c.id)
    else traduccion.sinEquivalente.push(c.id)
  }

  // --- Bateria vigente de cada proceso del actual, como ids de test ---
  const bateria = new Map<string, Set<string>>()
  for (const p of procA) bateria.set(p.id, new Set((p.bateria_tests || []).map((slug: string) => SLUG_TO_ID[slug]).filter(Boolean)))

  // --- Sesiones ---
  const idsSesionActual = new Set(sesA.map(s => s.id))
  const claveFinalizada = new Set(sesA.filter(s => s.estado === 'finalizado').map(s => `${s.candidato_id}|${s.proceso_id}|${s.test_id}`))
  const claveNoFinalizada = new Set(sesA.filter(s => s.estado !== 'finalizado').map(s => `${s.candidato_id}|${s.proceso_id}|${s.test_id}`))
  const aRevisar = new Set(traduccion.docDistinto)
  const cat = { yaEsta: 0, noTerminada: 0, enActual: 0, sinCandidato: 0, sinProceso: 0, conflicto: [] as Fila[], retirado: [] as Fila[], revisar: [] as Fila[], importar: [] as Fila[] }
  for (const s of sesV) {
    if (idsSesionActual.has(s.id)) { cat.enActual++; continue }
    if (s.estado !== 'finalizado') { cat.noTerminada++; continue }
    const cand = mapa.get(s.candidato_id)
    if (!cand) { cat.sinCandidato++; continue }
    if (!bateria.has(s.proceso_id)) { cat.sinProceso++; continue }
    const clave = `${cand}|${s.proceso_id}|${s.test_id}`
    if (claveFinalizada.has(clave)) { cat.yaEsta++; continue }
    if (claveNoFinalizada.has(clave)) { cat.conflicto.push(s); continue }
    if (!bateria.get(s.proceso_id)!.has(s.test_id)) { cat.retirado.push(s); continue }
    // Candidato traducido por email pero con otro documento: podria ser otra persona; no se importa hasta revisarlo
    if (aRevisar.has(s.candidato_id)) { cat.revisar.push(s); continue }
    cat.importar.push({ ...s, candidato_id: cand })
  }
  const porTest = (filas: Fila[]) => Object.entries(filas.reduce((a: Record<string, number>, s) => { a[s.test_id.slice(0, 8)] = (a[s.test_id.slice(0, 8)] || 0) + 1; return a }, {})).map(([k, v]) => `${k}:${v}`).join(' ')

  // El viejo tiene sesiones duplicadas (mismo candidato, proceso y test, mismo puntaje): se importa UNA sola. Si los
  // puntajes difieren (dos tomas distintas) se conservan todas. Gana la que tiene respuestas, y si no, la mas reciente.
  const conRespuestaViejo = new Set((await leerTodo(viejo, 'respuestas', 'id,sesion_id')).map(r => r.sesion_id))
  const gruposImportar = new Map<string, Fila[]>()
  for (const s of cat.importar) { const k = `${s.candidato_id}|${s.proceso_id}|${s.test_id}|${JSON.stringify(s.puntaje_bruto)}`; gruposImportar.set(k, [...(gruposImportar.get(k) || []), s]) }
  let duplicadasEnViejo = 0
  cat.importar = [...gruposImportar.values()].map(grupo => {
    grupo.sort((a, b) => (Number(conRespuestaViejo.has(b.id)) - Number(conRespuestaViejo.has(a.id))) || (new Date(b.finalizada_en).getTime() - new Date(a.finalizada_en).getTime()))
    duplicadasEnViejo += grupo.length - 1
    return grupo[0]
  })

  // --- Respuestas de las sesiones a importar ---
  const idsImportar = new Set(cat.importar.map(s => s.id))
  const respV = (await leerTodo(viejo, 'respuestas')).filter(r => idsImportar.has(r.sesion_id))
  const idsRespActual = new Set((await leerTodo(actual, 'respuestas', 'id')).map(r => r.id))
  const itemsA = new Set((await leerTodo(actual, 'items', 'id')).map(i => i.id))
  const respImportar = respV.filter(r => !idsRespActual.has(r.id) && itemsA.has(r.item_id))

  // --- Videos solo en el viejo ---
  const idsVidActual = new Set(vidA.map(v => v.id))
  const preguntasActual = new Set(pregA.map(p => p.id))
  const equivVideo = new Set(vidA.filter(v => v.estado === 'completado').map(v => `${v.candidato_id}|${v.pregunta_id}`))
  const videos = { yaEsta: 0, sinVideo: 0, sinCandidato: 0, equivalente: 0, aCopiar: [] as Fila[], preguntaFalta: new Set<string>() }
  for (const v of vidV) {
    if (idsVidActual.has(v.id)) { videos.yaEsta++; continue }
    if (v.estado !== 'completado' || !v.url_video) { videos.sinVideo++; continue }
    const cand = mapa.get(v.candidato_id)
    if (!cand) { videos.sinCandidato++; continue }
    if (equivVideo.has(`${cand}|${v.pregunta_id}`)) { videos.equivalente++; continue }
    videos.aCopiar.push({ ...v, candidato_id: cand })
    if (!preguntasActual.has(v.pregunta_id)) videos.preguntaFalta.add(v.pregunta_id)
  }

  // --- Informe ---
  console.log('\n=== CANDIDATOS (viejo -> actual) ===')
  console.log(`por id: ${traduccion.porId} | por email: ${traduccion.porEmail} | ambiguos: ${traduccion.ambiguos.length} | sin equivalente: ${traduccion.sinEquivalente.length} | documento distinto al traducir por email: ${traduccion.docDistinto.length}`)
  console.log('\n=== SESIONES del viejo que no estan (por id) en el actual ===')
  console.log(`ya estan por id: ${cat.enActual} (no se tocan)`)
  console.log(`sin terminar (no se importan): ${cat.noTerminada} | finalizadas con candidato sin equivalente: ${cat.sinCandidato} | con proceso inexistente en el actual: ${cat.sinProceso}`)
  console.log(`finalizadas que YA tienen una finalizada equivalente (otro id): ${cat.yaEsta}`)
  console.log(`CONFLICTO (el actual tiene una sesion sin terminar equivalente; se dejan afuera): ${cat.conflicto.length}  ${porTest(cat.conflicto)}`)
  console.log(`ARCHIVAR (test que ya no esta en la bateria del proceso): ${cat.retirado.length}  ${porTest(cat.retirado)}`)
  console.log(`REVISAR (candidato traducido por email con documento distinto; no se importan): ${cat.revisar.length}  ${porTest(cat.revisar)}`)
  console.log(`duplicadas dentro del viejo (mismo candidato/test/puntaje; se importa una sola): ${duplicadasEnViejo}`)
  console.log(`IMPORTAR: ${cat.importar.length}  ${porTest(cat.importar)}`)
  console.log(`  respuestas a importar de esas sesiones: ${respImportar.length}${respV.length !== respImportar.length ? ` (de ${respV.length}; el resto ya existe o referencia un item inexistente)` : ''}`)
  // Un video solo se copia si su archivo existe en el bucket viejo y su pregunta existe en el actual (no se agregan
  // preguntas: pasarian a formar parte de la entrevista que reciben los postulantes)
  const BUCKET_PUBLICO = `${URL_VIEJO}/storage/v1/object/public/videos-entrevista/`
  const videoListo: Fila[] = []
  const videoSinArchivo: Fila[] = []
  const videoSinPregunta: Fila[] = []
  for (const v of videos.aCopiar) {
    if (!preguntasActual.has(v.pregunta_id)) { videoSinPregunta.push(v); continue }
    const head = String(v.url_video).startsWith(BUCKET_PUBLICO) ? await fetch(v.url_video, { method: 'HEAD' }) : null
    if (head && head.ok && String(head.headers.get('content-type')).startsWith('video/')) videoListo.push(v)
    else videoSinArchivo.push(v)
  }

  console.log('\n=== VIDEOS solo en el viejo ===')
  console.log(`ya estan por id: ${videos.yaEsta} | sin video (vacias o sin archivo): ${videos.sinVideo} | candidato sin equivalente: ${videos.sinCandidato} | ya hay respuesta equivalente: ${videos.equivalente}`)
  console.log(`A COPIAR a R2: ${videoListo.length} | sin archivo en el bucket viejo (la fila apunta a un video inexistente; no se importa): ${videoSinArchivo.length} | pregunta ausente en el actual (no se importa): ${videoSinPregunta.length}`)

  if (!tiene('--ejecutar')) {
    const plan = { sesiones: cat.importar.map(s => s.id), respuestas: respImportar.map(r => r.id), conflictos: cat.conflicto.map(s => s.id), archivar: cat.retirado.map(s => s.id), revisar: cat.revisar.map(s => s.id), videos: videoListo.map(v => v.id), videosSinArchivo: videoSinArchivo.map(v => v.id), videosSinPregunta: videoSinPregunta.map(v => v.id) }
    if (argumento('--plan')) { writeFileSync(argumento('--plan')!, JSON.stringify(plan, null, 2)); console.log(`\nPlan (solo ids) guardado en ${argumento('--plan')}`) }
    console.log('\nINFORME EN SECO: no se escribio nada. Para insertar sesiones y respuestas: --ejecutar --manifiesto <archivo.json>')
    return
  }

  // ------------------------------------------------------------------ ESCRITURA (solo insertar) ------------
  const manifiestoRuta = argumento('--manifiesto')
  if (!manifiestoRuta) { console.error('--ejecutar requiere --manifiesto <archivo.json>'); process.exit(1) }
  const columnasSesiones = await columnasDe('sesiones')
  const columnasRespuestas = await columnasDe('respuestas')
  const manifiesto: Record<string, string[]> = existsSync(manifiestoRuta) ? JSON.parse(readFileSync(manifiestoRuta, 'utf8')) : { sesiones: [], respuestas: [] }
  manifiesto.sesiones ||= []; manifiesto.respuestas ||= []

  const filasSesion = cat.importar.map(s => {
    const fila: Fila = {}
    for (const c of columnasSesiones) if (c in s) fila[c] = s[c]
    if (columnasSesiones.includes('created_at')) fila.created_at = s.finalizada_en || s.iniciada_en
    return fila
  })
  for (let i = 0; i < filasSesion.length; i += 200) {
    const lote = filasSesion.slice(i, i + 200)
    // ignoreDuplicates: si el id ya existe NO se toca (insert-only)
    const { error } = await actual.from('sesiones').upsert(lote, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(`sesiones: ${error.message}`)
    manifiesto.sesiones.push(...lote.map(f => f.id))
    writeFileSync(manifiestoRuta, JSON.stringify(manifiesto, null, 2))
  }
  console.log(`Sesiones insertadas: ${filasSesion.length}`)
  const filasResp = respImportar.map(r => { const f: Fila = {}; for (const c of columnasRespuestas) if (c in r) f[c] = r[c]; return f })
  for (let i = 0; i < filasResp.length; i += 200) {
    const lote = filasResp.slice(i, i + 200)
    const { error } = await actual.from('respuestas').upsert(lote, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(`respuestas: ${error.message}`)
    manifiesto.respuestas.push(...lote.map(f => f.id))
    writeFileSync(manifiestoRuta, JSON.stringify(manifiesto, null, 2))
  }
  console.log(`Respuestas insertadas: ${filasResp.length}`)

  // --- Videos: copia bucket viejo -> R2 (privado) y fila en respuestas_video con el formato de URL de hoy ---
  manifiesto.respuestas_video ||= []
  manifiesto.r2 ||= []
  const columnasVideo = await columnasDe('respuestas_video')
  const r2 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } })
  const TAMANO_MAXIMO = 50 * 1024 * 1024
  let videosCopiados = 0
  for (const v of videoListo) {
    const archivo = String(v.url_video).slice(BUCKET_PUBLICO.length).split('/').pop()!
    const clave = `${v.entrevista_id}/${v.candidato_id}/${archivo}`
    if (!/^[\w-]+\/[\w-]+\/[\w-]+\.webm$/.test(clave)) { console.log(`  se omite ${String(v.id).slice(0, 8)}: clave de R2 con formato inesperado`); continue }
    const res = await fetch(v.url_video)
    const cuerpo = Buffer.from(await res.arrayBuffer())
    if (!res.ok || cuerpo.length === 0 || cuerpo.length > TAMANO_MAXIMO) { console.log(`  se omite ${String(v.id).slice(0, 8)}: descarga invalida (${res.status}, ${cuerpo.length} bytes)`); continue }
    await r2.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: clave, Body: cuerpo, ContentType: 'video/webm' }))
    manifiesto.r2.push(clave)
    const fila: Fila = {}
    for (const c of columnasVideo) if (c in v) fila[c] = v[c]
    fila.url_video = `${process.env.R2_PUBLIC_URL}/${clave}`
    if (columnasVideo.includes('creado_en')) fila.creado_en = v.grabada_en
    const { error } = await actual.from('respuestas_video').upsert([fila], { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(`respuestas_video: ${error.message}`)
    manifiesto.respuestas_video.push(fila.id)
    writeFileSync(manifiestoRuta, JSON.stringify(manifiesto, null, 2))
    videosCopiados++
  }
  console.log(`Videos copiados a R2 e insertados: ${videosCopiados}\nManifiesto: ${manifiestoRuta}`)
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
