'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, FileText, Clock, Filter } from 'lucide-react'

export interface ItemAuditoria {
  id: string
  numItem: number
  categoria: string
  pregunta: string
  opcionSeleccionada?: string
  opcionCorrecta?: string
  textoRedactado?: string
  esTextoAbierto: boolean
  esCorrecto?: boolean
  tiempoSegundos?: number
  puntaje?: number
}

interface Props {
  respuestas: ItemAuditoria[]
  tituloTest?: string
}

export function AuditoriaRespuestasDetallada({ respuestas, tituloTest = "Auditoría de Respuestas del Test" }: Props) {
  const [filtro, setFiltro] = useState<'todos' | 'errores' | 'redactadas' | 'correctos'>('todos')

  const itemsFiltrados = respuestas.filter(item => {
    if (filtro === 'errores') return !item.esTextoAbierto && item.esCorrecto === false
    if (filtro === 'correctos') return !item.esTextoAbierto && item.esCorrecto === true
    if (filtro === 'redactadas') return item.esTextoAbierto
    return true
  })

  const totalCorrectos = respuestas.filter(r => !r.esTextoAbierto && r.esCorrecto).length
  const totalErrores = respuestas.filter(r => !r.esTextoAbierto && r.esCorrecto === false).length
  const totalAbiertas = respuestas.filter(r => r.esTextoAbierto).length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden my-6">
      {/* Header del Componente */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            {tituloTest}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspección detallada de reactivos, selecciones del candidato y respuestas redactadas.
          </p>
        </div>

        {/* Resumen & Filtros */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => setFiltro('todos')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filtro === 'todos' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({respuestas.length})
          </button>
          <button
            onClick={() => setFiltro('correctos')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filtro === 'correctos' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            ✓ Correctos ({totalCorrectos})
          </button>
          <button
            onClick={() => setFiltro('errores')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              filtro === 'errores' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            ✗ Errores ({totalErrores})
          </button>
          {totalAbiertas > 0 && (
            <button
              onClick={() => setFiltro('redactadas')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                filtro === 'redactadas' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              ✍️ Redactadas ({totalAbiertas})
            </button>
          )}
        </div>
      </div>

      {/* Lista de Ítems */}
      <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
        {itemsFiltrados.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No se encontraron respuestas para el filtro seleccionado.
          </div>
        ) : (
          itemsFiltrados.map((item) => {
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
              >
                {/* Cabecera del Reactivo */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold text-xs">
                      #{item.numItem}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {item.categoria}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.tiempoSegundos && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.tiempoSegundos}s
                      </span>
                    )}

                    {item.esTextoAbierto ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                        ✍️ Respuesta Redactada
                      </span>
                    ) : item.esCorrecto === true ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Correcto
                      </span>
                    ) : item.esCorrecto === false ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> Incorrecto
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                        Respuesta Registrada
                      </span>
                    )}
                  </div>
                </div>

                {/* Pregunta / Enunciado */}
                <div className="text-sm font-semibold text-slate-800">
                  {item.pregunta}
                </div>

                {/* Contenido de la Respuesta */}
                {item.esTextoAbierto ? (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Texto Redactado por el Evaluado:
                    </span>
                    <p className="text-sm text-slate-800 italic font-mono leading-relaxed">
                      "{item.textoRedactado || 'Sin respuesta redactada.'}"
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Opción Seleccionada por Evaluado */}
                    <div
                      className={`p-3 rounded-xl border ${
                        item.esCorrecto === true
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                          : item.esCorrecto === false
                          ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <span className="block font-bold text-[11px] uppercase tracking-wider mb-1 opacity-75">
                        Seleccionado por Evaluado:
                      </span>
                      <span className="font-semibold text-sm">
                        {item.opcionSeleccionada || 'Sin selección'}
                      </span>
                    </div>

                    {/* Opción Correcta / Esperada */}
                    {item.esCorrecto === false && item.opcionCorrecta && (
                      <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-950">
                        <span className="block font-bold text-[11px] uppercase tracking-wider mb-1 text-emerald-700">
                          Respuesta Correcta / Esperada:
                        </span>
                        <span className="font-semibold text-sm">
                          {item.opcionCorrecta}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
