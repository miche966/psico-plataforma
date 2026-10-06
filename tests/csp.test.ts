import assert from 'node:assert/strict'

const { construirCsp, generarNonce, resumirInformeCsp, RUTA_INFORMES_CSP } = await import('../lib/server/csp.ts')

const dir = (csp: string, nombre: string) => csp.split('; ').find(d => d.startsWith(nombre + ' ')) || ''

// ---- La politica vigente NO cambio: es exactamente la que sirve produccion hoy ----
const VIGENTE_PRODUCCION = "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://wzhdidxssnwfvzzapfwu.supabase.co; media-src 'self' blob: https://wzhdidxssnwfvzzapfwu.supabase.co https://video-psicoplataforma.8c662e7d3be33f7a66b01eefc1f0a051.r2.cloudflarestorage.com; connect-src 'self' https://wzhdidxssnwfvzzapfwu.supabase.co https://video-psicoplataforma.8c662e7d3be33f7a66b01eefc1f0a051.r2.cloudflarestorage.com; font-src 'self'; object-src 'none'; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
assert.equal(construirCsp(), VIGENTE_PRODUCCION)
assert.equal(construirCsp({ dev: true }), VIGENTE_PRODUCCION.replace("https://challenges.cloudflare.com; style-src", "https://challenges.cloudflare.com 'unsafe-eval'; style-src"), 'en desarrollo solo suma unsafe-eval')

// ---- La estricta: sin unsafe-inline en scripts, con nonce y strict-dynamic ----
{
  const nonce = 'AbCd1234EfGh5678IjKl90=='
  const csp = construirCsp({ nonce, reportUri: RUTA_INFORMES_CSP })
  const scripts = dir(csp, 'script-src')
  assert.match(scripts, new RegExp(`'nonce-${nonce.replace(/[=]/g, '\=')}'`))
  assert.match(scripts, /'strict-dynamic'/)
  assert.doesNotMatch(scripts, /unsafe-inline/, 'ahi esta el objetivo: nada en linea sin nonce')
  assert.doesNotMatch(scripts, /unsafe-eval/, 'en produccion no se permite eval')
  assert.match(construirCsp({ nonce, dev: true }), /script-src[^;]*'unsafe-eval'/, 'en desarrollo si (React lo usa)')
  assert.match(csp, /report-uri \/api\/csp-report$/)
  // Todo lo demas es identico a la vigente: mismos origenes, mismos bloqueos
  for (const d of ["default-src", "style-src", "img-src", "media-src", "connect-src", "font-src", "object-src", "frame-src", "frame-ancestors", "base-uri", "form-action"]) {
    assert.equal(dir(csp, d), dir(VIGENTE_PRODUCCION, d), `${d} no cambia`)
  }
  assert.doesNotMatch(csp, /\*/, 'sin comodines')
  // Sin reportUri no se agrega la directiva
  assert.doesNotMatch(construirCsp({ nonce }), /report-uri/)
}

// ---- El nonce: distinto en cada llamada, base64 valido y con entropia suficiente ----
{
  const vistos = new Set<string>()
  for (let i = 0; i < 500; i++) vistos.add(generarNonce())
  assert.equal(vistos.size, 500, 'nunca se repite')
  for (const n of vistos) {
    assert.match(n, /^[A-Za-z0-9+/]{22}==$/, '16 bytes en base64')
    assert.equal(Buffer.from(n, 'base64').length, 16)
  }
}

// ---- Resumen de informes: seguro para el log (sin parametros de consulta ni datos personales) ----
{
  const l = resumirInformeCsp({ 'csp-report': {
    'document-uri': 'https://psico-plataforma.vercel.app/evaluacion?candidato=abc&proceso=def&token=SECRETO123#frag',
    'effective-directive': 'script-src-elem', 'blocked-uri': 'https://evil.example/x.js?robo=1', 'violated-directive': 'script-src',
  } })
  assert.equal(l, 'directiva=script-src-elem bloqueado=https://evil.example pagina=/evaluacion')
  assert.doesNotMatch(String(l), /SECRETO123|candidato=|robo/)
}
assert.equal(resumirInformeCsp({ 'csp-report': { 'document-uri': 'https://x.test/login', 'violated-directive': 'script-src', 'blocked-uri': 'inline' } }), 'directiva=script-src bloqueado=inline pagina=/login')
assert.equal(resumirInformeCsp({ 'csp-report': { 'document-uri': 'https://x.test/a', 'violated-directive': 'script-src', 'blocked-uri': 'eval' } }), 'directiva=script-src bloqueado=eval pagina=/a')
// Basura, vacio o sin directiva: se descarta
for (const malo of [null, undefined, 'texto', 42, [], {}, { 'csp-report': null }, { 'csp-report': 'x' }, { 'csp-report': {} }, { 'csp-report': { 'blocked-uri': 'inline' } }]) assert.equal(resumirInformeCsp(malo), null, `descarta ${JSON.stringify(malo)}`)
// Caracteres de control y largos desmedidos: no pasan al log
{
  const l = String(resumirInformeCsp({ 'csp-report': { 'violated-directive': 'script-src\n[FALSO] linea inyectada', 'document-uri': 'https://x.test/' + 'a'.repeat(5000), 'blocked-uri': 'z'.repeat(5000) } }))
  assert.doesNotMatch(l, /\n|\r/)
  assert.ok(l.length < 300, `linea acotada (${l.length})`)
}

console.log('✅ csp: la politica vigente es exactamente la de produccion, la estricta no permite scripts en linea sin nonce y conserva los mismos origenes, el nonce no se repite, y los informes se resumen sin parametros ni datos personales')
