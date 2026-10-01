import assert from 'node:assert/strict'

const { crearClienteLogin } = await import('../lib/server/clienteLogin.ts')

// Regresion real: /api/login creaba el cliente solo con { persistSession: false }. En Node eso deja
// activo el timer de auto-refresh, que ~1 hora despues renovaba la sesion en el servidor, gastaba el
// refresh token del administrador y le cerraba la sesion en el navegador ("Already Used").
const cliente = crearClienteLogin('https://ejemplo.supabase.co', 'clave-anon-de-prueba')
await new Promise(r => setTimeout(r, 300))
const ticker = (cliente.auth as any).autoRefreshTicker
await cliente.auth.stopAutoRefresh()

assert.equal(ticker, null, 'el cliente de login no debe tener timer de auto-refresh en el servidor')

console.log('✅ cliente-login: el cliente de /api/login no arranca el auto-refresh, asi que no consume el refresh token del administrador')
