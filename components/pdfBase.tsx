import React from 'react'
import { Text as PDFText, Font } from '@react-pdf/renderer'

// Base comun de los PDF de la plataforma (informe tecnico e informe para supervisores): la fuente y un Text sin el bug de
// ligaduras. Importar este modulo registra la fuente, asi que cualquier PDF que lo use la tiene lista.

// Fuente del PDF: se sirve desde el propio sitio (public/fonts). Antes se pedia a fonts.gstatic.com, que la politica de
// seguridad (CSP, connect-src) bloquea, y la generacion del PDF fallaba con "Failed to fetch".
Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 },
  ],
})

// Bug conocido de @react-pdf/renderer + Roboto: la ligadura tipográfica "fi"/"fl" pierde
// la segunda letra al renderizar (https://github.com/diegomura/react-pdf/issues/2762).
// Insertar un caracter invisible (ZWNJ) no funciona: esta fuente lo trata como glifo
// faltante y deja un hueco visible. La solucion sin efectos visuales es partir el texto
// justo entre "f" e "i"/"l" en Text hijos independientes: cada uno se mide por separado,
// asi el shaper nunca ve la secuencia "fi"/"fl" contigua y no arma la ligadura.
// Se desactiva ademas el guionado automatico para que el salto de linea no elija justo
// ese punto de corte (evita fragmentos de una sola letra como "f-" al final de renglon).
Font.registerHyphenationCallback(word => [word])

function partirLigaduras(texto: string): string[] {
  const partes: string[] = []
  let lastIndex = 0
  const re = /f(?=[il])/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) {
    partes.push(texto.slice(lastIndex, m.index + 1))
    lastIndex = m.index + 1
  }
  partes.push(texto.slice(lastIndex))
  return partes.filter(p => p.length > 0)
}

function evitarLigaduras(valor: React.ReactNode): React.ReactNode {
  if (typeof valor === 'string') return partirLigaduras(valor).map((parte, i) => <PDFText key={i}>{parte}</PDFText>)
  if (Array.isArray(valor)) return valor.map(evitarLigaduras)
  return valor
}

export function Text({ children, ...props }: any) {
  return <PDFText {...props}>{evitarLigaduras(children)}</PDFText>
}
