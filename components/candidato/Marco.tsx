import { NombreMarca } from '@/components/Logo'
import type { ReactNode } from 'react'

/** La marca: el nombre con la "o" de burbuja marcada (ver components/Logo.tsx). */
export function Marca() {
  return <NombreMarca className="pp-marca" />
}

/**
 * Marco comun de las pantallas del candidato: papel de fondo, marca arriba y una columna de lectura.
 * `titulo` pone el titulo de la pestana (React 19 lo lleva al <head>).
 * `ancho` abre la columna (para pantallas que combinan varios bloques, como la comprobacion de camara).
 * `centrado` es para las pantallas de acceso (ingreso, 2FA, contrasena): la marca y el formulario van al centro de la ventana.
 */
export function Marco({ titulo, centrado = false, ancho = false, children }: { titulo?: string; centrado?: boolean; ancho?: boolean; children: ReactNode }) {
  return (
    <div className={['pp', centrado && 'pp-centrado', ancho && 'pp-ancho'].filter(Boolean).join(' ')}>
      {titulo ? <title>{`${titulo} · PsicoPlataforma`}</title> : null}
      <header className="pp-cabecera"><Marca /></header>
      <main className="pp-columna">{children}</main>
    </div>
  )
}
