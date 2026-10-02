import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const { RUTAS_API_PUBLICAS, esRutaApiPublica, tokenAdminPlausible } = await import('../lib/server/rutasApi.ts')

// ---- 1. El inventario de app/api coincide con la politica de denegar por defecto ----
function archivosRoute(dir: string): string[] {
  return readdirSync(dir).flatMap(nombre => {
    const ruta = join(dir, nombre)
    return statSync(ruta).isDirectory() ? archivosRoute(ruta) : nombre === 'route.ts' ? [ruta] : []
  })
}
const base = join(process.cwd(), 'app', 'api')
const rutas = archivosRoute(base).map(archivo => {
  const ruta = '/api/' + relative(base, archivo).split(sep).slice(0, -1).join('/')
  const codigo = readFileSync(archivo, 'utf8')
  const metodos = [...codigo.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(m => m[1])
  return { ruta, codigo, metodos, archivo }
})
assert.ok(rutas.length >= 20, 'debe encontrar las rutas de app/api')

for (const r of rutas) {
  // El proxy compara rutas exactas: un segmento dinamico ([id]) no coincidiria con la lista
  assert.ok(!/[\[\]]/.test(r.ruta), `${r.ruta}: rutas dinamicas no estan contempladas por la lista publica`)
  const publica = RUTAS_API_PUBLICAS[r.ruta]
  const metodosAbiertos = publica ? publica.metodos : []
  const metodosCerrados = r.metodos.filter(m => !metodosAbiertos.includes(m))
  if (metodosCerrados.length > 0) {
    // Cualquier metodo que el proxy deje cerrado tiene que seguir verificando la sesion de administrador en la propia ruta
    assert.ok(r.codigo.includes('requireAdminSession'), `${r.ruta} (${metodosCerrados.join(', ')}) no esta declarada como publica en lib/server/rutasApi.ts y tampoco llama a requireAdminSession`)
  }
  if (publica) {
    assert.ok(r.codigo.includes(publica.marcador), `${r.ruta} esta declarada publica por "${publica.mecanismo}" pero su codigo no contiene "${publica.marcador}"`)
    for (const m of publica.metodos) assert.ok(r.metodos.includes(m), `${r.ruta} declara ${m} como publico pero la ruta no exporta ese metodo`)
  }
}
for (const ruta of Object.keys(RUTAS_API_PUBLICAS)) {
  assert.ok(rutas.some(r => r.ruta === ruta), `${ruta} esta en la lista de rutas publicas pero no existe en app/api`)
}
// Las rutas de administracion nunca pueden estar en la lista publica
assert.equal(Object.keys(RUTAS_API_PUBLICAS).filter(r => r.startsWith('/api/admin')).length, 0, 'ninguna ruta /api/admin puede ser publica')

// ---- 2. Que deja pasar el proxy ----
assert.equal(esRutaApiPublica('/api/unirse', 'POST'), true)
assert.equal(esRutaApiPublica('/api/unirse/', 'post'), true, 'barra final y minusculas')
assert.equal(esRutaApiPublica('/api/login', 'GET'), false, 'metodo no declarado')
assert.equal(esRutaApiPublica('/api/roleplay', 'DELETE'), false, 'metodo no declarado')
assert.equal(esRutaApiPublica('/api/progreso-evaluacion', 'GET'), false, 'el GET de progreso es solo para administradores')
assert.equal(esRutaApiPublica('/api/progreso-evaluacion', 'POST'), true)
assert.equal(esRutaApiPublica('/api/admin/panel-data', 'GET'), false)
assert.equal(esRutaApiPublica('/api/ruta-nueva', 'POST'), false, 'una ruta nueva queda cerrada hasta declararla')
assert.equal(esRutaApiPublica('/api/unirse/../admin/panel-data', 'POST'), false)
assert.equal(esRutaApiPublica('/api/unirse-x', 'POST'), false, 'coincidencia exacta, no por prefijo')

// ---- 3. Filtro de forma del token de sesion ----
const jwt = (payload: object) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`
}
const ahora = 1_800_000_000
const valido = `Bearer ${jwt({ role: 'authenticated', exp: ahora + 3600, email: 'a@b.c' })}`
assert.equal(tokenAdminPlausible(valido, ahora), true)
assert.equal(tokenAdminPlausible(null, ahora), false, 'sin encabezado')
assert.equal(tokenAdminPlausible('', ahora), false)
assert.equal(tokenAdminPlausible('Bearer ', ahora), false)
assert.equal(tokenAdminPlausible('Bearer basura', ahora), false)
assert.equal(tokenAdminPlausible('Bearer a.b.c', ahora), false, 'tres partes pero no es JSON')
assert.equal(tokenAdminPlausible('Bearer a.b', ahora), false)
assert.equal(tokenAdminPlausible(valido.replace('Bearer', 'Basic'), ahora), false, 'esquema distinto')
assert.equal(tokenAdminPlausible(`Bearer ${jwt({ role: 'authenticated', exp: ahora - 1 })}`, ahora), false, 'vencido')
assert.equal(tokenAdminPlausible(`Bearer ${jwt({ role: 'authenticated' })}`, ahora), false, 'sin vencimiento')
assert.equal(tokenAdminPlausible(`Bearer ${jwt({ role: 'authenticated', exp: String(ahora + 60) })}`, ahora), false, 'exp no numerico')
assert.equal(tokenAdminPlausible(`Bearer ${jwt({ role: 'anon', exp: ahora + 3600 })}`, ahora), false, 'la clave anonima publica no es una sesion')
assert.equal(tokenAdminPlausible(`Bearer ${jwt({ role: 'service_role', exp: ahora + 3600 })}`, ahora), false, 'service_role no se acepta como sesion')
assert.equal(tokenAdminPlausible(`Bearer ${jwt({ exp: ahora + 3600 })}`, ahora), false, 'sin rol')
assert.equal(tokenAdminPlausible(`Bearer ${jwt({ role: 'authenticated', exp: ahora + 3600 })}`.replace(/\.firma$/, '.'), ahora), false, 'firma vacia')

// ---- 4. Decision completa del proxy, con y sin 2FA obligatorio ----
{
  const { decidirAccesoApi, permiteAal1 } = await import('../lib/server/rutasApi.ts')
  const sesion = (aal?: string) => `Bearer ${jwt({ role: 'authenticated', exp: ahora + 3600, ...(aal ? { aal } : {}) })}`
  const d = (pathname: string, authorization: string | null, mfaObligatorio: boolean, metodo = 'GET') => decidirAccesoApi({ pathname, metodo, authorization, mfaObligatorio, ahoraSegundos: ahora })

  // 2FA apagado (por defecto): todo igual que antes
  assert.equal(d('/api/admin/panel-data', sesion('aal1'), false), 'permitir')
  assert.equal(d('/api/admin/panel-data', sesion(), false), 'permitir', 'token sin claim aal tambien pasa con el 2FA apagado')
  assert.equal(d('/api/admin/panel-data', null, false), 'sesion_requerida')
  // 2FA obligatorio: solo aal2
  assert.equal(d('/api/admin/panel-data', sesion('aal2'), true), 'permitir')
  assert.equal(d('/api/admin/panel-data', sesion('aal1'), true), 'mfa_requerido', 'solo contrasena no alcanza')
  assert.equal(d('/api/admin/panel-data', sesion(), true), 'mfa_requerido', 'sin claim no se asume aal2')
  assert.equal(d('/api/admin/panel-data', null, true), 'sesion_requerida', 'sin sesion sigue siendo 401 normal')
  assert.equal(d('/api/admin/panel-data', `Bearer ${jwt({ role: 'anon', exp: ahora + 3600, aal: 'aal2' })}`, true), 'sesion_requerida', 'la clave anonima no cuenta aunque diga aal2')
  assert.equal(d('/api/progreso-evaluacion', sesion('aal1'), true, 'GET'), 'mfa_requerido', 'el GET de progreso es de administracion')
  // whoami admite aal1 (la pantalla lo usa para saber a donde mandar a la cuenta); sigue exigiendo sesion
  assert.equal(permiteAal1('/api/admin/whoami'), true)
  assert.equal(permiteAal1('/api/admin/whoami/'), true)
  assert.equal(permiteAal1('/api/admin/panel-data'), false)
  assert.equal(permiteAal1('/api/admin/whoami-otro'), false)
  assert.equal(d('/api/admin/whoami', sesion('aal1'), true), 'permitir')
  assert.equal(d('/api/admin/whoami', null, true), 'sesion_requerida')
  // Las rutas publicas de los candidatos no se tocan con el 2FA obligatorio
  assert.equal(d('/api/unirse', null, true, 'POST'), 'permitir')
  assert.equal(d('/api/evaluacion/public-data', null, true, 'POST'), 'permitir')
  assert.equal(d('/api/login', null, true, 'POST'), 'permitir')
  assert.equal(d('/api/admin/panel-data', null, true, 'OPTIONS'), 'permitir', 'preflight')
}

console.log(`✅ rutas-api: las ${rutas.length} rutas de app/api estan clasificadas (${Object.keys(RUTAS_API_PUBLICAS).length} publicas con su mecanismo, el resto exige sesion), y el filtro del proxy rechaza tokens ausentes, vencidos, anonimos o malformados`)
