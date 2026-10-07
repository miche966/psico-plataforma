// Nombre de un proceso para mostrar. Muchos se cargaron en mayusculas, entero ("PASANTIAS ... PARA ESTUDIANTES ...") o solo en un
// tramo (Pasantias "YO ESTUDIO Y TRABAJO 2026" para estudiantes), que se lee mal en una lista. Esto solo cambia lo que se ve:
// el dato guardado y las exportaciones no se tocan.

// Siglas que se conservan en mayuscula
const SIGLAS = new Set(['IT', 'TI', 'BI', 'RRHH', 'RMSA', 'IA', 'CEO', 'CFO', 'UY', 'SA', 'SRL', 'ICAR', 'SJT', 'DASS', 'HEXACO', 'PYME', 'PYMES', 'UTU', 'UDELAR', 'BROU', 'ANTEL', 'ANII'])
// Nombres propios que no deben quedar en minuscula
const PROPIOS: Record<string, string> = { microfinanzas: 'Microfinanzas', uruguay: 'Uruguay', montevideo: 'Montevideo', 'república': 'República' }

const mayus = (letra: string) => letra.toLocaleUpperCase('es')
const esMayuscula = (l: string) => l === l.toLocaleUpperCase('es') && l !== l.toLocaleLowerCase('es')

/** A minuscula, conservando siglas y nombres propios. */
function enMinuscula(texto: string): string {
  return texto.toLocaleLowerCase('es').replace(/\p{L}+/gu, palabra => {
    const sigla = palabra.toLocaleUpperCase('es')
    if (SIGLAS.has(sigla)) return sigla
    return PROPIOS[palabra] ?? palabra
  })
}

/** Una comilla o un parentesis "abre" si va al comienzo o despues de un espacio; si no, cierra. */
const ABRE = /(^|[\s(\[])(["“«]\s*)(\p{L})/gu

/**
 * Pasa a "oracion" lo que esta escrito en mayusculas:
 *  - si casi todo el nombre esta en mayusculas, el nombre entero;
 *  - si no, solo los tramos de dos o mas palabras en mayusculas (por ejemplo lo que va entre comillas).
 * Lo que ya esta bien escrito no cambia, asi que aplicarla dos veces da lo mismo que una.
 */
export function nombreDeProcesoLegible(nombre: string | null | undefined): string {
  if (!nombre) return ''
  const letras = nombre.match(/\p{L}/gu)
  if (!letras || letras.length < 4) return nombre

  if (letras.filter(esMayuscula).length / letras.length >= 0.6) {
    let t = enMinuscula(nombre)
    // Mayuscula inicial: al comienzo, despues de una comilla que ABRE (una comilla recta tambien cierra, y despues sigue minuscula),
    // despues de un parentesis y despues de ":" o " - "
    t = t.replace(/^(\s*)(\p{L})/u, (_m, esp: string, letra: string) => esp + mayus(letra))
    t = t.replace(ABRE, (_m, antes: string, comilla: string, letra: string) => antes + comilla + mayus(letra))
    t = t.replace(/([:–—]\s+|\s-\s+)(\p{L})/gu, (_m, antes: string, letra: string) => antes + mayus(letra))
    return t
  }

  // Texto mixto: solo se tocan los tramos en mayusculas con al menos dos palabras de dos letras o mas
  return nombre.replace(/(?<![\p{L}\d])[\p{Lu}\d]+(?:\s+[\p{Lu}\d]+)+(?![\p{L}\d])/gu, (tramo: string, posicion: number, completo: string) => {
    const palabras = tramo.split(/\s+/).filter(p => p.length >= 2 && /\p{L}/u.test(p))
    if (palabras.length < 2) return tramo
    let t = enMinuscula(tramo)
    // Va con mayuscula inicial si el tramo abre el texto o una comilla
    const antes = completo.slice(0, posicion)
    if (/(^|[\s(\[])["“«]\s*$/u.test(antes) || /^\s*$/.test(antes)) t = t.replace(/^(\p{L})/u, (_m, letra: string) => mayus(letra))
    return t
  })
}
