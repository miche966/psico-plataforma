// GENERADO por scripts/generar-baremo-cognitivo.ts el 2026-10-07. No editar a mano: volver a correr `npm run baremo:cognitivo`.
// Distribucion de aciertos (en %, de 0 a 100) de las personas evaluadas en cada prueba cognitiva, una sesion por persona.
// Se usa en lib/baremoCognitivo.ts. Ver docs/BAREMO_COGNITIVO.md.
export const FECHA_BAREMO = '2026-10-07'
export const BAREMOS: Record<string, { n: number; histograma: Record<string, number> }> = {
  // Razonamiento verbal
  'd4e5f6a7-b8c9-0123-defa-234567890123': { n: 282, histograma: { '40': 1, '45': 1, '50': 4, '55': 6, '60': 4, '65': 15, '70': 17, '75': 21, '80': 27, '85': 45, '90': 60, '95': 48, '100': 33 } },
  // Razonamiento abstracto
  'f6a7b8c9-d0e1-2345-fabc-456789012345': { n: 291, histograma: { '20': 1, '25': 2, '30': 9, '35': 16, '40': 18, '45': 28, '50': 28, '55': 35, '60': 35, '65': 35, '70': 28, '75': 26, '80': 19, '85': 4, '90': 6, '100': 1 } },
  // Atención al detalle
  'b8c9d0e1-f2a3-4567-bcde-888888888888': { n: 292, histograma: { '35': 1, '45': 2, '50': 6, '55': 8, '60': 36, '65': 44, '70': 48, '75': 49, '80': 63, '85': 24, '90': 10, '95': 1 } },
  // Razonamiento numérico
  'c3d4e5f6-a7b8-9012-cdef-123456789012': { n: 213, histograma: { '20': 1, '25': 6, '30': 6, '35': 8, '40': 17, '45': 8, '50': 13, '55': 12, '60': 13, '65': 25, '70': 17, '75': 18, '80': 19, '85': 18, '90': 18, '95': 14 } },
}
