import assert from 'node:assert/strict'

const { normalizarPuntaje, colorPuntaje } = await import('../lib/puntajes.ts')

// Neuroticismo: comportamiento ya existente, no debe cambiar (regresión).
{
  assert.equal(normalizarPuntaje(1, 'neuroticismo'), 5, 'neuroticismo bajo (estable) -> estabilidad_emocional alta')
  assert.equal(normalizarPuntaje(5, 'neuroticismo'), 1, 'neuroticismo alto (inestable) -> estabilidad_emocional baja')
}

// Caso real Estrés Laboral (bug corregido 2026-08-06): los 5 factores numéricos se guardan
// como "frecuencia del síntoma" (1 = casi nunca le pasa = bueno, 5 = le pasa siempre = malo).
// Antes de este fix, un candidato con excelente manejo del estrés (puntaje crudo bajo) se
// mostraba con la interpretación de "en riesgo" (rojo). Deben invertirse igual que neuroticismo.
{
  for (const factor of ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'carga_laboral']) {
    const bienestarExcelente = normalizarPuntaje(1.25, factor)
    const bienestarPobre = normalizarPuntaje(4.8, factor)
    assert.ok(bienestarExcelente >= 4, `${factor}=1.25 (casi nunca el síntoma) debe leerse como favorable (verde), fue ${bienestarExcelente}`)
    assert.ok(bienestarPobre <= 1.5, `${factor}=4.8 (síntoma casi siempre) debe leerse como desfavorable (rojo), fue ${bienestarPobre}`)
    assert.ok(bienestarExcelente > bienestarPobre, `${factor}: un puntaje crudo más bajo (mejor) debe normalizar más alto que uno peor`)
  }
}

// nivel_estres se guarda como string ('bajo'/'moderado'/'alto'), no como número 1-5, y con el
// mismo problema de dirección: "bajo" nivel de estrés es la buena noticia.
{
  assert.ok(normalizarPuntaje('bajo', 'nivel_estres') >= 4, 'nivel_estres "bajo" (poca tensión) debe normalizar alto/favorable')
  assert.ok(normalizarPuntaje('alto', 'nivel_estres') <= 1.5, 'nivel_estres "alto" (mucha tensión) debe normalizar bajo/desfavorable')
  const medio = normalizarPuntaje('medio', 'nivel_estres')
  const moderado = normalizarPuntaje('moderado', 'nivel_estres')
  assert.equal(medio, moderado, '"medio" y "moderado" deben tratarse igual (antes "moderado" no matcheaba y caía a 0)')
  assert.equal(moderado, 3, 'nivel_estres "moderado" debe quedar en el punto medio de la escala')
}

// Un factor ajeno a Estrés Laboral no debe invertirse (guarda contra una inversión demasiado amplia).
{
  assert.equal(normalizarPuntaje(4, 'extraversion'), 4, 'factores fuera de la lista de Estrés Laboral no se invierten')
}

// colorPuntaje: sigue siendo un mapeo directo alto=verde/bajo=rojo — la corrección de dirección
// vive en normalizarPuntaje, no acá, así que colorPuntaje no necesita saber de factores.
{
  assert.equal(colorPuntaje(4.5), '#059669')
  assert.equal(colorPuntaje(1), '#dc2626')
}

console.log('✅ normalizarPuntaje: neuroticismo (regresión), inversión de los 5 factores numéricos de Estrés Laboral, nivel_estres como string (incluyendo el fix de "moderado"), y factores ajenos sin invertir')
