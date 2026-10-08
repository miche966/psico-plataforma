import assert from 'node:assert/strict'

const { listaEvaluados, detalleEvaluado, videosDelEvaluado, hayInformePublicado } = await import('../lib/server/supervisorPanel.ts')

const EMAIL = 'jefa@empresa.com'
const OTRO = 'otro@empresa.com'
const C1 = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const C2 = '22222222-2222-4333-8444-555555555555'
const C3 = '33333333-2222-4333-8444-555555555555'
const P1 = '740a08d1-a5f9-45e2-9887-a7b2ece99796'
const P2 = '11111111-2222-4333-8444-555555555555'
const E1 = 'aaaaaaaa-1111-4222-8333-444444444444' // entrevista del proceso P1
const E2 = 'bbbbbbbb-1111-4222-8333-444444444444' // entrevista de otro proceso
const Q1 = 'c0000001-1111-4222-8333-444444444444'
const Q2 = 'c0000002-1111-4222-8333-444444444444'
const Q3 = 'c0000003-1111-4222-8333-444444444444'

const informePublicado = { version: 1, comoTrabaja: 'Trabaja ordenado', queAporta: 'Aporta constancia', comoAcompanarlo: 'Acordar metas', aTenerEnCuenta: 'Pedir ayuda', entrevista: null }
const informeBorrador = { ...informePublicado, comoTrabaja: 'BORRADOR sin publicar' }

function datos() {
  return {
    supervisor_evaluados: [
      { supervisor_email: EMAIL, candidato_id: C1, proceso_id: P1, habilitado_en: '2026-10-02T10:00:00Z' },
      { supervisor_email: EMAIL, candidato_id: C2, proceso_id: P1, habilitado_en: '2026-10-03T10:00:00Z' },
      { supervisor_email: EMAIL, candidato_id: C3, proceso_id: P1, habilitado_en: '2026-10-04T10:00:00Z' }, // candidato borrado
      { supervisor_email: OTRO, candidato_id: C1, proceso_id: P2, habilitado_en: '2026-10-05T10:00:00Z' },
    ],
    candidatos: [
      { id: C1, nombre: 'Ana', apellido: 'Pérez', email: 'ana@x.com', documento: '1.234.567-8', telefono: '099' },
      { id: C2, nombre: 'Beto', apellido: 'Gómez', email: 'beto@x.com', documento: '7.654.321-0', telefono: '098' },
    ],
    procesos: [
      { id: P1, nombre: 'Pasantías 2026', cargo: 'Operador de Cobranzas', bateria_tests: ['big_five', `entrevista:${E1}`] },
      { id: P2, nombre: 'Otro proceso', cargo: 'Otro cargo', bateria_tests: [`entrevista:${E2}`] },
    ],
    informes_supervisor: [
      { candidato_id: C1, proceso_id: P1, borrador: informeBorrador, publicado: informePublicado, publicado_en: '2026-10-06T10:00:00Z', publicado_por: 'admin@x.com' },
      { candidato_id: C2, proceso_id: P1, borrador: informeBorrador, publicado: null, publicado_en: null, publicado_por: null }, // solo borrador
    ],
    respuestas_video: [
      { id: 'v1', candidato_id: C1, entrevista_id: E1, pregunta_id: Q2, estado: 'completado', url_video: 'u-q2-vieja', grabada_en: '2026-10-01T10:00:00Z', analisis_ia: { puntaje: 9 }, transcripcion: 'texto secreto' },
      { id: 'v2', candidato_id: C1, entrevista_id: E1, pregunta_id: Q2, estado: 'completado', url_video: 'u-q2-nueva', grabada_en: '2026-10-01T11:00:00Z', analisis_ia: { puntaje: 9 }, transcripcion: 'texto secreto' },
      { id: 'v3', candidato_id: C1, entrevista_id: E1, pregunta_id: Q1, estado: 'completado', url_video: 'u-q1', grabada_en: '2026-10-01T12:00:00Z', analisis_ia: { puntaje: 3 }, transcripcion: 'otro texto' },
      { id: 'v4', candidato_id: C1, entrevista_id: E2, pregunta_id: Q3, estado: 'completado', url_video: 'u-q3-ajeno', grabada_en: '2026-10-01T13:00:00Z' }, // entrevista de otro proceso
      { id: 'v5', candidato_id: C1, entrevista_id: E1, pregunta_id: Q1, estado: 'pendiente', url_video: 'u-pend', grabada_en: '2026-10-01T14:00:00Z' }, // no completado
      { id: 'v6', candidato_id: C2, entrevista_id: E1, pregunta_id: Q1, estado: 'completado', url_video: 'u-c2', grabada_en: '2026-10-01T15:00:00Z' },
    ],
    preguntas_video: [
      { id: Q1, pregunta: 'Contanos de tu experiencia', orden: 2 },
      { id: Q2, pregunta: 'Qué te motiva', orden: 1 },
      { id: Q3, pregunta: 'Pregunta ajena', orden: 1 },
    ],
  } as Record<string, any[]>
}

// Base en memoria con la parte de la API de Supabase que usa el modulo; anota que tablas se consultaron
function baseFalsa(tablas: Record<string, any[]>, opciones: { falla?: string } = {}) {
  const consultadas: string[] = []
  return {
    consultadas,
    from: (tabla: string) => {
      consultadas.push(tabla)
      const filtros: Array<(f: any) => boolean> = []
      const filas = () => (tablas[tabla] || []).filter(f => filtros.every(fn => fn(f)))
      const resultado = (): any => (opciones.falla === tabla ? { data: null, error: { message: 'caida' } } : { data: filas(), error: null })
      const q: any = {
        select: () => q,
        eq: (c: string, v: unknown) => { filtros.push(f => f[c] === v); return q },
        in: (c: string, vs: unknown[]) => { filtros.push(f => vs.includes(f[c])); return q },
        order: () => q,
        maybeSingle: async () => { const r = resultado(); return r.error ? r : { data: r.data[0] ?? null, error: null } },
        then: (res: any, rej: any) => Promise.resolve(resultado()).then(res, rej),
      }
      return q
    },
  }
}
const firmarFalso = async (filas: Array<{ url_video: string | null }>) => filas.map(f => ({ url_video: f.url_video ? `firmada:${f.url_video}` : null }))

// ---- Lista: solo sus habilitaciones, con lo minimo ----
{
  const lista = await listaEvaluados(baseFalsa(datos()), EMAIL)
  assert.deepEqual(lista.map(e => e.candidato_id), [C1, C2], 'solo sus habilitaciones, y se omite a quien ya no existe')
  assert.deepEqual(Object.keys(lista[0]).sort(), ['apellido', 'candidato_id', 'cargo', 'habilitado_en', 'informe_disponible', 'nombre', 'proceso_id', 'proceso_nombre', 'videos'])
  assert.equal(lista[0].informe_disponible, true)
  assert.equal(lista[1].informe_disponible, false, 'un borrador sin publicar no cuenta como disponible')
  assert.equal(lista[0].videos, 2, 'dos preguntas distintas: el reintento no cuenta doble, ni el video de otra entrevista, ni el no completado')
  assert.equal(lista[1].videos, 1)
  assert.deepEqual(lista.map(e => e.nombre), ['Ana', 'Beto'])
  const texto = JSON.stringify(lista)
  for (const secreto of ['ana@x.com', '1.234.567-8', '099', 'BORRADOR', 'texto secreto', 'big_five']) assert.ok(!texto.includes(secreto), `la lista contiene "${secreto}"`)
}
assert.deepEqual(await listaEvaluados(baseFalsa(datos()), 'nadie@empresa.com'), [])
// El otro supervisor solo ve lo suyo
assert.deepEqual((await listaEvaluados(baseFalsa(datos()), OTRO)).map(e => e.proceso_id), [P2])
await assert.rejects(() => listaEvaluados(baseFalsa(datos(), { falla: 'candidatos' }), EMAIL), 'un fallo de la base no se lee como lista vacia')
await assert.rejects(() => listaEvaluados(baseFalsa(datos(), { falla: 'supervisor_evaluados' }), EMAIL))

// ---- Detalle: solo si esta habilitado, y solo lo publicado ----
{
  const d = await detalleEvaluado(baseFalsa(datos()), EMAIL, C1, P1)
  assert.ok(d)
  assert.deepEqual(Object.keys(d!).sort(), ['apellido', 'candidato_id', 'cargo', 'informe', 'nombre', 'proceso_id', 'proceso_nombre', 'publicado_en'])
  assert.equal(d!.informe?.comoTrabaja, 'Trabaja ordenado', 'lo publicado, no el borrador')
  assert.equal(d!.publicado_en, '2026-10-06T10:00:00Z')
  const texto = JSON.stringify(d)
  for (const secreto of ['ana@x.com', '1.234.567-8', 'BORRADOR', 'admin@x.com']) assert.ok(!texto.includes(secreto), `el detalle contiene "${secreto}"`)
  // Sin informe publicado: informe null
  const sinPublicar = await detalleEvaluado(baseFalsa(datos()), EMAIL, C2, P1)
  assert.equal(sinPublicar?.informe, null)
  assert.equal(sinPublicar?.publicado_en, null)
}
for (const [email, cand, proc, motivo] of [
  [EMAIL, C1, P2, 'otro proceso de la misma persona'],
  [OTRO, C1, P1, 'habilitacion de otro supervisor'],
  [EMAIL, C3, P1, 'persona borrada'],
  ['nadie@empresa.com', C1, P1, 'cuenta sin habilitaciones'],
  [EMAIL, 'no-es-uuid', P1, 'id invalido'],
  [EMAIL, C1, "x'; drop table--", 'id invalido (proceso)'],
  [EMAIL, null, null, 'sin ids'],
] as Array<[string, any, any, string]>) {
  assert.equal(await detalleEvaluado(baseFalsa(datos()), email, cand, proc), null, motivo)
}
// Si no esta habilitado no se toca ninguna otra tabla (no se filtra informacion ni siquiera por tiempos)
{
  const db = baseFalsa(datos())
  await detalleEvaluado(db, EMAIL, C1, P2)
  await videosDelEvaluado(db, EMAIL, C1, P2, firmarFalso)
  assert.deepEqual(Array.from(new Set(db.consultadas)), ['supervisor_evaluados'])
}
assert.equal(await hayInformePublicado(baseFalsa(datos()), EMAIL, C1, P1), true)
assert.equal(await hayInformePublicado(baseFalsa(datos()), EMAIL, C2, P1), false, 'solo borrador')
assert.equal(await hayInformePublicado(baseFalsa(datos()), OTRO, C1, P1), false, 'no habilitado')

// ---- Videos: solo las entrevistas del proceso, una por pregunta, en orden, sin analisis ----
{
  const v = await videosDelEvaluado(baseFalsa(datos()), EMAIL, C1, P1, firmarFalso)
  assert.deepEqual(v, [
    { id: 'v2', pregunta: 'Qué te motiva', url: 'firmada:u-q2-nueva' },
    { id: 'v3', pregunta: 'Contanos de tu experiencia', url: 'firmada:u-q1' },
  ])
  const texto = JSON.stringify(v)
  for (const secreto of ['texto secreto', 'puntaje', 'u-q3-ajeno', 'u-pend', 'u-q2-vieja', 'Pregunta ajena']) assert.ok(!texto.includes(secreto), `los videos contienen "${secreto}"`)
  for (const f of v!) assert.deepEqual(Object.keys(f).sort(), ['id', 'pregunta', 'url'])
}
assert.equal(await videosDelEvaluado(baseFalsa(datos()), EMAIL, C1, P2, firmarFalso), null, 'no habilitado')
assert.equal(await videosDelEvaluado(baseFalsa(datos()), OTRO, C1, P1, firmarFalso), null, 'habilitacion de otro')
// Un proceso sin entrevistas, o una persona sin videos, da lista vacia
{
  const d = datos()
  d.procesos[0].bateria_tests = ['big_five']
  assert.deepEqual(await videosDelEvaluado(baseFalsa(d), EMAIL, C1, P1, firmarFalso), [])
  const d2 = datos()
  d2.respuestas_video = []
  assert.deepEqual(await videosDelEvaluado(baseFalsa(d2), EMAIL, C1, P1, firmarFalso), [])
}
// Si no se puede firmar un video, la URL queda en null (la pantalla dice "no disponible") y no se entrega la cruda
{
  const v = await videosDelEvaluado(baseFalsa(datos()), EMAIL, C1, P1, async filas => filas.map(() => ({ url_video: null })))
  assert.deepEqual(v!.map(x => x.url), [null, null])
}
// Sin orden de pregunta, se ordena por fecha de grabacion
{
  const d = datos()
  d.preguntas_video.forEach(p => { delete p.orden })
  assert.deepEqual((await videosDelEvaluado(baseFalsa(d), EMAIL, C1, P1, firmarFalso))!.map(x => x.id), ['v2', 'v3'])
}
await assert.rejects(() => videosDelEvaluado(baseFalsa(datos(), { falla: 'respuestas_video' }), EMAIL, C1, P1, firmarFalso))

console.log('✅ supervisor-panel: cada supervisor ve solo sus habilitaciones exactas (persona + proceso), solo datos basicos, el informe PUBLICADO (nunca el borrador) y las videoentrevistas de las entrevistas del proceso sin analisis ni transcripcion; sin habilitacion no se consulta nada mas, y un fallo de la base nunca se lee como "sin acceso" ni como lista vacia')
