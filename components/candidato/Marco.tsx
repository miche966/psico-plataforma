import type { ReactNode } from 'react'

/** La marca: una burbuja de hoja de respuestas junto a un trazo de marcador. Mismo dibujo que el icono de la pestana. */
export function Marca() {
  return (
    <span className="pp-marca">
      <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#17594E" />
        <circle cx="12" cy="16" r="5.6" fill="none" stroke="#FFFFFF" strokeWidth="2.6" />
        <rect x="19" y="12" width="9" height="8" rx="2" fill="#F5D547" />
      </svg>
      PsicoPlataforma
    </span>
  )
}

/**
 * Marco comun de las pantallas del candidato: papel de fondo, marca arriba y una columna de lectura.
 * `titulo` pone el titulo de la pestana (React 19 lo lleva al <head>).
 * `centrado` es para las pantallas de acceso (ingreso, 2FA, contrasena): la marca y el formulario van al centro de la ventana.
 */
export function Marco({ titulo, centrado = false, children }: { titulo?: string; centrado?: boolean; children: ReactNode }) {
  return (
    <div className={centrado ? 'pp pp-centrado' : 'pp'}>
      {titulo ? <title>{`${titulo} · PsicoPlataforma`}</title> : null}
      <header className="pp-cabecera"><Marca /></header>
      <main className="pp-columna">{children}</main>
    </div>
  )
}
