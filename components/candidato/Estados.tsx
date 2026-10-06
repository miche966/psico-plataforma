import type { ReactNode } from 'react'
import { Marco } from './Marco'

// Contacto del equipo de seleccion: se muestra al terminar y cuando un enlace ya no sirve
const CORREO_SELECCION = 'seleccion@republicamicrofinanzas.com.uy'
const WHATSAPP_VISIBLE = '092 651 770'
const WHATSAPP_ENLACE = 'https://wa.me/598092651770'

/** Mientras llegan los datos de la prueba. */
export function PantallaCarga({ texto = 'Cargando la prueba…' }: { texto?: string }) {
  return (
    <Marco>
      <div className="pp-centro" role="status">
        <div className="pp-centro-contenido">
          <p className="pp-muted" style={{ margin: 0 }}>{texto}</p>
          <div className="pp-barrido" aria-hidden="true" />
        </div>
      </div>
    </Marco>
  )
}

/** No se pudo cargar: dice que paso y deja reintentar. */
export function PantallaError({ mensaje, onReintentar, titulo, etiqueta = 'Reintentar' }: { mensaje: string; onReintentar?: () => void; titulo?: string; etiqueta?: string }) {
  return (
    <Marco titulo={titulo ?? 'No se pudo cargar'}>
      <div className="pp-centro">
        <div className="pp-centro-contenido" role="alert">
          {titulo ? <h1 className="pp-titulo">{titulo}</h1> : null}
          <p className={titulo ? 'pp-muted' : 'pp-aviso-error'} style={titulo ? { margin: '0 0 1.25rem' } : undefined}>{mensaje}</p>
          {onReintentar ? <button type="button" className="pp-boton" onClick={onReintentar}>{etiqueta}</button> : null}
        </div>
      </div>
    </Marco>
  )
}

/** Las respuestas siguen en pantalla pero no se pudieron guardar: se puede reintentar sin perderlas. */
export function PantallaGuardadoFallido({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <Marco titulo="No se pudo guardar">
      <div className="pp-centro">
        <div className="pp-centro-contenido" role="alert">
          <p className="pp-aviso-error">{mensaje}</p>
          <button type="button" className="pp-boton" onClick={onReintentar}>Reintentar guardado</button>
        </div>
      </div>
    </Marco>
  )
}

/** Entre una prueba y la siguiente de la bateria. */
export function PantallaSiguiente() {
  return (
    <Marco>
      <div className="pp-centro" role="status">
        <div className="pp-centro-contenido">
          <p className="pp-muted" style={{ margin: 0 }}>Respuestas guardadas. Pasamos a la siguiente prueba…</p>
          <div className="pp-barrido" aria-hidden="true" />
        </div>
      </div>
    </Marco>
  )
}

/** Como contactar al equipo de seleccion. */
export function Contacto({ intro }: { intro: string }) {
  return (
    <section className="pp-aparte">
      <h2>Qué sigue</h2>
      <p>{intro}</p>
      <dl className="pp-contactos">
        <dt>Correo</dt>
        <dd><a href={`mailto:${CORREO_SELECCION}`}>{CORREO_SELECCION}</a></dd>
        <dt>WhatsApp</dt>
        <dd><a href={WHATSAPP_ENLACE}>{WHATSAPP_VISIBLE}</a></dd>
      </dl>
    </section>
  )
}

/** Fin de una prueba suelta o de toda la bateria. `children` reemplaza el texto principal si hace falta. */
export function PantallaFin({ nombre, titulo = 'Evaluación completada', children }: { nombre?: string; titulo?: string; children?: ReactNode }) {
  return (
    <Marco titulo={titulo}>
      <div className="pp-fin-marca" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <h1 className="pp-titulo">{titulo}</h1>
      <p className="pp-lead">
        {children ?? <>{nombre ? <>Gracias, <strong>{nombre}</strong>. </> : null}Tus respuestas quedaron guardadas y ya las recibió el equipo de selección.</>}
      </p>
      <Contacto intro="El equipo de selección se pondrá en contacto con vos. Si tenés alguna consulta, escribinos:" />
    </Marco>
  )
}

/** Aviso sin accion posible (por ejemplo, un proceso ya cerrado), con el contacto al pie. */
export function PantallaAviso({ titulo, intro, children }: { titulo: string; intro: string; children: ReactNode }) {
  return (
    <Marco titulo={titulo}>
      <h1 className="pp-titulo">{titulo}</h1>
      <p className="pp-lead">{children}</p>
      <Contacto intro={intro} />
    </Marco>
  )
}
