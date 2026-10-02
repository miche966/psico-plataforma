import assert from 'node:assert/strict'

const { claveDeServicio, clavePublica, tipoDeClave } = await import('../lib/server/clavesSupabase.ts')

const jwtClasico = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.firma-falsa'

// ---- Clave de servicio: la nueva gana; si falta o esta vacia, cae a la clasica ----
assert.equal(claveDeServicio({ SUPABASE_SECRET_KEY: 'sb_secret_n1', SUPABASE_SERVICE_ROLE_KEY: jwtClasico }), 'sb_secret_n1')
assert.equal(claveDeServicio({ SUPABASE_SERVICE_ROLE_KEY: jwtClasico }), jwtClasico, 'solo la clasica (estado actual de produccion)')
assert.equal(claveDeServicio({ SUPABASE_SECRET_KEY: 'sb_secret_n1' }), 'sb_secret_n1', 'solo la nueva (despues de quitar la clasica)')
assert.equal(claveDeServicio({ SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: jwtClasico }), jwtClasico, 'una variable vacia no pisa a la otra')
assert.equal(claveDeServicio({ SUPABASE_SECRET_KEY: '   ', SUPABASE_SERVICE_ROLE_KEY: jwtClasico }), jwtClasico, 'solo espacios cuenta como vacia')
assert.equal(claveDeServicio({ SUPABASE_SECRET_KEY: '  sb_secret_abc  ' }), 'sb_secret_abc', 'se recortan los espacios')
assert.equal(claveDeServicio({}), undefined)

// ---- Clave publica ----
assert.equal(clavePublica({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_n1', NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtClasico }), 'sb_publishable_n1')
assert.equal(clavePublica({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtClasico }), jwtClasico)
assert.equal(clavePublica({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' , NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtClasico }), jwtClasico)
assert.equal(clavePublica({}), undefined)
// La clave publica y la de servicio no se mezclan
assert.equal(clavePublica({ SUPABASE_SECRET_KEY: 'sb_secret_x' }), undefined, 'la secret nunca se toma como clave publica')
assert.equal(claveDeServicio({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }), undefined, 'la publishable nunca se toma como clave de servicio')

// ---- Tipo de clave (diagnostico) ----
assert.equal(tipoDeClave('sb_publishable_abc'), 'nueva')
assert.equal(tipoDeClave('sb_secret_abc'), 'nueva')
assert.equal(tipoDeClave(jwtClasico), 'clasica')
assert.equal(tipoDeClave('otra-cosa'), 'desconocida')
assert.equal(tipoDeClave(undefined), 'desconocida')
assert.equal(tipoDeClave(''), 'desconocida')

console.log('✅ claves-supabase: la clave nueva tiene prioridad, la clasica sirve de respaldo, las variables vacias no pisan a la otra y la publica y la de servicio nunca se confunden')
