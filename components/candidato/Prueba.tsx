'use client'

import { useRef, type ReactNode } from 'react'
import { Marco } from './Marco'

const mmss = (segundos: number) => `${Math.floor(segundos / 60)}:${String(Math.max(0, segundos) % 60).padStart(2, '0')}`
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']

type EstadoTiempo = 'normal' | 'aviso' | 'alarma'
/** Mismos umbrales de siempre: aviso al ultimo tercio y alarma al ultimo sexto del tiempo de la pregunta. */
function estadoDelTiempo(restante: number, limite: number): EstadoTiempo {
  const fraccion = restante / limite
  return fraccion <= 1 / 6 ? 'alarma' : fraccion <= 1 / 3 ? 'aviso' : 'normal'
}

type EncabezadoProps = {
  nombre: string
  actual: number
  total: number
  /** Cuenta regresiva de la pregunta actual (segundos restantes y limite). */
  restante?: number
  limite?: number
  /** Tiempo total transcurrido de la prueba, con su limite en minutos. */
  transcurrido?: number
  limiteTotalMin?: number
}

function EncabezadoPrueba({ nombre, actual, total, restante, limite, transcurrido, limiteTotalMin }: EncabezadoProps) {
  const hayCuenta = restante !== undefined && limite !== undefined
  const estado = hayCuenta ? estadoDelTiempo(restante, limite) : 'normal'
  // Se avisa a quien usa lector de pantalla solo al entrar en cada tramo, no cada segundo
  const anuncio = hayCuenta && (restante === Math.ceil(limite / 3) || restante === Math.ceil(limite / 6)) ? `Quedan ${restante} segundos` : ''
  const pasoDelTiempoTotal = transcurrido !== undefined && limiteTotalMin !== undefined && transcurrido > limiteTotalMin * 60
  return (
    <div className="pp-prueba-cab">
      <div className="pp-prueba-fila">
        <div>
          <h1 className="pp-prueba-nombre">{nombre}</h1>
          <p className="pp-prueba-avance">Pregunta {actual} de {total}</p>
        </div>
        {hayCuenta ? (
          <div className="pp-tiempo" data-estado={estado} role="timer" aria-label={`Tiempo restante: ${restante} segundos`}>
            <span className="pp-tiempo-num">{mmss(restante)}</span>
            <span className="pp-tiempo-barra" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, (restante / limite) * 100))}%` }} /></span>
            <span className="pp-sr" aria-live="polite">{anuncio}</span>
          </div>
        ) : transcurrido !== undefined ? (
          <div className="pp-tiempo">
            <span className="pp-tiempo-total" data-estado={pasoDelTiempoTotal ? 'alarma' : undefined} role="timer" aria-label={`Tiempo transcurrido: ${mmss(transcurrido)}${limiteTotalMin ? ` de ${limiteTotalMin} minutos` : ''}`}>
              {mmss(transcurrido)}{limiteTotalMin ? ` de ${limiteTotalMin}:00` : ''}
            </span>
          </div>
        ) : null}
      </div>
      {hayCuenta && transcurrido !== undefined && limiteTotalMin ? (
        <p className="pp-tiempo-total" data-estado={pasoDelTiempoTotal ? 'alarma' : undefined} style={{ margin: '0.35rem 0 0', textAlign: 'right' }}>
          En total: {mmss(transcurrido)} de {limiteTotalMin}:00
        </p>
      ) : null}
      <div className="pp-avance" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={actual - 1} aria-label="Avance de la prueba">
        <span style={{ width: `${Math.round(((actual - 1) / total) * 100)}%` }} />
      </div>
    </div>
  )
}

type EleccionProps = EncabezadoProps & {
  /** Etiqueta del tipo de pregunta (p. ej. "Sinonimos"), si la prueba la muestra. */
  categoria?: string
  /** SJT: el escenario se muestra aparte, con su consigna. */
  situacion?: string
  consigna?: string
  /** Resto de las pruebas: el enunciado de la pregunta. */
  enunciado?: string
  opciones: string[]
  /** Opcion ya elegida (queda resaltada un instante antes de pasar a la siguiente). */
  elegida: string | null
  onElegir: (opcion: string) => void
}

/** Marco de una prueba: encabezado con avance y tiempo, etiqueta de la pregunta y el contenido que cada prueba pone debajo. */
export function MarcoPrueba({ categoria, children, ...encabezado }: EncabezadoProps & { categoria?: string; children: ReactNode }) {
  return (
    <Marco titulo={encabezado.nombre}>
      <EncabezadoPrueba {...encabezado} />
      {categoria ? <p className="pp-categoria">{categoria}</p> : null}
      {children}
    </Marco>
  )
}

/** Opciones de respuesta con letra (A, B, C...): la elegida queda resaltada y el resto se bloquea hasta pasar a la siguiente. */
export function ListaOpciones({ opciones, elegida, onElegir }: { opciones: string[]; elegida: string | null; onElegir: (opcion: string) => void }) {
  return (
    <div className="pp-opciones" role="group" aria-label="Opciones de respuesta">
      {opciones.map((opcion, indice) => (
        <button key={indice} type="button" className="pp-opcion" aria-pressed={elegida === opcion} disabled={elegida !== null} onClick={() => onElegir(opcion)}>
          <span className="pp-burbuja" aria-hidden="true">{LETRAS[indice] ?? indice + 1}</span>
          <span className="pp-opcion-texto">{opcion}</span>
        </button>
      ))}
    </div>
  )
}

/** Prueba con una respuesta correcta por pregunta (opciones A, B, C, D) y tiempo por pregunta. */
export function PruebaEleccion({ nombre, categoria, situacion, consigna, enunciado, opciones, elegida, onElegir, ...encabezado }: EleccionProps) {
  return (
    <MarcoPrueba nombre={nombre} categoria={categoria} {...encabezado}>
      {situacion !== undefined ? (
        <>
          <section className="pp-situacion" aria-labelledby="pp-situacion-titulo">
            <h2 id="pp-situacion-titulo">Situación</h2>
            <p>{situacion}</p>
          </section>
          <p className="pp-consigna">{consigna ?? '¿Qué harías en esta situación?'}</p>
        </>
      ) : (
        <h2 className="pp-enunciado">{enunciado}</h2>
      )}
      <ListaOpciones opciones={opciones} elegida={elegida} onElegir={onElegir} />
    </MarcoPrueba>
  )
}

type EscalaProps = EncabezadoProps & {
  /** Etiqueta del factor que mide la pregunta, si la prueba la muestra. */
  categoria?: string
  /** Texto que explica como responder (aparece sobre la pregunta). */
  instruccion?: string
  enunciado: string
  /** Etiquetas de la escala, de la primera a la ultima. */
  opciones: string[]
  /** Si se indica, cada burbuja lleva su numero de la escala (empezando por este). */
  numerosDesde?: number
  onElegir: (indice: number) => void
}

/** Prueba de escala (de acuerdo / en desacuerdo): una respuesta por pregunta y tiempo total. */
export function PruebaEscala({ nombre, categoria, instruccion, enunciado, opciones, numerosDesde, onElegir, ...encabezado }: EscalaProps) {
  // Un doble toque en pantalla tactil respondia tambien la pregunta siguiente: se ignora el segundo si llega enseguida
  const ultimo = useRef(0)
  const elegir = (indice: number) => {
    const ahora = Date.now()
    if (ahora - ultimo.current < 350) return
    ultimo.current = ahora
    onElegir(indice)
  }
  return (
    <Marco titulo={nombre}>
      <EncabezadoPrueba nombre={nombre} {...encabezado} />
      {categoria ? <p className="pp-categoria">{categoria}</p> : null}
      {instruccion ? <p className="pp-instruccion">{instruccion}</p> : null}
      <h2 className="pp-enunciado">{enunciado}</h2>
      <div className="pp-opciones" role="group" aria-label="Escala de respuesta">
        {opciones.map((opcion, indice) => (
          <button key={indice} type="button" className="pp-opcion" onClick={() => elegir(indice)}>
            <span className="pp-burbuja" aria-hidden="true">{numerosDesde !== undefined ? numerosDesde + indice : null}</span>
            <span className="pp-opcion-texto">{opcion}</span>
          </button>
        ))}
      </div>
    </Marco>
  )
}
