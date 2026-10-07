/**
 * La marca de PsicoPlataforma.
 * - Icono: una burbuja de hoja de respuestas rellena de marcador (el mismo dibujo que app/icon.svg, la pestana del navegador).
 * - Nombre: "PsicoPlataforma" donde la "o" de "Psico" es esa burbuja marcada. Hereda color y tamano del texto que lo rodea.
 */

/** Icono solo: burbuja marcada sobre un cuadrado verde. */
export function IconoMarca({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="#17594E" />
      <circle cx="16" cy="16" r="8.2" fill="none" stroke="#FFFFFF" strokeWidth="2.6" />
      <circle cx="16" cy="16" r="4.4" fill="#F5D547" />
    </svg>
  )
}

/** El nombre con la "o" de burbuja marcada. El anillo usa el color del texto; el relleno es siempre el amarillo del marcador. */
export function NombreMarca({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span role="img" aria-label="PsicoPlataforma" className={className} style={{ whiteSpace: 'nowrap', ...style }}>
      <span aria-hidden="true">Psic</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        style={{ display: 'inline-block', width: '0.82em', height: '0.82em', verticalAlign: '-0.12em', margin: '0 0.03em' }}
      >
        <circle cx="10" cy="10" r="7.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="10" cy="10" r="3.7" fill="#F5D547" />
      </svg>
      <span aria-hidden="true">Plataforma</span>
    </span>
  )
}
