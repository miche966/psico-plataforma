import assert from 'node:assert/strict'

const { nombreDeProcesoLegible: legible } = await import('../lib/nombreProceso.ts')

// El caso real: nombre cargado en mayusculas
assert.equal(legible('Pasantías "YO ESTUDIO Y TRABAJO 2026" PARA ESTUDIANTES UNIVERSITARIOS Y TERCIARIOS'), 'Pasantías "Yo estudio y trabajo 2026" para estudiantes universitarios y terciarios')
assert.equal(legible('ATENCIÓN AL CLIENTE'), 'Atención al cliente')
assert.equal(legible('ANALISTA DE COBRANZAS - SUCURSAL CENTRO'), 'Analista de cobranzas - Sucursal centro')
assert.equal(legible('PASANTÍAS «YO ESTUDIO Y TRABAJO»'), 'Pasantías «Yo estudio y trabajo»')

// Texto mixto: solo el tramo en mayusculas (el caso que se ve en el panel)
assert.equal(legible('Pasantías "YO ESTUDIO Y TRABAJO 2026" para estudiantes universitarios y terciarios'), 'Pasantías "Yo estudio y trabajo 2026" para estudiantes universitarios y terciarios')
assert.equal(legible('Pasantías «YO ESTUDIO Y TRABAJO» 2026'), 'Pasantías «Yo estudio y trabajo» 2026')
assert.equal(legible('Analista de cobranzas - SUCURSAL CENTRO'), 'Analista de cobranzas - sucursal centro', 'un tramo en mayusculas va en minuscula si no abre el texto ni una comilla')
assert.equal(legible('Analista IT semi senior'), 'Analista IT semi senior', 'una sigla suelta no es un tramo')
assert.equal(legible('Evaluación SJT ICAR'), 'Evaluación SJT ICAR', 'dos siglas seguidas se conservan')

// Siglas y nombres propios
assert.equal(legible('ANALISTA IT SEMI SENIOR'), 'Analista IT semi senior')
assert.equal(legible('GERENTE DE RRHH'), 'Gerente de RRHH')
assert.equal(legible('EJECUTIVO COMERCIAL REPÚBLICA MICROFINANZAS'), 'Ejecutivo comercial República Microfinanzas')

// Lo que ya esta bien escrito no se toca
for (const bien of ['Analista de cobranzas', 'Pasantías «Yo estudio y trabajo 2026»', 'Evaluación de prueba - Michel Ochoa', 'Atención al Cliente (Montevideo)', 'Operador/a telefónico']) assert.equal(legible(bien), bien, bien)

// Idempotente
for (const n of ['ATENCIÓN AL CLIENTE', 'ANALISTA IT SEMI SENIOR', 'Pasantías "YO ESTUDIO Y TRABAJO 2026" PARA ESTUDIANTES']) assert.equal(legible(legible(n)), legible(n), 'idempotente: ' + n)

// Bordes
assert.equal(legible(''), ''); assert.equal(legible(null), ''); assert.equal(legible(undefined), '')
assert.equal(legible('IT'), 'IT', 'una sigla sola no cambia')
assert.equal(legible('2026'), '2026', 'sin letras no cambia')
assert.equal(legible('ABC'), 'ABC', 'demasiado corto para decidir: queda igual')
assert.equal(legible('  PASANTÍAS 2026  ').trim(), 'Pasantías 2026')

console.log('✅ nombre-proceso: los nombres en mayúsculas se muestran en oración, con siglas y nombres propios, y lo que ya estaba bien escrito no cambia')
