import { ItemAuditoria } from '@/components/AuditoriaRespuestasDetallada'

export function mapperAuditoriaUniversal(
  items: any[],
  respuestasGuardadas: any[],
  testId: string
): ItemAuditoria[] {
  if (!items || items.length === 0) return []

  const respMap = new Map<string, any>()
  if (Array.isArray(respuestasGuardadas)) {
    respuestasGuardadas.forEach(r => {
      if (r && r.item_id) {
        respMap.set(r.item_id, r)
      }
    })
  }

  return items.map((item, index) => {
    const resp = respMap.get(item.id)
    const esTextoAbierto = Boolean(item.es_texto_abierto || item.tipo === 'abierto' || testId.includes('dass21') || testId.includes('frases'))

    let opcionSeleccionada = 'Sin respuesta registrada'
    let opcionCorrecta = item.respuesta_correcta || (item.opciones ? item.opciones[0] : undefined)
    let esCorrecto = false
    let textoRedactado = undefined

    if (esTextoAbierto) {
      textoRedactado = resp ? (resp.texto_redactado || resp.opcion_texto || String(resp.valor || '')) : undefined
    } else if (resp) {
      if (resp.opcion_texto) {
        opcionSeleccionada = resp.opcion_texto
      } else if (typeof resp.valor === 'number' && Array.isArray(item.opciones)) {
        const idx = resp.valor - 1
        opcionSeleccionada = item.opciones[idx] || item.opciones[0] || String(resp.valor)
      } else if (typeof resp.valor === 'string') {
        opcionSeleccionada = resp.valor
      } else if (resp.valor === 1 && item.respuesta_correcta) {
        opcionSeleccionada = item.respuesta_correcta
      } else {
        opcionSeleccionada = `Opción Registrada (${resp.valor})`
      }

      if (opcionCorrecta) {
        esCorrecto = opcionSeleccionada.trim().toLowerCase() === String(opcionCorrecta).trim().toLowerCase() || resp.valor === 1
      } else {
        esCorrecto = true
      }
    }

    return {
      id: item.id || `item-${index}`,
      numItem: index + 1,
      categoria: item.factor || item.categoria || 'General',
      pregunta: item.contenido || item.pregunta || `Reactivo #${index + 1}`,
      opcionSeleccionada,
      opcionCorrecta,
      textoRedactado,
      esTextoAbierto,
      esCorrecto,
      tiempoSegundos: resp?.tiempo_respuesta || undefined
    }
  })
}
