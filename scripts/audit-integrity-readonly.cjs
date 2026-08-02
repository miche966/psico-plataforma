const dotenv = require('dotenv')
dotenv.config({ path: '.env.local', quiet: true })

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!baseUrl || !serviceKey) throw new Error('Faltan variables Supabase para auditoría de solo lectura.')

async function readTable(table, select) {
  const pageSize = 1000
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(baseUrl + '/rest/v1/' + table)
    url.searchParams.set('select', select)
    url.searchParams.set('limit', String(pageSize))
    url.searchParams.set('offset', String(offset))
    const response = await fetch(url, { headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey } })
    if (!response.ok) throw new Error('No se pudo leer ' + table + ': HTTP ' + response.status)
    const page = await response.json()
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

function duplicates(rows, keyFn) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    const list = groups.get(key) || []
    list.push(row.id || row.candidato_id || null)
    groups.set(key, list)
  }
  return [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, ids }))
}

async function main() {
const [candidatos, procesos, relaciones, sesiones, videos, informes] = await Promise.all([
  readTable('candidatos', 'id,email,documento'),
  readTable('procesos', 'id,nombre'),
  readTable('candidatos_procesos', 'candidato_id,proceso_id'),
  readTable('sesiones', 'id,candidato_id,proceso_id,test_id,estado'),
  readTable('respuestas_video', 'id,candidato_id,entrevista_id,pregunta_id,url_video,estado'),
  readTable('informes_psicometricos', 'candidato_id')
])

const candidateIds = new Set(candidatos.map(row => row.id))
const processIds = new Set(procesos.map(row => row.id))
const relationKeys = new Set(relaciones.map(row => row.candidato_id + '|' + row.proceso_id))
const sessionOrphans = sesiones.filter(row => !candidateIds.has(row.candidato_id) || !processIds.has(row.proceso_id))
const relationOrphans = relaciones.filter(row => !candidateIds.has(row.candidato_id) || !processIds.has(row.proceso_id))
const videoOrphans = videos.filter(row => !candidateIds.has(row.candidato_id))
const reportOrphans = informes.filter(row => !candidateIds.has(row.candidato_id))
const sessionsWithoutRelation = sesiones.filter(row => row.candidato_id && row.proceso_id && !relationKeys.has(row.candidato_id + '|' + row.proceso_id))
const videosWithoutUrl = videos.filter(row => !row.url_video)
const duplicateCandidateEmails = duplicates(candidatos, row => String(row.email || '').trim().toLowerCase())
const duplicateDocuments = duplicates(candidatos, row => String(row.documento || '').trim())
const duplicateSessions = duplicates(sesiones, row => [row.candidato_id, row.proceso_id, row.test_id].join('|'))
const duplicateVideos = duplicates(videos.filter(row => row.url_video), row => [row.candidato_id, row.entrevista_id, row.pregunta_id, row.url_video].join('|'))

const report = {
  modo: 'solo_lectura',
  tablas: { candidatos: candidatos.length, procesos: procesos.length, relaciones: relaciones.length, sesiones: sesiones.length, videos: videos.length, informes: informes.length },
  hallazgos: {
    relaciones_huerfanas: relationOrphans.length,
    sesiones_huerfanas: sessionOrphans.length,
    videos_sin_candidato: videoOrphans.length,
    informes_sin_candidato: reportOrphans.length,
    sesiones_sin_relacion_candidato_proceso: sessionsWithoutRelation.length,
    videos_sin_url: videosWithoutUrl.length,
    emails_duplicados: duplicateCandidateEmails.length,
    documentos_duplicados: duplicateDocuments.length,
    sesiones_duplicadas: duplicateSessions.length,
    videos_duplicados: duplicateVideos.length
  },
  ...(process.argv.includes('--details') ? { detalle: { relaciones_huerfanas: relationOrphans, sesiones_huerfanas: sessionOrphans, sesiones_duplicadas: duplicateSessions, videos_duplicados: duplicateVideos } } : {})
}

console.log(JSON.stringify(report, null, 2))

}

main().catch(error => { console.error(error.message); process.exit(1) })
