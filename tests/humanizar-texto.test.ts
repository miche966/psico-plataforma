import assert from 'node:assert/strict'

const { humanizarTexto } = await import('../lib/humanizarTexto.ts')

// ---- Palabras comunes del español: la prosa no se toca (el caso real "las sentido ético preestablecidas") ----
const prosa: Array<[string, string]> = [
  ['Se apoya en las normas preestablecidas para evitar errores de registro.', 'Se apoya en las normas preestablecidas para evitar errores de registro.'],
  ['Muestra apertura a nuevas ideas y un equilibrio adecuado entre sus tareas.', 'Muestra apertura a nuevas ideas y un equilibrio adecuado entre sus tareas.'],
  ['Valora el logro de metas y las relaciones con sus compañeros.', 'Valora el logro de metas y las relaciones con sus compañeros.'],
  ['Su liderazgo y su dinamismo ayudan al equipo, con resiliencia ante la presión.', 'Su liderazgo y su dinamismo ayudan al equipo, con resiliencia ante la presión.'],
  ['Revisa documentos con honestidad y cuida su autoestima.', 'Revisa documentos con honestidad y cuida su autoestima.'],
  ['Mantiene la comunicación y la negociación con calma.', 'Mantiene la comunicación y la negociación con calma.'],
]
for (const [entrada, esperado] of prosa) assert.equal(humanizarTexto(entrada), esperado, entrada)

// Ninguna frase ya limpia contiene restos de etiquetas internas
for (const [entrada] of prosa) {
  const salida = humanizarTexto(entrada)
  assert.ok(!/apego a normas|sentido ético|apertura a la experiencia|balance vida-trabajo|orientación al logro|liderazgo estratégico/i.test(salida), salida)
}

// ---- Identificadores tecnicos: se cambian por su etiqueta (en minusculas) ----
assert.equal(humanizarTexto('Su promedio_general es alto.'), 'Su índice de integridad personal es alto.')
assert.equal(humanizarTexto('Mejora la tolerancia_frustracion con pausas.'), 'Mejora la tolerancia a la presión con pausas.')
assert.equal(humanizarTexto('El factor errores-texto aparece bajo.'), 'El factor precisión en datos de texto aparece bajo.')
assert.equal(humanizarTexto('Presenta neuroticismo bajo.'), 'Presenta estabilidad emocional bajo.')
assert.equal(humanizarTexto('Hay riesgo de burnout.'), 'Hay riesgo de nivel de bienestar y energía.')
// Con espacio es prosa y no se toca
assert.equal(humanizarTexto('Su promedio general es alto.'), 'Su promedio general es alto.')
assert.equal(humanizarTexto('Muestra un buen manejo emocional.'), 'Muestra un buen manejo emocional.')

// ---- Lo demas del saneador sigue igual ----
assert.equal(humanizarTexto('Ana mostró una actitud crucial en la prueba.', 'Ana'), 'El candidato mostró una actitud relevante en la prueba.')
assert.equal(humanizarTexto('El ICAR y el DASS-21 no se nombran.'), 'El capacidad cognitiva y el bienestar emocional no se nombran.')
assert.equal(humanizarTexto('**Texto** con negritas.'), 'Texto con negritas.')
assert.equal(humanizarTexto('el puntaje es NaN. otro.'), 'El puntaje es adecuado. Otro.')
assert.ok(!/alineamiento de expectativas/i.test(humanizarTexto('cumple el alineamiento de expectativas del cliente')))
assert.equal(humanizarTexto(''), '')
assert.equal(humanizarTexto(undefined as any), undefined)

// Aplicarlo dos veces da lo mismo y puede repetirse (las expresiones son globales y se reutilizan)
const una = humanizarTexto('Su promedio_general y su neuroticismo. Las normas.')
assert.equal(humanizarTexto(una), una)
assert.equal(humanizarTexto('Su promedio_general y su neuroticismo. Las normas.'), una)

console.log('✅ humanizar-texto: las palabras comunes (normas, apertura, equilibrio, logro, relaciones...) ya no se reemplazan por etiquetas; solo los identificadores técnicos; el resto del saneador sigue igual')
