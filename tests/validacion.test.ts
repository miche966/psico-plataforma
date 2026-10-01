import assert from 'node:assert/strict'

const { z, lenient, textoLeniente, numeroLeniente, rutaVideoSchema } = await import('../lib/server/esquemas.ts')

// Regresion real: en zod 4 z.unknown().transform() rechaza las claves AUSENTES. El cliente de video
// manda el caso de exito sin logs ni extraData, asi que un campo "lenient" que rechace claves
// ausentes hace perder en silencio la respuesta de cada candidato.
const guardar = z.object({
  logs: textoLeniente(5),
  duracion: numeroLeniente(0, 100),
  exito: lenient(Boolean),
})

const sinClaves = guardar.safeParse({})
assert.equal(sinClaves.success, true, 'campos lenient deben aceptar claves ausentes')
assert.equal(sinClaves.data.logs, '')
assert.equal(sinClaves.data.exito, false)
assert.equal(sinClaves.data.duracion, undefined, 'sin duracion queda sin definir (la BD usa su valor por defecto)')

assert.deepEqual(guardar.parse({ logs: 'abcdefghij', duracion: 60, exito: 1 }), { logs: 'abcde', duracion: 60, exito: true }, 'recorta texto y deja pasar lo valido')
assert.deepEqual(guardar.parse({ logs: null, duracion: null }), { logs: '', duracion: null, exito: false }, 'null no rompe')
assert.equal(guardar.parse({ duracion: 'mucho' }).duracion, undefined, 'numero basura se descarta sin rechazar')
assert.equal(guardar.parse({ duracion: 99999 }).duracion, undefined, 'numero fuera de rango se descarta sin rechazar')

// Forma exacta de la clave que arma app/entrevista-video/responder/page.tsx
const entrevista = '0a9591f0-bdd0-4b51-98c2-095f3e83d870'
const candidato = 'fc4fd900-2198-4300-a37f-6cd1e6a439b2'
const pregunta = 'dd44a862-7a04-417b-9def-d3c54ca14c10'
assert.equal(rutaVideoSchema.safeParse(`${entrevista}/${candidato}/${pregunta}_1790872597410.webm`).success, true, 'la clave real del cliente debe pasar')
for (const mala of [`${entrevista}/${candidato}/x.html`, `${entrevista}/${candidato}/a/b.webm`, `${entrevista}/${candidato}/../../x.webm`, `${entrevista}/x.webm`, 'x.webm']) {
  assert.equal(rutaVideoSchema.safeParse(mala).success, false, `debe rechazar: ${mala}`)
}

// Los ids reales de la plataforma (uuid de Postgres y sembrados a mano) pasan el GUID flojo
for (const id of [entrevista, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'd0e1f2a3-b4c5-6789-defa-000000000001']) {
  assert.equal(z.guid().safeParse(id).success, true, `GUID debe aceptar ${id}`)
}
assert.equal(z.guid().safeParse('no-es-un-id').success, false)

console.log('✅ validacion: campos lenient aceptan claves ausentes/null sin rechazar, la clave de video real pasa y las malas no, y los ids reales cumplen el GUID')
