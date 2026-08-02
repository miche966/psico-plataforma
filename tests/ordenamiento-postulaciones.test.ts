/**
 * tests/ordenamiento-postulaciones.test.ts
 *
 * Suite automatizada que cubre:
 *  - Ordenamiento cronológico de postulaciones (lógica productiva real).
 *  - Resolución jerárquica de interpretaciones (importando el módulo productivo real).
 */

import {
  formatearFecha,
  ordenarPorPostulacionDescendente,
  ordenarPorPostulacionAscendente,
} from '../lib/postulaciones/ordenamiento.ts'

import {
  normalizarContextoInterpretacion,
  obtenerInterpretacion,
} from '../lib/interpretaciones/resolver.ts'

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const candidatosMock = [
  { nombre: 'Carlos', apellido: 'Zunino', fecha_postulacion: null },
  { nombre: 'Ana', apellido: 'Alvarez', fecha_postulacion: '2026-07-29T18:55:17.417Z' },
  { nombre: 'Bruno', apellido: 'Bastos', fecha_postulacion: '2026-04-25T23:07:04.660Z' },
  { nombre: 'Elena', apellido: 'Gomez', fecha_postulacion: '' },
  { nombre: 'David', apellido: 'Diaz', fecha_postulacion: 'fecha-invalida' },
  { nombre: 'Clara', apellido: 'Castro', fecha_postulacion: '2026-06-15T12:00:00.000Z' },
]

const diccionario = {
  matrices:                     { alto: { desc: 'GENERICA_MATRICES',                  q: 'Q' } },
  matrices_icar:                { alto: { desc: 'ICAR_ESPECIFICA_MATRICES',           q: 'Q' } },
  etica:                        { alto: { desc: 'GENERICA_ETICA',                     q: 'Q' } },
  sjt_atencion_etica:           { alto: { desc: 'SJT_ATENCION_ETICA_ESPECIFICA',      q: 'Q' } },
  negociacion:                  { alto: { desc: 'GENERICA_NEGOCIACION',               q: 'Q' } },
  sjt_comercial_negociacion:    { alto: { desc: 'SJT_COMERCIAL_NEGOCIACION_ESPECIFICA', q: 'Q' } },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let pasa = 0
let falla = 0

function assert(etiqueta: string, condicion: boolean, info?: string) {
  if (condicion) {
    console.log(` ✅ ${etiqueta}`)
    pasa++
  } else {
    console.error(` ❌ ${etiqueta}${info ? ' — ' + info : ''}`)
    falla++
  }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

console.log('===================================================================')
console.log('  SUITE AUTOMATIZADA: ORDENAMIENTO + RESOLUCIÓN PRODUCTIVA REAL')
console.log('===================================================================\n')

// BLOQUE 1: Ordenamiento cronológico
console.log('📥 PRUEBA 1: Orden Descendente (Más recientes primero):')
const copiaOriginal = JSON.parse(JSON.stringify(candidatosMock))
const desc = [...candidatosMock].sort(ordenarPorPostulacionDescendente)
desc.forEach((c, idx) => {
  console.log(` [#${idx + 1}] ${c.nombre} ${c.apellido} | Raw: ${c.fecha_postulacion} | "${formatearFecha(c.fecha_postulacion)}"`)
})

console.log('\n📤 PRUEBA 2: Orden Ascendente (Más antiguas primero):')
const asc = [...candidatosMock].sort(ordenarPorPostulacionAscendente)
asc.forEach((c, idx) => {
  console.log(` [#${idx + 1}] ${c.nombre} ${c.apellido} | Raw: ${c.fecha_postulacion} | "${formatearFecha(c.fecha_postulacion)}"`)
})

const ultimosDesc = desc.slice(3).map(c => c.nombre)
const ultimosAsc  = asc.slice(3).map(c => c.nombre)
const invalidos = ['Carlos', 'Elena', 'David']

assert('Ordenamiento (1): Fechas inválidas/nulas al final — descendente',
  ultimosDesc.every(n => invalidos.includes(n)))
assert('Ordenamiento (2): Fechas inválidas/nulas al final — ascendente',
  ultimosAsc.every(n => invalidos.includes(n)))
assert('Ordenamiento (3): Array original inmutable',
  JSON.stringify(candidatosMock) === JSON.stringify(copiaOriginal))
assert('Ordenamiento (4): formatearFecha(null) → "Fecha no disponible"',
  formatearFecha(null) === 'Fecha no disponible')
assert('Ordenamiento (5): formatearFecha("invalida") → "Fecha no disponible"',
  formatearFecha('invalida') === 'Fecha no disponible')

// BLOQUE 2: Normalización de contexto (módulo productivo real)
console.log('\n🔧 PRUEBA 3: normalizarContextoInterpretacion (módulo productivo real):')

assert('Norm (1): "icar" → "icar"',
  normalizarContextoInterpretacion('icar') === 'icar')
assert('Norm (2): UUID ICAR con señal → "icar"',
  normalizarContextoInterpretacion('test-icar-abc-123') === 'icar')
assert('Norm (3): "sjt-atencion" → "sjt_atencion"',
  normalizarContextoInterpretacion('sjt-atencion') === 'sjt_atencion')
assert('Norm (4): "sjt-comercial" → "sjt_comercial"',
  normalizarContextoInterpretacion('sjt-comercial') === 'sjt_comercial')
assert('Norm (5): UUID v4 sin señal conocida → undefined',
  normalizarContextoInterpretacion('a1b2c3d4-e5f6-7890-abcd-ef1234567890') === undefined)
assert('Norm (6): undefined → undefined',
  normalizarContextoInterpretacion(undefined) === undefined)
assert('Norm (7): cadena vacía → undefined',
  normalizarContextoInterpretacion('') === undefined)

// BLOQUE 3: Resolución de interpretaciones (módulo productivo real)
console.log('\n🔑 PRUEBA 4: obtenerInterpretacion (módulo productivo real):')

// Caso 1: factor matrices + contexto icar → ICAR gana
const caso1 = obtenerInterpretacion(diccionario, 'matrices', 'alto', 'icar')
assert('Interp (1): matrices + ctx icar → ICAR_ESPECIFICA_MATRICES',
  caso1?.desc === 'ICAR_ESPECIFICA_MATRICES', caso1?.desc)

// Caso 2: factor etica + contexto sjt_atencion → SJT_ATENCION gana
const caso2 = obtenerInterpretacion(diccionario, 'etica', 'alto', 'sjt_atencion')
assert('Interp (2): etica + ctx sjt_atencion → SJT_ATENCION_ETICA_ESPECIFICA',
  caso2?.desc === 'SJT_ATENCION_ETICA_ESPECIFICA', caso2?.desc)

// Caso 3: factor negociacion + contexto sjt_comercial → COMERCIAL gana
const caso3 = obtenerInterpretacion(diccionario, 'negociacion', 'alto', 'sjt_comercial')
assert('Interp (3): negociacion + ctx sjt_comercial → SJT_COMERCIAL_NEGOCIACION_ESPECIFICA',
  caso3?.desc === 'SJT_COMERCIAL_NEGOCIACION_ESPECIFICA', caso3?.desc)

// Caso 4: factor matrices SIN contexto → genérica
const caso4 = obtenerInterpretacion(diccionario, 'matrices', 'alto')
assert('Interp (4): matrices sin contexto → GENERICA_MATRICES',
  caso4?.desc === 'GENERICA_MATRICES', caso4?.desc)

// Caso 5: factor matrices con contexto sjt_atencion → no existe específica → genérica (compatible, no contamina otro dominio)
const caso5 = obtenerInterpretacion(diccionario, 'matrices', 'alto', 'sjt_atencion')
assert('Interp (5): matrices + ctx sjt_atencion sin específica → genérica (no null)',
  caso5 !== null, String(caso5?.desc))

// Caso 6: factor inexistente → null
const caso6 = obtenerInterpretacion(diccionario, 'factor_que_no_existe', 'alto')
assert('Interp (6): factor inexistente → null',
  caso6 === null)

// Caso 7: el diccionario no es mutado
const copia = JSON.parse(JSON.stringify(diccionario))
obtenerInterpretacion(diccionario, 'matrices', 'alto', 'icar')
assert('Interp (7): diccionario inmutable tras resolución',
  JSON.stringify(diccionario) === JSON.stringify(copia))

// Caso 8: UUID con señal "icar" es normalizado y resuelve específica
const ctxDeUUID = normalizarContextoInterpretacion('uuid-abc-icar-xyz')
const caso8 = obtenerInterpretacion(diccionario, 'matrices', 'alto', ctxDeUUID)
assert('Interp (8): UUID con señal icar → normaliza + resuelve ICAR_ESPECIFICA_MATRICES',
  caso8?.desc === 'ICAR_ESPECIFICA_MATRICES', caso8?.desc)

// Caso 9: UUID desconocido → no transforma → no contamina
const ctxDesconocido = normalizarContextoInterpretacion('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
assert('Interp (9): UUID desconocido no genera alias arbitrario',
  ctxDesconocido === undefined)

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log('\n===================================================================')
console.log(`  RESULTADO: ${pasa} ✅ pasaron / ${falla} ❌ fallaron`)
console.log('===================================================================')

if (falla === 0) {
  console.log('\n✨ SUITE DE PRUEBAS COMPLETADA CON ÉXITO ✨\n')
  process.exit(0)
} else {
  console.error('\n❌ SUITE DE PRUEBAS FALLIDA ❌\n')
  process.exit(1)
}
