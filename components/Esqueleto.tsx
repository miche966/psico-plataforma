// Esqueletos de carga del panel: la silueta gris de lo que va a aparecer, en lugar de un circulo girando sobre una pantalla vacia.

export function Bloque({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`bg-slate-200 rounded-md animate-pulse motion-reduce:animate-none ${className}`} />
}

function Fila() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex-1 space-y-2">
        <Bloque className="h-4 w-48" />
        <Bloque className="h-3.5 w-3/4" />
        <Bloque className="h-3 w-40" />
      </div>
      <Bloque className="h-8 w-24 hidden sm:block" />
      <Bloque className="h-5 w-20" />
    </div>
  )
}

/** Filas de una lista, para cargas dentro de una seccion. */
export function EsqueletoLista({ filas = 6 }: { filas?: number }) {
  return (
    <div role="status" aria-busy="true" className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => <Fila key={i} />)}
    </div>
  )
}

/**
 * Pantalla completa del panel mientras cargan los datos: titulo, cifras o filtros y la lista.
 * Con `detalle` se agrega la columna del candidato seleccionado (Centro de control).
 */
export function EsqueletoPagina({ detalle = false, filas = 6 }: { detalle?: boolean; filas?: number }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true">
        <Bloque className="h-8 w-72 mb-2" />
        <Bloque className="h-4 w-80 mb-6" />
        <div className="flex gap-8 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Bloque className="h-9 w-16" />
              <Bloque className="h-3.5 w-20" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5 mb-5">
          <Bloque className="h-10 flex-1 min-w-[16rem]" />
          <Bloque className="h-10 w-44" />
          <Bloque className="h-10 w-36" />
        </div>
        <div className={detalle ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6' : ''}>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {Array.from({ length: filas }, (_, i) => <Fila key={i} />)}
          </div>
          {detalle && (
            <div className="hidden lg:block border border-slate-200 border-dashed rounded-xl p-6 space-y-4">
              <Bloque className="h-7 w-56" />
              <Bloque className="h-4 w-44" />
              <Bloque className="h-24 w-full" />
              <Bloque className="h-4 w-full" />
              <Bloque className="h-4 w-5/6" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
