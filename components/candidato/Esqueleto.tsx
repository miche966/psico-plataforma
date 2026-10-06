import { Marco } from './Marco'

const bloque = (ancho: string, alto: string, extra: React.CSSProperties = {}): React.CSSProperties => ({ width: ancho, height: alto, ...extra })

/**
 * Mientras llega la prueba: la silueta gris de lo que va a aparecer (encabezado, enunciado y cuatro opciones),
 * en lugar de una pantalla vacia. Ocupa el mismo lugar que la pregunta real, asi nada salta al cargar.
 */
export function EsqueletoPrueba() {
  return (
    <Marco>
      <div role="status" aria-busy="true">
        <span className="pp-sr">Cargando la prueba…</span>
        <div aria-hidden="true">
          <div className="pp-prueba-cab">
            <div className="pp-prueba-fila">
              <div style={{ flex: 1 }}>
                <span className="pp-esq" style={bloque('55%', '1.25rem')} />
                <span className="pp-esq" style={bloque('32%', '0.9rem', { marginTop: '0.55rem' })} />
              </div>
              <span className="pp-esq" style={bloque('4.25rem', '1.6rem')} />
            </div>
            <div className="pp-avance"><span style={{ width: '0%' }} /></div>
          </div>
          <span className="pp-esq" style={bloque('92%', '1.5rem')} />
          <span className="pp-esq" style={bloque('64%', '1.5rem', { marginTop: '0.6rem', marginBottom: '1.75rem' })} />
          <div className="pp-opciones">
            {[0, 1, 2, 3].map(i => <span key={i} className="pp-esq pp-esq-opcion" />)}
          </div>
        </div>
      </div>
    </Marco>
  )
}
