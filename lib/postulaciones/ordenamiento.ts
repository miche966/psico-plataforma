export interface PostulacionConFecha {
  fecha_postulacion?: string | null
  nombre?: string
  apellido?: string
}

export function timestampSeguro(fecha?: string | null): number {
  if (!fecha) return 0
  const timestamp = new Date(fecha).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function formatearFecha(fecha?: string | null): string {
  if (!fecha) return 'Fecha no disponible'
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return 'Fecha no disponible'
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ordenarPorPostulacionDescendente<T extends PostulacionConFecha>(a: T, b: T): number {
  const tA = timestampSeguro(a.fecha_postulacion)
  const tB = timestampSeguro(b.fecha_postulacion)

  // Registros sin fecha válida (0) se ubican siempre al final de la lista
  if (tA === 0 && tB === 0) return `${a.apellido || ''} ${a.nombre || ''}`.localeCompare(`${b.apellido || ''} ${b.nombre || ''}`, 'es')
  if (tA === 0) return 1
  if (tB === 0) return -1

  const dif = tB - tA
  if (dif !== 0) return dif
  return `${a.apellido || ''} ${a.nombre || ''}`.localeCompare(`${b.apellido || ''} ${b.nombre || ''}`, 'es')
}

export function ordenarPorPostulacionAscendente<T extends PostulacionConFecha>(a: T, b: T): number {
  const tA = timestampSeguro(a.fecha_postulacion)
  const tB = timestampSeguro(b.fecha_postulacion)

  // Registros sin fecha válida (0) se ubican siempre al final de la lista (incluso en orden ascendente)
  if (tA === 0 && tB === 0) return `${a.apellido || ''} ${a.nombre || ''}`.localeCompare(`${b.apellido || ''} ${b.nombre || ''}`, 'es')
  if (tA === 0) return 1
  if (tB === 0) return -1

  const dif = tA - tB
  if (dif !== 0) return dif
  return `${a.apellido || ''} ${a.nombre || ''}`.localeCompare(`${b.apellido || ''} ${b.nombre || ''}`, 'es')
}
