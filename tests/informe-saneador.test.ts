import assert from 'node:assert/strict'

const { sanearFraseAlineamiento, sanearProfundo } = await import('../lib/informeSaneador.ts')

// Casos reales observados en informes generados (Guzman Segredo, Magaly Larrosa) tras agregar
// la prohibicion explicita en los 3 prompts -- la frecuencia bajo pero no llego a cero, de ahi
// este resguardo determinístico.
{
  const casos: [string, string][] = [
    ['Tiende a tener claridad sobre las alineamiento de expectativas, lo que facilita su desempeño.', 'Tiende a tener claridad sobre las expectativas, lo que facilita su desempeño.'],
    ['no satisfacen las alineamiento de expectativas urgentes del cliente.', 'no satisfacen las expectativas urgentes del cliente.'],
    ['incluso cuando las alineamiento de expectativas son elevadas o hay frustración.', 'incluso cuando las expectativas son elevadas o hay frustración.'],
    ['al gestionar objeciones o alineamiento de expectativas complejas del cliente.', 'al gestionar objeciones o las expectativas complejas del cliente.'],
    ['podrá cumplir satisfactoriamente con las alineamiento de expectativas del puesto.', 'podrá cumplir satisfactoriamente con las expectativas del puesto.'],
    ['Se alinea directamente con las alineamiento de expectativas del rol.', 'Se alinea directamente con las expectativas del rol.'],
  ]
  for (const [antes, despues] of casos) {
    assert.equal(sanearFraseAlineamiento(antes), despues, `caso: "${antes}"`)
  }
}

// Texto sin el problema no debe alterarse.
{
  const limpio = 'Este texto no tiene el problema y no debería cambiar en nada.'
  assert.equal(sanearFraseAlineamiento(limpio), limpio)
}

// Insensible a mayusculas/minusculas y respeta mayuscula inicial de oracion.
{
  assert.equal(sanearFraseAlineamiento('ALINEAMIENTO DE EXPECTATIVAS del cliente.'), 'Las expectativas del cliente.')
  assert.equal(sanearFraseAlineamiento('Alineamiento de expectativas complejas.'), 'Las expectativas complejas.')
}

// sanearProfundo: recorre objetos/arrays anidados (la forma real del resultado del informe) sin
// romper valores no-string (numeros, null, booleans) ni la estructura.
{
  const informe = {
    ajusteCargo: { score: 91, analisis: 'Se alinea con las alineamiento de expectativas del rol.' },
    fortalezas: [
      { tendencia: 'Calma bajo presión', mecanismo: 'Sin problema aca.', impacto_organizacional: null },
    ],
    oportunidadesMejora: [
      { tendencia: 'Flexibilidad', mecanismo: 'cuando las alineamiento de expectativas son altas', impacto_organizacional: 'Texto normal' },
    ],
    interpretacionPorFactor: { errores_texto: 'Sin problema.', claridad_rol: 'las alineamiento de expectativas' },
    scoreFinal: 91,
    activo: true,
    videos: null,
  }
  const limpio = sanearProfundo(informe)
  assert.equal(limpio.ajusteCargo.analisis, 'Se alinea con las expectativas del rol.')
  assert.equal(limpio.oportunidadesMejora[0].mecanismo, 'cuando las expectativas son altas')
  assert.equal(limpio.interpretacionPorFactor.claridad_rol, 'las expectativas')
  assert.equal(limpio.fortalezas[0].tendencia, 'Calma bajo presión', 'texto sin el problema no cambia')
  assert.equal(limpio.fortalezas[0].impacto_organizacional, null, 'null se preserva')
  assert.equal(limpio.scoreFinal, 91, 'numeros se preservan')
  assert.equal(limpio.activo, true, 'booleans se preservan')
  assert.equal(limpio.videos, null, 'null en la raiz se preserva')
}

console.log('✅ sanearFraseAlineamiento: corrige "alineamiento de expectativas" en sus variantes reales, no toca texto sin el problema, y sanearProfundo recorre objetos/arrays anidados sin alterar valores no-string')
