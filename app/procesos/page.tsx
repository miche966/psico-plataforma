'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Proceso {
  id: string
  nombre: string
  cargo: string
  descripcion: string
  activo: boolean
  creado_en: string
  total_candidatos?: number
}

interface Candidato {
  id: string
  nombre: string
  apellido: string
  email: string
}

export default function ProcesosPage() {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [procesoSeleccionado, setProcesoSeleccionado] = useState<Proceso | null>(null)
  const [candidatosProceso, setCandidatosProceso] = useState<Candidato[]>([])
  const [form, setForm] = useState({ nombre: '', cargo: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [agregando, setAgregando] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: procesosData } = await supabase
      .from('procesos')
      .select('*')
      .order('creado_en', { ascending: false })

    const { data: candidatosData } = await supabase
      .from('candidatos')
      .select('id, nombre, apellido, email')
      .order('creado_en', { ascending: false })

    setProcesos(procesosData || [])
    setCandidatos(candidatosData || [])
    setCargando(false)
  }

  async function guardarProceso() {
    if (!form.nombre || !form.cargo) return
    setGuardando(true)

    const { error } = await supabase
      .from('procesos')
      .insert({
        nombre: form.nombre,
        cargo: form.cargo,
        descripcion: form.descripcion,
        activo: true
      })

    if (!error) {
      setForm({ nombre: '', cargo: '', descripcion: '' })
      setMostrarForm(false)
      cargarDatos()
    }
    setGuardando(false)
  }

  async function verCandidatosProceso(proceso: Proceso) {
    setProcesoSeleccionado(proceso)

    const { data: sesiones } = await supabase
      .from('sesiones')
      .select('candidato_id')
      .eq('proceso_id', proceso.id)
      .not('candidato_id', 'is', null)

    const ids = sesiones?.map(s => s.candidato_id) || []

    if (ids.length > 0) {
      const { data } = await supabase
        .from('candidatos')
        .select('id, nombre, apellido, email')
        .in('id', ids)
      setCandidatosProceso(data || [])
    } else {
      setCandidatosProceso([])
    }
  }

  function copiarLink(procesoId: string, candidatoId: string) {
    const link = `${window.location.origin}/test?candidato=${candidatoId}&proceso=${procesoId}`
    navigator.clipboard.writeText(link)
  }

  async function asignarCandidato(candidatoId: string) {
    if (!procesoSeleccionado) return
    setAgregando(candidatoId)

    const link = `${window.location.origin}/test?candidato=${candidatoId}&proceso=${procesoSeleccionado.id}`
    navigator.clipboard.writeText(link)

    const ya = candidatosProceso.find(c => c.id === candidatoId)
    if (!ya) {
      const candidato = candidatos.find(c => c.id === candidatoId)
      if (candidato) setCandidatosProceso(prev => [...prev, candidato])
    }

    setTimeout(() => setAgregando(''), 1500)
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
  }

  if (cargando) return <div style={s.centro}><p>Cargando procesos...</p></div>

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <h1 style={s.titulo}>Procesos de selección</h1>
          <p style={s.subtitulo}>{procesos.length} proceso{procesos.length !== 1 ? 's' : ''} registrado{procesos.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/panel" style={s.botonSecundario}>← Panel</a>
          <button style={s.botonPrimario} onClick={() => setMostrarForm(!mostrarForm)}>
            {mostrarForm ? 'Cancelar' : '+ Nuevo proceso'}
          </button>
        </div>
      </div>

      {mostrarForm && (
        <div style={s.formulario}>
          <h2 style={s.formTitulo}>Nuevo proceso de selección</h2>
          <div style={s.formGrid}>
            <div style={s.campo}>
              <label style={s.label}>Nombre del proceso *</label>
              <input
                style={s.input}
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Selección Analistas Q2 2026"
              />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Cargo *</label>
              <input
                style={s.input}
                value={form.cargo}
                onChange={e => setForm({ ...form, cargo: e.target.value })}
                placeholder="Ej: Analista de Crédito"
              />
            </div>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Descripción</label>
            <input
              style={s.input}
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción opcional del proceso"
            />
          </div>
          <button
            style={{ ...s.botonPrimario, marginTop: '0.75rem', opacity: guardando ? 0.7 : 1 }}
            onClick={guardarProceso}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar proceso'}
          </button>
        </div>
      )}

      <div style={s.grid}>
        <div style={s.listaProcesos}>
          {procesos.length === 0 ? (
            <div style={s.vacio}>
              <p>No hay procesos todavía.</p>
              <p>Creá el primero con el botón de arriba.</p>
            </div>
          ) : (
            procesos.map(proceso => (
              <div
                key={proceso.id}
                style={{
                  ...s.tarjetaProceso,
                  borderColor: procesoSeleccionado?.id === proceso.id ? '#2563eb' : '#e2e8f0'
                }}
                onClick={() => verCandidatosProceso(proceso)}
              >
                <div style={s.tarjetaEncabezado}>
                  <div>
                    <div style={s.tarjetaNombre}>{proceso.nombre}</div>
                    <div style={s.tarjetaCargo}>{proceso.cargo}</div>
                  </div>
                  <div style={{
                    ...s.estadoBadge,
                    background: proceso.activo ? '#dcfce7' : '#f1f5f9',
                    color: proceso.activo ? '#16a34a' : '#64748b'
                  }}>
                    {proceso.activo ? 'Activo' : 'Cerrado'}
                  </div>
                </div>
                {proceso.descripcion && (
                  <p style={s.tarjetaDesc}>{proceso.descripcion}</p>
                )}
                <p style={s.tarjetaFecha}>Creado: {formatearFecha(proceso.creado_en)}</p>
              </div>
            ))
          )}
        </div>

        {procesoSeleccionado && (
          <div style={s.detalleProceso}>
            <h2 style={s.detalleTitulo}>{procesoSeleccionado.nombre}</h2>
            <p style={s.detalleCargo}>{procesoSeleccionado.cargo}</p>

            <div style={s.seccion}>
              <div style={s.seccionTitulo}>Asignar candidato</div>
              <p style={s.seccionDesc}>Seleccioná un candidato para copiar su link de evaluación con este proceso.</p>
              <div style={s.listaCandidatos}>
                {candidatos.map(candidato => (
                  <div key={candidato.id} style={s.candidatoRow}>
                    <div>
                      <div style={s.candidatoNombre}>{candidato.nombre} {candidato.apellido}</div>
                      <div style={s.candidatoEmail}>{candidato.email}</div>
                    </div>
                    <button
                      style={{
                        ...s.botonAsignar,
                        background: agregando === candidato.id ? '#16a34a' : '#2563eb'
                      }}
                      onClick={() => asignarCandidato(candidato.id)}
                    >
                      {agregando === candidato.id ? '✓ Copiado' : 'Copiar link'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {candidatosProceso.length > 0 && (
              <div style={s.seccion}>
                <div style={s.seccionTitulo}>Candidatos evaluados en este proceso</div>
                {candidatosProceso.map(c => (
                  <div key={c.id} style={s.candidatoEvaluado}>
                    <span style={s.candidatoNombre}>{c.nombre} {c.apellido}</span>
                    <a href="/panel" style={s.verResultados}>Ver resultados</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '1100px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' } as React.CSSProperties,
  subtitulo: { fontSize: '0.875rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  botonPrimario: { padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer' } as React.CSSProperties,
  botonSecundario: { padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', textDecoration: 'none' } as React.CSSProperties,
  formulario: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' } as React.CSSProperties,
  formTitulo: { fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: '0 0 1rem' } as React.CSSProperties,
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' } as React.CSSProperties,
  campo: { display: 'flex', flexDirection: 'column' as const, gap: '4px', marginBottom: '0.75rem' } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: '500', color: '#475569' } as React.CSSProperties,
  input: { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: '#fff', outline: 'none' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' } as React.CSSProperties,
  listaProcesos: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  vacio: { textAlign: 'center' as const, padding: '3rem', color: '#64748b', fontSize: '0.875rem' } as React.CSSProperties,
  tarjetaProceso: { border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', cursor: 'pointer', background: '#fff', transition: 'border-color 0.15s' } as React.CSSProperties,
  tarjetaEncabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' } as React.CSSProperties,
  tarjetaNombre: { fontSize: '0.875rem', fontWeight: '600', color: '#1e293b' } as React.CSSProperties,
  tarjetaCargo: { fontSize: '0.75rem', color: '#2563eb', marginTop: '2px' } as React.CSSProperties,
  tarjetaDesc: { fontSize: '0.75rem', color: '#64748b', margin: '4px 0' } as React.CSSProperties,
  tarjetaFecha: { fontSize: '0.75rem', color: '#94a3b8', margin: 0 } as React.CSSProperties,
  estadoBadge: { fontSize: '10px', padding: '2px 8px', borderRadius: '99px', fontWeight: '500', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  detalleProceso: { border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', background: '#fff', alignSelf: 'flex-start' as const, position: 'sticky' as const, top: '1rem' } as React.CSSProperties,
  detalleTitulo: { fontSize: '1rem', fontWeight: '600', color: '#1e293b', margin: '0 0 2px' } as React.CSSProperties,
  detalleCargo: { fontSize: '0.875rem', color: '#2563eb', margin: '0 0 1.25rem' } as React.CSSProperties,
  seccion: { marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' } as React.CSSProperties,
  seccionTitulo: { fontSize: '0.75rem', fontWeight: '600', color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: '0.5rem' } as React.CSSProperties,
  seccionDesc: { fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' } as React.CSSProperties,
  listaCandidatos: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' as const } as React.CSSProperties,
  candidatoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' } as React.CSSProperties,
  candidatoNombre: { fontSize: '0.875rem', color: '#1e293b', fontWeight: '500' } as React.CSSProperties,
  candidatoEmail: { fontSize: '0.75rem', color: '#94a3b8' } as React.CSSProperties,
  botonAsignar: { padding: '0.375rem 0.75rem', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', transition: 'background 0.2s', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  candidatoEvaluado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' } as React.CSSProperties,
  verResultados: { fontSize: '0.75rem', color: '#2563eb', textDecoration: 'none' } as React.CSSProperties,
}