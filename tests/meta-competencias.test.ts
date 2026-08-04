import assert from 'node:assert/strict'

const { calcularMetaCompetencias } = await import('../lib/metaCompetencias.ts')

// Sin datos: no fabrica ningún número, devuelve objeto vacío.
{
  const r = calcularMetaCompetencias({})
  assert.deepEqual(r, {}, 'sin factores disponibles no debe inventar valores')
}

// Resiliencia debe anclarse a los mismos factores que Bienestar (equilibrio/burnout/estabilidad_emocional),
// para que no pueda contradecir esa sección como pasaba con la estimación libre de la IA.
{
  const bajoBienestar = calcularMetaCompetencias({ equilibrio: 1.5, burnout: 1.8, estabilidad_emocional: 2 })
  assert.ok(bajoBienestar.resiliencia! < 40, `con bienestar muy bajo, resiliencia calculada debe ser baja (fue ${bajoBienestar.resiliencia})`)

  const altoBienestar = calcularMetaCompetencias({ equilibrio: 4.8, burnout: 4.9, estabilidad_emocional: 4.7 })
  assert.ok(altoBienestar.resiliencia! > 85, `con bienestar muy alto, resiliencia calculada debe ser alta (fue ${altoBienestar.resiliencia})`)
}

// Comunicación se deriva de extraversion (escala 0-5 -> 0-100).
{
  const r = calcularMetaCompetencias({ extraversion: 4 })
  assert.equal(r.comunicacion, 80)
}

// Colaboración promedia amabilidad y relaciones cuando ambos están disponibles.
{
  const r = calcularMetaCompetencias({ amabilidad: 3, relaciones: 5 })
  assert.equal(r.colaboracion, 80) // promedio 4/5 -> 80
}

// Si falta un factor de un grupo, se calcula igual con los disponibles (no se omite el campo entero).
{
  const r = calcularMetaCompetencias({ amabilidad: 4 })
  assert.equal(r.colaboracion, 80)
}

// liderazgo/autogestión se deriva de responsabilidad + logro.
{
  const r = calcularMetaCompetencias({ responsabilidad: 5, logro: 5 })
  assert.equal(r.liderazgo, 100)
}

// adaptabilidad se deriva de apertura + dinamismo.
{
  const r = calcularMetaCompetencias({ apertura: 4.1 })
  assert.equal(r.adaptabilidad, 82)
}

console.log('✅ calcularMetaCompetencias: sin datos no inventa valores, resiliencia coherente con bienestar, y cada habilidad deriva de sus factores reales')
