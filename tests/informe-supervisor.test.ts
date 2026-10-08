import assert from 'node:assert/strict'

const {
  informeVacio, normalizarInformeSupervisor, seccionesFaltantes, revisarTerminos, entradaParaIa, hayMaterial, construirPrompt, extraerJson,
  LARGO_MAXIMO_SECCION, SECCIONES_SUPERVISOR,
} = await import('../lib/informeSupervisor.ts')
const { leerInformeSupervisor, guardarBorrador, publicarBorrador, despublicar } = await import('../lib/server/informeSupervisorDb.ts')

const CAND = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const PROC = '740a08d1-a5f9-45e2-9887-a7b2ece99796'

const limpio = {
  comoTrabaja: 'Trabaja de forma ordenada y prefiere tener claras las tareas antes de empezar.',
  queAporta: 'Aporta constancia y buen trato con el equipo, y cuida los detalles.',
  comoAcompanarlo: 'Conviene acordar metas semanales y darle devoluciones frecuentes en los primeros meses.',
  aTenerEnCuenta: 'Puede tardar en pedir ayuda; ayuda que se le invite a consultar sin esperar.',
  entrevista: 'En la entrevista habló con claridad de su experiencia en atención al público.',
}

// ---- Normalizar: solo las cinco secciones, solo texto, recortado ----
assert.deepEqual(informeVacio(), { version: 1, comoTrabaja: '', queAporta: '', comoAcompanarlo: '', aTenerEnCuenta: '', entrevista: null })
for (const raro of [null, undefined, 'texto', 7, [], true]) assert.deepEqual(normalizarInformeSupervisor(raro), informeVacio(), String(raro))
assert.deepEqual(normalizarInformeSupervisor({ ...limpio, version: 99, recomendacion: 'recomendado', puntaje: 80, extra: { a: 1 } }), { version: 1, ...limpio })
const n = normalizarInformeSupervisor({ comoTrabaja: '  hola  ', queAporta: 5, comoAcompanarlo: { x: 1 }, aTenerEnCuenta: null, entrevista: '   ' })
assert.deepEqual(n, { version: 1, comoTrabaja: 'hola', queAporta: '', comoAcompanarlo: '', aTenerEnCuenta: '', entrevista: null })
assert.equal(normalizarInformeSupervisor({ comoTrabaja: 'x'.repeat(LARGO_MAXIMO_SECCION + 500) }).comoTrabaja.length, LARGO_MAXIMO_SECCION)
assert.equal(normalizarInformeSupervisor({ comoTrabaja: 'a\r\nb' }).comoTrabaja, 'a\nb')

// ---- Para publicar hacen falta las cuatro secciones obligatorias (la entrevista es opcional) ----
assert.deepEqual(seccionesFaltantes(normalizarInformeSupervisor(limpio)), [])
assert.deepEqual(seccionesFaltantes(normalizarInformeSupervisor({ ...limpio, entrevista: '' })), [])
assert.deepEqual(seccionesFaltantes(normalizarInformeSupervisor({ ...limpio, queAporta: '' })), ['Qué puede aportar al equipo'])
assert.equal(seccionesFaltantes(informeVacio()).length, 4)
assert.equal(SECCIONES_SUPERVISOR.filter(s => s.obligatoria).length, 4)

// ---- Revision de terminos: un informe limpio pasa sin bloqueantes ----
const rLimpio = revisarTerminos(normalizarInformeSupervisor(limpio))
assert.deepEqual(rLimpio.bloqueantes, [])
// "Se recomienda..." y palabras parecidas NO bloquean (solo el dictamen)
for (const ok of ['Se recomienda acompañarlo de cerca.', 'Su adaptabilidad es buena y es capaz de aprender rápido.', 'Tiene aptitud para el trato con clientes.', 'Valora la contratación de personas con iniciativa.', 'Cumple sus metas.', 'Mide 50 metros de ventaja']) {
  assert.deepEqual(revisarTerminos(normalizarInformeSupervisor({ comoTrabaja: ok })).bloqueantes, [], ok)
}
// Cada tipo de termino prohibido bloquea
const prohibidos: Array<[string, string]> = [
  ['Es una persona recomendada para el puesto', 'el dictamen'],
  ['Resultado: no recomendado', 'el dictamen'],
  ['Es recomendado con reservas', 'el dictamen'],
  ['El dictamen final es favorable', 'el dictamen'],
  ['Es apto para el cargo', 'el dictamen'],
  ['Resulta no apta para el puesto', 'el dictamen'],
  ['Sugiero contratarla cuanto antes', 'una recomendación de contratar o descartar'],
  ['Habría que descartarlo', 'una recomendación de contratar o descartar'],
  ['Muestra signos de depresión', 'datos de salud'],
  ['Tiene ansiedad ante la presión', 'datos de salud'],
  ['Puntúa alto en el DASS-21', 'datos de salud'],
  ['Hay riesgo de burnout', 'datos de salud'],
  ['Cuida su salud mental', 'datos de salud'],
  ['No hay un diagnóstico', 'datos de salud'],
  ['Su estrés laboral es bajo', 'datos de salud'],
  ['Obtuvo un 84% en la prueba', 'un porcentaje'],
  ['Está en el percentil 80', 'un percentil'],
  ['Su puntaje fue alto', 'un puntaje'],
  ['Alcanzó 84/100', 'un puntaje'],
  ['Según el Big Five es muy responsable', 'el nombre de una prueba'],
  ['El MBTI indica un perfil ENFJ', 'el nombre de una prueba'],
  ['Hizo bien el test de razonamiento', 'la palabra «test» (usá «prueba» o «evaluación»)'],
  ['Tiene bajo neuroticismo', 'un término técnico'],
  ['Hubo una alerta durante la prueba', 'alertas de irregularidad'],
  ['Cambió de pestaña varias veces', 'alertas de irregularidad'],
]
for (const [frase, motivo] of prohibidos) {
  const r = revisarTerminos(normalizarInformeSupervisor({ comoTrabaja: frase }))
  assert.ok(r.bloqueantes.some(b => b.motivo === motivo), `"${frase}" debia bloquear por ${motivo}: ${JSON.stringify(r.bloqueantes)}`)
  assert.equal(r.bloqueantes[0].seccion, 'Cómo trabaja')
}
// Se revisan todas las secciones, incluida la entrevista
assert.equal(revisarTerminos(normalizarInformeSupervisor({ ...limpio, entrevista: 'Tuvo un 90% de aciertos' })).bloqueantes[0].seccion, 'Lo que surgió en la entrevista')
// Advertencias: no bloquean
const adv = revisarTerminos(normalizarInformeSupervisor({ comoTrabaja: 'Tiene buenas competencias y maneja bien el estrés.' }))
assert.deepEqual(adv.bloqueantes, [])
assert.ok(adv.advertencias.length >= 2)

// ---- Entrada de la IA: solo los campos permitidos ----
const tecnico = {
  recomendacion: 'recomendado', confianza: 93, alertasTab: 4, alertasCopia: 2, tiempoPromedio: 31, mbtiType: 'ENFJ', nombreEvaluador: 'Ana',
  liderazgo: 71, resiliencia: 66, interpretacionPorFactor: { burnout: 'Texto del factor de bienestar', ansiedad: 'otro' },
  resumenEjecutivo: 'Persona ordenada y colaboradora.',
  fortalezas: [{ tendencia: 'Orden', mecanismo: 'Planifica sus tareas', impacto_organizacional: 'Previsibilidad' }, 'Buen trato'],
  oportunidadesMejora: [{ tendencia: 'Pedir ayuda', mecanismo: 'Espera a que le pregunten', impacto_organizacional: 'Demoras' }],
  ajusteCargo: { score: 77, analisis: 'Encaja bien con el puesto.' },
  analisisEntrevista: { trayectoriaMotivacion: 'Motivada', estiloTrabajoAutoridad: '', gestionConflictos: 'Dialoga', resilienciaFrustracion: '', autoconceptoMetas: 'Quiere crecer' },
}
const entrada = entradaParaIa(tecnico)
assert.deepEqual(entrada, {
  resumen: 'Persona ordenada y colaboradora.',
  fortalezas: ['Orden. Planifica sus tareas. Previsibilidad', 'Buen trato'],
  areasDeDesarrollo: ['Pedir ayuda. Espera a que le pregunten. Demoras'],
  entrevista: 'Motivada\nDialoga\nQuiere crecer',
  ajusteAlPuesto: 'Encaja bien con el puesto.',
})
const prompt = construirPrompt(entrada, 'Operador de Cobranzas')
// El material no contiene nada de lo que no debe llegar a la IA (las reglas del prompt si nombran lo prohibido, para prohibirlo)
const materialJson = JSON.stringify(entrada)
for (const prohibido of ['recomendado', '93', 'ENFJ', 'burnout', 'ansiedad', 'Texto del factor', 'alertas']) assert.ok(!materialJson.includes(prohibido), `la entrada contiene "${prohibido}"`)
const materialDelPrompt = prompt.slice(prompt.indexOf('Material de partida'))
for (const prohibido of ['ENFJ', 'burnout', 'ansiedad', 'Texto del factor', '93']) assert.ok(!materialDelPrompt.includes(prohibido), `el material del prompt contiene "${prohibido}"`)
assert.ok(prompt.includes('Operador de Cobranzas'))
assert.ok(prompt.includes('NO emitas ninguna recomendación sobre contratar o descartar'))
assert.ok(prompt.includes('Devolvé ÚNICAMENTE un JSON'))
assert.ok(construirPrompt({ ...entrada, entrevista: '' }, '').includes('dejalo como cadena vacía'))
// Sin material no hay de donde partir
assert.equal(hayMaterial(entrada), true)
assert.equal(hayMaterial(entradaParaIa({})), false)
assert.equal(hayMaterial(entradaParaIa(null)), false)
assert.equal(hayMaterial(entradaParaIa({ recomendacion: 'recomendado', confianza: 90 })), false, 'solo dictamen y numeros: no hay material')
assert.deepEqual(entradaParaIa('raro'), entradaParaIa({}))

// ---- Respuesta de la IA: JSON con o sin cercas ----
assert.deepEqual(extraerJson('{"comoTrabaja":"a"}'), { comoTrabaja: 'a' })
assert.deepEqual(extraerJson('```json\n{"comoTrabaja":"a"}\n```'), { comoTrabaja: 'a' })
assert.deepEqual(extraerJson('Acá va el informe:\n```\n{"queAporta":"b"}\n```\nListo.'), { queAporta: 'b' })
for (const mal of ['', 'sin json', '{roto', '[1,2]', '{', null, undefined, 5, {}]) assert.equal(extraerJson(mal as any), null, String(mal))

// ---- Base: borrador y publicado son independientes ----
function dbFalsa(inicial: any[] = [], opciones: { falla?: 'select' | 'update' | 'insert' } = {}) {
  const filas: any[] = inicial.map(f => ({ ...f }))
  const log: string[] = []
  return {
    filas, log,
    from: (_: string) => {
      const filtros: Array<[string, unknown]> = []
      let modo: 'select' | 'update' | 'insert' = 'select'
      let cambios: any = null
      let devolver = false
      const coincide = () => filas.filter(f => filtros.every(([c, v]) => f[c] === v))
      const resultado = (): any => {
        if (opciones.falla === modo) return { data: null, error: { message: 'caida' } }
        if (modo === 'update') { const hit = coincide(); hit.forEach(f => Object.assign(f, cambios)); log.push('update'); return { data: devolver ? hit.map(f => ({ candidato_id: f.candidato_id })) : null, error: null } }
        if (modo === 'insert') { filas.push({ ...cambios }); log.push('insert'); return { data: null, error: null } }
        return { data: coincide()[0] ?? null, error: null }
      }
      const q: any = {
        select: () => { devolver = true; return q },
        update: (c: any) => { modo = 'update'; cambios = c; return q },
        insert: (c: any) => { modo = 'insert'; cambios = c; return q },
        eq: (c: string, v: unknown) => { filtros.push([c, v]); return q },
        maybeSingle: async () => resultado(),
        then: (res: any, rej: any) => Promise.resolve(resultado()).then(res, rej),
      }
      return q
    },
  }
}

// Sin fila: el estado esta vacio
{
  const e = await leerInformeSupervisor(dbFalsa(), CAND, PROC)
  assert.deepEqual(e, { borrador: null, publicado: null, actualizado_en: null, publicado_en: null, publicado_por: null, conCambiosSinPublicar: false })
}
// Guardar el borrador la primera vez inserta; la segunda actualiza, y nunca toca lo publicado
{
  const db = dbFalsa()
  const b1 = await guardarBorrador(db, CAND, PROC, { ...limpio, puntaje: 90 })
  assert.deepEqual(b1, { version: 1, ...limpio })
  assert.deepEqual(db.log, ['update', 'insert'], 'primero intenta actualizar y, sin fila, inserta')
  assert.equal(db.filas.length, 1)
  assert.equal(db.filas[0].publicado, undefined)
  await guardarBorrador(db, CAND, PROC, { ...limpio, queAporta: 'Otra cosa' })
  assert.equal(db.filas.length, 1, 'no duplica la fila')
  assert.equal(db.filas[0].borrador.queAporta, 'Otra cosa')
  let e = await leerInformeSupervisor(db, CAND, PROC)
  assert.equal(e.conCambiosSinPublicar, true, 'borrador sin publicar')
  // Publicar copia el borrador y registra quien y cuando
  const pub = await publicarBorrador(db, CAND, PROC, 'admin@empresa.com')
  assert.equal(pub?.queAporta, 'Otra cosa')
  e = await leerInformeSupervisor(db, CAND, PROC)
  assert.equal(e.publicado?.queAporta, 'Otra cosa')
  assert.equal(e.publicado_por, 'admin@empresa.com')
  assert.ok(e.publicado_en)
  assert.equal(e.conCambiosSinPublicar, false)
  // Editar el borrador despues de publicar NO cambia lo publicado
  await guardarBorrador(db, CAND, PROC, { ...limpio, queAporta: 'Texto nuevo sin publicar' })
  e = await leerInformeSupervisor(db, CAND, PROC)
  assert.equal(e.publicado?.queAporta, 'Otra cosa')
  assert.equal(e.borrador?.queAporta, 'Texto nuevo sin publicar')
  assert.equal(e.conCambiosSinPublicar, true)
  // Despublicar retira lo publicado y conserva el borrador
  await despublicar(db, CAND, PROC)
  e = await leerInformeSupervisor(db, CAND, PROC)
  assert.equal(e.publicado, null)
  assert.equal(e.publicado_en, null)
  assert.equal(e.borrador?.queAporta, 'Texto nuevo sin publicar')
}
// Publicar sin borrador no hace nada
assert.equal(await publicarBorrador(dbFalsa(), CAND, PROC, 'a@b.com'), null)
// Otro proceso u otra persona no se mezclan
{
  const db = dbFalsa([{ candidato_id: CAND, proceso_id: PROC, borrador: { ...limpio }, publicado: null }])
  assert.equal((await leerInformeSupervisor(db, CAND, '11111111-2222-4333-8444-555555555555')).borrador, null)
  assert.equal((await leerInformeSupervisor(db, '99999999-2222-4333-8444-555555555555', PROC)).borrador, null)
}
// Un fallo de la base se propaga (nunca se lee como "sin informe")
await assert.rejects(() => leerInformeSupervisor(dbFalsa([], { falla: 'select' }), CAND, PROC))
await assert.rejects(() => guardarBorrador(dbFalsa([], { falla: 'update' }), CAND, PROC, limpio))
await assert.rejects(() => guardarBorrador(dbFalsa([], { falla: 'insert' }), CAND, PROC, limpio))

console.log('✅ informe-supervisor: solo las cinco secciones y solo texto, no se publica con el dictamen, datos de salud, numeros ni nombres de pruebas (y "se recomienda" no bloquea), la IA recibe solo resumen, fortalezas, areas, entrevista y ajuste, y editar el borrador nunca cambia lo publicado')
