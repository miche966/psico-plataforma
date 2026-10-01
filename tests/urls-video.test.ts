import assert from 'node:assert/strict'

const { extraerClaveVideo, claveVideoPerteneceA } = await import('../lib/server/urlsVideo.ts')

const origenes = {
  r2PublicUrl: 'https://pub-8c13e3844d9c4aa0b884ae0b3c1093e3.r2.dev',
  supabaseOrigin: 'https://wzhdidxssnwfvzzapfwu.supabase.co',
}
const entrevista = '0a9591f0-bdd0-4b51-98c2-095f3e83d870'
const candidato = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const otro = '11111111-2222-4333-8444-555555555555'
const pregunta = 'dd44a862-7a04-417b-9def-d3c54ca14c10'
const clave = `${entrevista}/${candidato}/${pregunta}_1790872597410.webm`

// Las formas reales de las 1566 filas de respuestas_video
assert.deepEqual(extraerClaveVideo(`${origenes.r2PublicUrl}/${clave}`, origenes), { origen: 'r2', clave }, 'R2 (1554 filas)')
assert.deepEqual(
  extraerClaveVideo(`${origenes.supabaseOrigin}/storage/v1/object/public/videos-entrevista/${clave}`, origenes),
  { origen: 'supabase', clave }, 'Supabase Storage (2 filas)')
assert.equal(extraerClaveVideo('', origenes), null, 'fila vacia (8 filas con error de subida)')
assert.equal(extraerClaveVideo(null, origenes), null)
assert.equal(extraerClaveVideo(undefined, origenes), null)
assert.equal(extraerClaveVideo(42, origenes), null)
assert.deepEqual(extraerClaveVideo(`${origenes.r2PublicUrl}/bypass.mp4`, origenes), { origen: 'r2', clave: 'bypass.mp4' }, 'fila de prueba antigua en la raiz de R2: se puede leer')
assert.equal(extraerClaveVideo('https://www.google.com/some/example/video.mp4', origenes), null, 'URL ajena de ejemplo')

// Una URL guardada con ?query o #hash sigue dando la misma clave; el escape %XX se decodifica
assert.equal(extraerClaveVideo(`${origenes.r2PublicUrl}/${clave}?X-Amz-Signature=abc#t=3`, origenes)?.clave, clave)
assert.equal(extraerClaveVideo(`${origenes.r2PublicUrl}/${entrevista}/${candidato}/%70regunta.webm`, origenes)?.clave, `${entrevista}/${candidato}/pregunta.webm`)

// Nada que no sea de nuestros almacenes (SSRF) ni claves que se escapen
for (const mala of [
  `https://pub-8c13e3844d9c4aa0b884ae0b3c1093e3.r2.dev.evil.com/${clave}`,
  `https://pub-8c13e3844d9c4aa0b884ae0b3c1093e3.r2.dev@evil.com/${clave}`,
  `http://pub-8c13e3844d9c4aa0b884ae0b3c1093e3.r2.dev/${clave}`,
  `https://evil.com/${origenes.r2PublicUrl}/${clave}`,
  `https://evil.com/storage/v1/object/public/videos-entrevista/${clave}`,
  `${origenes.supabaseOrigin}/storage/v1/object/public/otro-bucket/${clave}`,
  `${origenes.supabaseOrigin}/storage/v1/object/sign/videos-entrevista/${clave}`,
  `${origenes.r2PublicUrl}/`,
  `${origenes.r2PublicUrl}`,
  `${origenes.r2PublicUrl}//${clave}`,
  `${origenes.r2PublicUrl}/${entrevista}//x.webm`,
  `${origenes.r2PublicUrl}/${entrevista}/../${otro}/x.webm`,
  `${origenes.r2PublicUrl}/${entrevista}/%2e%2e/${otro}/x.webm`,
  `${origenes.r2PublicUrl}/${entrevista}/%2E%2E%2F${otro}/x.webm`,
  `${origenes.r2PublicUrl}/${entrevista}/x%00.webm`,
  `${origenes.r2PublicUrl}/${entrevista}/%zz.webm`,
  `${origenes.r2PublicUrl}/${entrevista}\\x.webm`,
  `${origenes.r2PublicUrl}/.hidden.webm`,
  `${origenes.r2PublicUrl}/${'a'.repeat(600)}.webm`,
  `${origenes.r2PublicUrl}/${clave}`.padEnd(5000, 'a'),
]) {
  assert.equal(extraerClaveVideo(mala, origenes), null, `debe rechazar: ${mala.slice(0, 120)}`)
}

// Origen vacio (R2_PUBLIC_URL sin configurar): startsWith('') seria verdadero para todo, no debe reconocer nada
assert.equal(extraerClaveVideo(`${origenes.r2PublicUrl}/${clave}`, { r2PublicUrl: '', supabaseOrigin: '' }), null)
assert.equal(extraerClaveVideo('https://evil.com/x.webm', { r2PublicUrl: '', supabaseOrigin: '' }), null)
assert.equal(extraerClaveVideo('', { r2PublicUrl: '', supabaseOrigin: '' }), null)
// El origen con barra final configurada igual funciona
assert.equal(extraerClaveVideo(`${origenes.r2PublicUrl}/${clave}`, { ...origenes, r2PublicUrl: `${origenes.r2PublicUrl}/` })?.clave, clave)

// Al guardar: forma exacta y pertenencia a la entrevista y al candidato de la propia solicitud
assert.equal(claveVideoPerteneceA(clave, entrevista, candidato), true)
assert.equal(claveVideoPerteneceA(clave, entrevista, otro), false, 'video de OTRO candidato (el hueco que se cierra)')
assert.equal(claveVideoPerteneceA(clave, otro, candidato), false, 'otra entrevista')
assert.equal(claveVideoPerteneceA('bypass.mp4', entrevista, candidato), false, 'clave fuera de la forma de la plataforma')
assert.equal(claveVideoPerteneceA(`${entrevista}/${candidato}/x.html`, entrevista, candidato), false)
assert.equal(claveVideoPerteneceA(`${entrevista}/${candidato}/a/b.webm`, entrevista, candidato), false)
assert.equal(claveVideoPerteneceA(`${entrevista}/${candidato}/../${otro}/x.webm`, entrevista, candidato), false)
// El prefijo debe terminar en '/': un candidatoId que sea prefijo de otro no cuenta
assert.equal(claveVideoPerteneceA(`${entrevista}/${candidato}ZZ/x.webm`, entrevista, candidato), false)

console.log('✅ urls-video: las formas reales de url_video dan su clave, lo ajeno/escapado/vacio se rechaza, y al guardar la clave debe ser de la entrevista y el candidato de la solicitud')
