import Link from 'next/link'

export default function Home() {
  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <h1 style={s.titulo}>PsicoPlataforma</h1>
        <p style={s.subtitulo}>Sistema de evaluación psicolaboral</p>
      </div>

      <div style={s.grid}>
        <Link href="/candidatos" style={s.tarjeta}>
          <div style={{ ...s.icono, background: '#dbeafe' }}>👤</div>
          <div>
            <div style={s.tarjetaTitulo}>Candidatos</div>
            <div style={s.tarjetaDesc}>Registrá candidatos y enviá links de evaluación</div>
          </div>
        </Link>

        <Link href="/panel" style={s.tarjeta}>
          <div style={{ ...s.icono, background: '#dcfce7' }}>📊</div>
          <div>
            <div style={s.tarjetaTitulo}>Panel del evaluador</div>
            <div style={s.tarjetaDesc}>Ver resultados y perfiles de personalidad</div>
          </div>
        </Link>

        <Link href="/test" style={s.tarjeta}>
          <div style={{ ...s.icono, background: '#fef9c3' }}>✏️</div>
          <div>
            <div style={s.tarjetaTitulo}>Nueva evaluación</div>
            <div style={s.tarjetaDesc}>Iniciar el Big Five directamente</div>
          </div>
        </Link>

        <Link href="/estadisticas" style={s.tarjeta}>
          <div style={{ ...s.icono, background: '#f3e8ff' }}>📈</div>
          <div>
            <div style={s.tarjetaTitulo}>Estadísticas</div>
            <div style={s.tarjetaDesc}>Comparación, promedios y gráfico radar</div>
          </div>
        </Link>

        <Link href="/procesos" style={s.tarjeta}>
          <div style={{ ...s.icono, background: '#fce7f3' }}>📋</div>
          <div>
            <div style={s.tarjetaTitulo}>Procesos</div>
            <div style={s.tarjetaDesc}>Agrupá candidatos por cargo y proceso</div>
          </div>
        </Link>
      </div>

      <div style={s.footer}>
        <p style={s.footerText}>Big Five IPIP-NEO · Dominio público · Baremación propia en construcción</p>
      </div>
    </div>
  )
}

const s = {
  contenedor: {
    maxWidth: '700px', margin: '0 auto',
    padding: '4rem 2rem', fontFamily: 'sans-serif'
  } as React.CSSProperties,
  encabezado: {
    textAlign: 'center' as const, marginBottom: '3rem'
  } as React.CSSProperties,
  titulo: {
    fontSize: '2rem', fontWeight: '700',
    color: '#1e293b', margin: '0 0 0.5rem'
  } as React.CSSProperties,
  subtitulo: {
    fontSize: '1rem', color: '#64748b', margin: 0
  } as React.CSSProperties,
  grid: {
    display: 'flex', flexDirection: 'column' as const, gap: '1rem'
  } as React.CSSProperties,
  tarjeta: {
    display: 'flex', alignItems: 'center', gap: '1.25rem',
    padding: '1.25rem 1.5rem', border: '1.5px solid #e2e8f0',
    borderRadius: '12px', textDecoration: 'none',
    background: '#fff', transition: 'border-color 0.15s ease',
    cursor: 'pointer'
  } as React.CSSProperties,
  icono: {
    width: '48px', height: '48px', borderRadius: '12px',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '1.5rem',
    flexShrink: 0
  } as React.CSSProperties,
  tarjetaTitulo: {
    fontSize: '1rem', fontWeight: '600',
    color: '#1e293b', marginBottom: '4px'
  } as React.CSSProperties,
  tarjetaDesc: {
    fontSize: '0.875rem', color: '#64748b'
  } as React.CSSProperties,
  footer: {
    textAlign: 'center' as const, marginTop: '3rem'
  } as React.CSSProperties,
  footerText: {
    fontSize: '0.75rem', color: '#94a3b8'
  } as React.CSSProperties,
}