import assert from 'node:assert/strict'

const { similitudTexto, detectarRedundanciaNarrativa, detectarInconsistenciasNumericas, detectarTemas, detectarFrasesTematicamenteRedundantes } = await import('../lib/informeConsistencia.ts')

// Dos frases sin relación deben tener similitud baja.
{
  const s = similitudTexto('Muestra facilidad para entablar diálogos y relacionarse con otros.', 'Percibe que el volumen de tareas actual supera su capacidad de organización.')
  assert.ok(s < 0.2, `frases no relacionadas deben tener baja similitud (fue ${s})`)
}

// La misma idea reformulada con sinónimos debe detectarse como redundante.
{
  const s = similitudTexto(
    'Encuentra facilidad para entablar diálogos y relacionarse con otros en el equipo.',
    'Su facilidad para comunicarse y relacionarse con otros resulta valorable en el equipo.'
  )
  assert.ok(s >= 0.35, `parafraseo de la misma idea debe superar el umbral de redundancia (fue ${s})`)
}

// detectarRedundanciaNarrativa encuentra el par cuando dos campos repiten la misma idea.
{
  const informe = {
    ajusteCargo: { analisis: 'Muestra una notable capacidad para organizarse y cumplir con sus responsabilidades diarias.' },
    resumenEjecutivo: 'La persona evaluada demuestra una notable capacidad para organizarse y cumplir sus responsabilidades diarias sin desviarse.',
    fundamentacion: 'Se recomienda por su ajuste al puesto y su estilo de comunicación directo.',
    fortalezas: [],
    oportunidadesMejora: [],
  }
  const pares = detectarRedundanciaNarrativa(informe)
  assert.ok(pares.some(p => [p.campoA, p.campoB].includes('ajusteCargo.analisis') && [p.campoA, p.campoB].includes('resumenEjecutivo')),
    'debe detectar que ajusteCargo.analisis y resumenEjecutivo repiten la misma idea')
}

// Sin redundancia real, no debe reportar falsos positivos entre campos claramente distintos.
{
  const informe = {
    ajusteCargo: { analisis: 'El puesto requiere trato telefónico sostenido; el perfil se adapta a ese ritmo.' },
    resumenEjecutivo: 'Persiste una tensión entre el orden en las tareas y el desgaste que le genera la exposición constante a reclamos.',
    fundamentacion: 'Se recomienda con reservas por los indicadores de bienestar por debajo del promedio esperado.',
    fortalezas: [],
    oportunidadesMejora: [],
  }
  const pares = detectarRedundanciaNarrativa(informe)
  assert.equal(pares.length, 0, `no deberia marcar redundancia entre campos con contenido distinto (encontro: ${JSON.stringify(pares)})`)
}

// detectarInconsistenciasNumericas: divergencia grande entre Resiliencia y Bienestar debe alertar.
{
  const alertas = detectarInconsistenciasNumericas({ resiliencia: 75, bienestarPromedio100: 30 })
  assert.equal(alertas.length, 1)
  assert.equal(alertas[0].etiqueta, 'Resiliencia vs. Bienestar')
}

// Sin divergencia relevante, no debe alertar.
{
  const alertas = detectarInconsistenciasNumericas({ resiliencia: 40, bienestarPromedio100: 36, comunicacion: 80, extraversion100: 76 })
  assert.equal(alertas.length, 0)
}

// Si falta uno de los dos valores, no puede compararse: no debe alertar (no inventa datos faltantes).
{
  const alertas = detectarInconsistenciasNumericas({ resiliencia: 75 })
  assert.equal(alertas.length, 0)
}

// detectarTemas: reconoce el mismo tema aunque el texto esté parafraseado con sinónimos
// (caso real observado: "afinidad notable" vs "alineación profunda").
{
  const t1 = detectarTemas('El perfil demuestra una afinidad notable con las demandas del puesto.')
  const t2 = detectarTemas('El perfil demuestra una alineación profunda con las competencias requeridas.')
  assert.ok(t1.has('ajuste_general_puesto'), 'debe detectar el tema de ajuste general en el primer texto')
  assert.ok(t2.has('ajuste_general_puesto'), 'debe detectar el mismo tema en el parafraseo')
}

// detectarFrasesTematicamenteRedundantes: marca una frase que repite, sin agregar nada, el
// tema de un texto anterior — caso real observado entre un área de desarrollo y el resumen ejecutivo.
{
  const areaDesarrollo = 'El perfil muestra una inclinación a invertir un esfuerzo significativo en el trabajo, lo que podría llevar a una percepción de desequilibrio entre su vida personal y profesional.'
  const resumenConFraseRedundante = 'La predisposición del perfil a dedicar un esfuerzo considerable en el ámbito laboral, que podría generar un desequilibrio. Sin embargo, esto se ve atenuado por una notable capacidad de adaptación y aprendizaje continuo ante nuevas ideas.'

  const redundantes = detectarFrasesTematicamenteRedundantes(resumenConFraseRedundante, [areaDesarrollo])
  assert.equal(redundantes.length, 1, `debe marcar solo la primera oración como redundante (encontró: ${JSON.stringify(redundantes)})`)
  assert.ok(redundantes[0].frase.includes('esfuerzo considerable'), 'la frase marcada debe ser la que repite el tema, no la que agrega adaptación')
}

// Caso real observado en el informe de Lorena González: "carga laboral" (diccionario original)
// y "carga de trabajo" (variante que usó Gemini) deben reconocerse como el mismo tema.
{
  const areaDesarrollo = 'El perfil muestra una tendencia a percibir una carga de trabajo elevada y un desbalance entre las demandas laborales y el tiempo personal.'
  const perfilConFraseRedundante = 'Si bien posee una habilidad desarrollada para equilibrar la empatía con la determinación, es importante considerar su tendencia a percibir una carga de trabajo elevada.'

  const redundantes = detectarFrasesTematicamenteRedundantes(perfilConFraseRedundante, [areaDesarrollo])
  assert.equal(redundantes.length, 1, `debe marcar la frase que repite "carga de trabajo elevada" (encontró: ${JSON.stringify(redundantes)})`)
  assert.ok(redundantes[0].frase.includes('carga de trabajo elevada'), 'la frase marcada debe ser la que repite el tema de carga de trabajo')
}

// Una frase que conecta un tema ya visto con un ángulo nuevo (dos temas a la vez) no debe marcarse,
// porque no es subconjunto de ningún texto anterior individual.
{
  const fortaleza = 'Muestra facilidad para entablar diálogos y relacionarse con otros en el equipo.'
  const resumen = 'Su facilidad para relacionarse se combina con una notable capacidad de organizar el trabajo y cumplir con los compromisos adquiridos.'
  const redundantes = detectarFrasesTematicamenteRedundantes(resumen, [fortaleza])
  assert.equal(redundantes.length, 0, `una frase que conecta un tema previo con uno nuevo no debe marcarse como puramente redundante (encontró: ${JSON.stringify(redundantes)})`)
}

// Sin textos anteriores con temas detectables, no debe marcar nada (no inventa redundancia).
{
  const redundantes = detectarFrasesTematicamenteRedundantes('El perfil muestra facilidad para entablar diálogos.', [])
  assert.equal(redundantes.length, 0)
}

console.log('✅ informeConsistencia: similitud textual detecta parafraseo, detectarRedundanciaNarrativa encuentra pares repetidos sin falsos positivos, detectarInconsistenciasNumericas alerta solo ante divergencia real, y detectarFrasesTematicamenteRedundantes detecta el mismo tema parafraseado sin marcar frases que conectan algo nuevo')
