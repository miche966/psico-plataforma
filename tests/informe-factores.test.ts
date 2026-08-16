import assert from 'node:assert/strict'

const { construirFactoresCrudos } = await import('../lib/informeFactores.ts')

// Caso real que motivo el fix (2026-08-15): Atencion al Detalle con un sub-factor en 0 de 2
// (Precision en Datos de Texto) se perdia por completo porque otro sub-factor del MISMO test
// (u otro test de la bateria) pisaba la clave generica "correctas"/"total" despues.
{
  const sesiones = [{
    test_id: 'b8c9d0e1-f2a3-4567-bcde-888888888888', // atencion-detalle
    puntaje_bruto: {
      total: 20, correctas: 13, porcentaje: 65,
      por_factor: {
        documentos: { total: 4, correctas: 2 },
        comparacion: { total: 4, correctas: 4 },
        concentracion: { total: 4, correctas: 3 },
        errores_texto: { total: 2, correctas: 0 },
        errores_numeros: { total: 6, correctas: 4 },
      }
    }
  }]
  const f = construirFactoresCrudos(sesiones)
  assert.equal(f.errores_texto, 0, 'errores_texto (0 de 2) debe llegar como 0/5, no perderse por colision')
  assert.equal(f.documentos, 2.5, 'documentos (2 de 4) -> 2.5/5')
  assert.equal(f.comparacion, 5, 'comparacion (4 de 4) -> 5/5')
  assert.equal(f.concentracion, 3.75, 'concentracion (3 de 4) -> 3.75/5')
  assert.equal(f.errores_numeros, Math.round((4 / 6) * 500) / 100, 'errores_numeros (4 de 6) normalizado correctamente')
  assert.equal(f.atencion_detalle_general, 3.25, 'puntaje global del test (13 de 20) namespaceado como "atencion_detalle_general"')
  assert.ok(!('total' in f) && !('correctas' in f) && !('porcentaje' in f), 'las claves genericas sueltas no deben quedar en el resultado')
}

// Verbal y Numerico no tienen desglose por factor (solo total/correctas/porcentaje en la raiz):
// antes del fix, el segundo test procesado pisaba el resultado del primero por completo.
{
  const sesiones = [
    { test_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', puntaje_bruto: { total: 20, correctas: 18, porcentaje: 90 } }, // verbal
    { test_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012', puntaje_bruto: { total: 20, correctas: 14, porcentaje: 70 } }, // numerico
  ]
  const f = construirFactoresCrudos(sesiones)
  assert.equal(f.verbal_general, 4.5, 'Verbal (18/20) no debe perderse ni mezclarse con Numerico')
  assert.equal(f.numerico_general, 3.5, 'Numerico (14/20) no debe perderse ni mezclarse con Verbal')
}

// ICAR: el puntaje global convive con el desglose por sub-tipo (series/matrices/rotacion) sin pisarse.
{
  const sesiones = [{
    test_id: 'f6a7b8c9-d0e1-2345-fabc-456789012345', // icar
    puntaje_bruto: {
      total: 20, correctas: 15, porcentaje: 75, nivel_maximo: 3,
      por_subtipo: {
        series: { total: 12, correctas: 11 },
        matrices: { total: 5, correctas: 2 },
        rotacion: { total: 3, correctas: 2 },
      }
    }
  }]
  const f = construirFactoresCrudos(sesiones)
  assert.equal(f.icar_general, 3.75, 'puntaje global de ICAR preservado')
  assert.equal(f.series, Math.round((11 / 12) * 500) / 100, 'series preservado con su propio nombre')
  assert.equal(f.matrices, 2, 'matrices (2 de 5) -> 2/5')
  assert.equal(f.rotacion, Math.round((2 / 3) * 500) / 100, 'rotacion preservado con su propio nombre')
}

// Regresion: factores de personalidad (numeros planos, sin total/correctas) siguen funcionando igual.
{
  const sesiones = [{
    test_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // bigfive
    puntaje_bruto: { apertura: 4, amabilidad: 4.5, extraversion: 3.8, neuroticismo: 2.8, responsabilidad: 4.2 }
  }]
  const f = construirFactoresCrudos(sesiones)
  assert.equal(f.apertura, 4)
  assert.equal(f.amabilidad, 4.5)
  assert.equal(f.estabilidad_emocional, 6 - 2.8, 'neuroticismo se invierte a estabilidad_emocional como antes')
  assert.ok(!('neuroticismo' in f), 'la clave neuroticismo original se elimina como antes')
}

// Regresion: Estres Laboral sigue invirtiendo burnout/equilibrio/relaciones/claridad_rol/carga_laboral.
{
  const sesiones = [{
    test_id: 'd0e1f2a3-b4c5-6789-defa-000000000001', // estres-laboral
    puntaje_bruto: { burnout: 1.5, equilibrio: 1.3, relaciones: 1.7, claridad_rol: 1.8, carga_laboral: 2, promedio_general: 1.7 }
  }]
  const f = construirFactoresCrudos(sesiones)
  assert.ok(f.burnout >= 4, 'burnout=1.5 (poco sintoma) debe leerse favorable tras la inversion')
  assert.ok(f.equilibrio >= 4, 'equilibrio=1.3 (poco sintoma) debe leerse favorable tras la inversion')
}

console.log('✅ construirFactoresCrudos: sub-factores con nombre propio no colisionan entre si (caso real Precision en Datos de Texto), Verbal/Numerico namespaceados, ICAR con desglose + global, y regresión de personalidad/Estrés Laboral intacta')
