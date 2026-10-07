import React from 'react'
import { Svg, Rect, Circle, Text, View } from '@react-pdf/renderer'

/**
 * La marca de PsicoPlataforma para el PDF (misma que components/Logo.tsx, dibujada con las primitivas de @react-pdf:
 * va como vector, sin imagenes ni pedidos de red).
 * - Icono: burbuja de hoja de respuestas rellena de marcador sobre un cuadrado verde.
 * - Nombre: "PsicoPlataforma" donde la "o" de "Psico" es esa burbuja marcada (el anillo usa el color del texto).
 */
const VERDE = '#17594E'
const MARCADOR = '#F5D547'

export function IconoMarcaPDF({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x={0} y={0} width={32} height={32} rx={8} ry={8} fill={VERDE} />
      <Circle cx={16} cy={16} r={8.2} fill="none" stroke="#FFFFFF" strokeWidth={2.6} />
      <Circle cx={16} cy={16} r={4.4} fill={MARCADOR} />
    </Svg>
  )
}

/** El nombre con la "o" de burbuja marcada. `fontSize` es el del texto; la burbuja se escala a su altura. */
export function NombreMarcaPDF({ fontSize = 18, color = '#0f172a' }: { fontSize?: number; color?: string }) {
  const burbuja = fontSize * 0.8
  const estilo = { fontFamily: 'Roboto', fontWeight: 'bold' as const, fontSize, color }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={estilo}>Psic</Text>
      <View style={{ width: burbuja, height: burbuja, marginHorizontal: fontSize * 0.04, marginTop: fontSize * 0.08 }}>
        <Svg width={burbuja} height={burbuja} viewBox="0 0 20 20">
          <Circle cx={10} cy={10} r={7.6} fill="none" stroke={color} strokeWidth={2.4} />
          <Circle cx={10} cy={10} r={3.7} fill={MARCADOR} />
        </Svg>
      </View>
      <Text style={estilo}>Plataforma</Text>
    </View>
  )
}

/** Icono y nombre juntos, para el encabezado del informe. */
export function MarcaPDF({ fontSize = 18, color = '#0f172a' }: { fontSize?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <IconoMarcaPDF size={fontSize * 1.45} />
      <View style={{ marginLeft: fontSize * 0.5 }}>
        <NombreMarcaPDF fontSize={fontSize} color={color} />
      </View>
    </View>
  )
}
