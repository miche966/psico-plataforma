import type { SupabaseClient } from '@supabase/supabase-js'
import { bancoDeItems, calcularPuntaje, diferenciasDePuntaje, esIcar, esPuntuable, type ItemPuntuable } from '@/lib/server/puntuacion'

/**
 * Modo paralelo del puntaje en el servidor (etapa 2 de docs/PUNTAJE_EN_SERVIDOR.md): al finalizar un test,
 * el servidor recalcula el puntaje con las respuestas recibidas y lo compara con el que mando el navegador,
 * pero NO cambia lo que se guarda. Solo deja una linea de log cuando algo no coincide o no se podria
 * puntuar, para ver con trafico real si el recalculo es confiable antes de pasar a usarlo.
 *
 * Nunca lanza ni demora al candidato mas que una consulta: cualquier falla se loguea y se sigue.
 */
export async function compararPuntajeEnSombra(
  db: SupabaseClient,
  testId: string,
  respuestas: Array<{ item_id: string; valor: number }>,
  puntajeDelNavegador: unknown,
  sesionId: string,
): Promise<void> {
  try {
    if (!esPuntuable(testId)) return
    const { data, error } = await db
      .from('items')
      .select('id, factor, inverso, respuesta_correcta, opciones, subtipo, nivel_dificultad')
      .eq('test_id', bancoDeItems(testId))
    if (error) throw error
    let items = (data || []) as ItemPuntuable[]
    // ICAR: el universo es lo que el candidato vio (depende de ?max= y ?norot= de su enlace), no todo el banco
    if (esIcar(testId)) {
      const vistos = new Set(respuestas.map(r => r.item_id))
      items = items.filter(i => vistos.has(i.id))
    }
    const calculo = calcularPuntaje(testId, items, respuestas, { valoresInvertidos: true })
    const etiqueta = `test=${testId.slice(0, 8)} sesion=${sesionId.slice(0, 8)}`
    if (!calculo.ok) {
      console.warn(`[PUNTAJE SOMBRA] rechazaria ${etiqueta}: ${calculo.error}`)
      return
    }
    const difieren = diferenciasDePuntaje(puntajeDelNavegador, calculo.puntaje)
    if (difieren.length > 0) console.warn(`[PUNTAJE SOMBRA] difiere ${etiqueta} claves=${difieren.join(',')}`)
  } catch (error) {
    console.error('[PUNTAJE SOMBRA] No se pudo comparar, se sigue sin afectar al candidato:', error)
  }
}
