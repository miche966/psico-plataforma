'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import { getBaseUrl } from '@/lib/utils'

interface Pregunta {
  id: string
  orden: number
  pregunta: string
  tiempo_preparacion: number
  tiempo_respuesta: number
}

interface Entrevista {
  id: string
  nombre: string
  tiempo_respuesta: number
}

export default function CrearPreguntasPage() {
  const [entrevista, setEntrevista] = useState<Entrevista | null>(null)
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [cargando, setCargando] = useState(true)
  const [nuevaPregunta, setNuevaPregunta] = useState('')
  const [tiempoPrep, setTiempoPrep] = useState('30')
  const [tiempoResp, setTiempoResp] = useState('60')
  const [perfilCandidato, setPerfilCandidato] = useState<'con_experiencia' | 'sin_experiencia'>('con_experiencia')
  const [vistaActiva, setVistaActiva] = useState<'arbol' | 'lista'>('arbol')
  const [guardando, setGuardando] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const entrevistaId = searchParams.get('id')

  const [nombreNuevaEntrevista, setNombreNuevaEntrevista] = useState('')
  const [editandoPreguntaId, setEditandoPreguntaId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    if (entrevistaId) {
      cargarDatos()
    } else {
      setCargando(false)
    }
  }, [entrevistaId])

  async function cargarDatos() {
    const { data: entrevistaData } = await supabase
      .from('entrevistas_video')
      .select('*')
      .eq('id', entrevistaId)
      .single()
    setEntrevista(entrevistaData)
    if (entrevistaData) setNombreNuevaEntrevista(entrevistaData.nombre)

    const { data: preguntasData } = await supabase
      .from('preguntas_video')
      .select('*')
      .eq('entrevista_id', entrevistaId)
      .order('orden')
    setPreguntas(preguntasData || [])
    setCargando(false)
  }

  async function crearEntrevista() {
    if (!nombreNuevaEntrevista.trim()) return
    setGuardando(true)
    const { data, error } = await supabase
      .from('entrevistas_video')
      .insert({ nombre: nombreNuevaEntrevista.trim() })
      .select()
      .single()
    
    if (!error && data) {
      router.push(`/entrevista-video/crear?id=${data.id}`)
    }
    setGuardando(false)
  }

  async function actualizarNombreEntrevista() {
    if (!entrevistaId || !nombreNuevaEntrevista.trim()) return
    setGuardando(true)
    await supabase
      .from('entrevistas_video')
      .update({ nombre: nombreNuevaEntrevista.trim() })
      .eq('id', entrevistaId)
    setEntrevista(prev => prev ? { ...prev, nombre: nombreNuevaEntrevista.trim() } : null)
    setGuardando(false)
    alert('Nombre actualizado')
  }

  async function guardarPregunta() {
    if (!nuevaPregunta.trim() || !entrevistaId) return
    setGuardando(true)

    let textoFinal = nuevaPregunta.trim()
    // Limpiar prefijos previos para evitar duplicaciones
    textoFinal = textoFinal.replace(/^\[CON_EXP\]\s*|^\[SIN_EXP\]\s*|^\[GENERAL\]\s*/i, '')

    if (perfilCandidato === 'con_experiencia') {
      textoFinal = `[CON_EXP] ${textoFinal}`
    } else {
      textoFinal = `[SIN_EXP] ${textoFinal}`
    }

    if (editandoPreguntaId) {
      // Actualizar existente
      await supabase.from('preguntas_video')
        .update({
          pregunta: textoFinal,
          tiempo_preparacion: parseInt(tiempoPrep),
          tiempo_respuesta: parseInt(tiempoResp)
        })
        .eq('id', editandoPreguntaId)
      setEditandoPreguntaId(null)
    } else {
      // Insertar nueva
      await supabase.from('preguntas_video').insert({
        entrevista_id: entrevistaId,
        orden: preguntas.length + 1,
        pregunta: textoFinal,
        tiempo_preparacion: parseInt(tiempoPrep),
        tiempo_respuesta: parseInt(tiempoResp)
      })
    }

    setNuevaPregunta('')
    setTiempoPrep('30')
    setTiempoResp('60')
    setPerfilCandidato('con_experiencia')
    cargarDatos()
    setGuardando(false)
  }

  async function eliminarPregunta(id: string) {
    if (!confirm('¿Eliminar esta pregunta?')) return
    await supabase.from('preguntas_video').delete().eq('id', id)
    cargarDatos()
  }

  function iniciarEdicion(p: Pregunta) {
    const txt = p.pregunta || ''
    let perfil: 'con_experiencia' | 'sin_experiencia' = 'con_experiencia'
    let textoLimpio = txt

    if (txt.startsWith('[CON_EXP]')) {
      perfil = 'con_experiencia'
      textoLimpio = txt.replace(/^\[CON_EXP\]\s*/, '')
    } else if (txt.startsWith('[SIN_EXP]')) {
      perfil = 'sin_experiencia'
      textoLimpio = txt.replace(/^\[SIN_EXP\]\s*/, '')
    } else if (txt.startsWith('[GENERAL]')) {
      perfil = 'con_experiencia'
      textoLimpio = txt.replace(/^\[GENERAL\]\s*/, '')
    }

    setEditandoPreguntaId(p.id)
    setNuevaPregunta(textoLimpio)
    setTiempoPrep(p.tiempo_preparacion.toString())
    setTiempoResp(p.tiempo_respuesta.toString())
    setPerfilCandidato(perfil)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function copiarLink(candidatoId?: string) {
    const base = `${getBaseUrl()}/entrevista-video/responder?entrevista=${entrevistaId}`
    const url = candidatoId ? `${base}&candidato=${candidatoId}` : base
    navigator.clipboard.writeText(url)
    setLinkCopiado('copiado')
    setTimeout(() => setLinkCopiado(null), 2000)
  }

  if (cargando) return <div style={s.centro}><p>Cargando...</p></div>

  if (!entrevistaId) {
    return (
      <div style={s.contenedor}>
        <div style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}>
          <a href="/entrevista-video" style={s.volver}>← Volver</a>
          <h1 style={{ ...s.titulo, marginBottom: '20px' }}>Nueva Entrevista en Video</h1>
          <div style={s.formulario}>
            <div style={s.campo}>
              <label style={s.label}>Nombre de la entrevista *</label>
              <input 
                style={s.input} 
                placeholder="Ej: Entrevista técnica Senior Dev"
                value={nombreNuevaEntrevista}
                onChange={e => setNombreNuevaEntrevista(e.target.value)}
              />
            </div>
            <button
              style={{ ...s.botonPrimario, width: '100%', marginTop: '10px' }}
              onClick={crearEntrevista}
              disabled={guardando || !nombreNuevaEntrevista.trim()}
            >
              {guardando ? 'Creando...' : 'Comenzar a configurar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.contenedor}>
      <div style={s.encabezado}>
        <div>
          <a href="/entrevista-video" style={s.volver}>← Volver a entrevistas</a>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              style={{ ...s.titulo, border: 'none', background: 'none', borderBottom: '1px dashed #cbd5e1', outline: 'none', padding: '2px 0' }}
              value={nombreNuevaEntrevista}
              onChange={e => setNombreNuevaEntrevista(e.target.value)}
              onBlur={actualizarNombreEntrevista}
            />
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>(clic para renombrar)</span>
          </div>
          <p style={s.subtitulo}>{preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''} configurada{preguntas.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          style={{ ...s.botonPrimario, background: linkCopiado ? '#16a34a' : '#2563eb' }}
          onClick={() => copiarLink()}
        >
          {linkCopiado ? '✓ Link copiado' : 'Copiar link de entrevista'}
        </button>
      </div>

      <div style={{ ...s.grid, gridTemplateColumns: '1.25fr 0.75fr' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={s.seccionTitulo}>Estructura de la Videoentrevista</div>
            <div style={s.pestanas}>
              <button 
                style={{ ...s.botonPestana, ...(vistaActiva === 'arbol' ? s.botonPestanaActiva : {}) }}
                onClick={() => setVistaActiva('arbol')}
              >
                🌿 Vista de Árbol
              </button>
              <button 
                style={{ ...s.botonPestana, ...(vistaActiva === 'lista' ? s.botonPestanaActiva : {}) }}
                onClick={() => setVistaActiva('lista')}
              >
                📋 Vista de Lista
              </button>
            </div>
          </div>

          {preguntas.length === 0 ? (
            <div style={s.vacio}>
              <p>No hay preguntas todavía.</p>
              <p>Agregá la primera desde el formulario de la derecha para ver el mapa de ramificación.</p>
            </div>
          ) : vistaActiva === 'arbol' ? (
            <div style={s.arbolContenedor}>
              {/* Nodo Raíz */}
              <div style={s.arbolNodoRaiz}>
                <div style={s.arbolNodoRaizTitulo}>Vídeo Entrevista</div>
                <div style={s.arbolNodoRaizSub}>{entrevista?.nombre}</div>
              </div>

              {/* Bifurcación horizontal */}
              <div style={s.arbolBifurcacionLineas}>
                <div style={s.arbolLineaIzquierda} />
                <div style={s.arbolLineaVerticalCentral} />
                <div style={s.arbolLineaDerecha} />
              </div>

              {/* Columnas Ramificadas */}
              <div style={s.arbolColumnas}>
                {/* Rama Con Experiencia */}
                <div style={s.arbolColumna}>
                  <div style={{ ...s.arbolColumnaHeader, borderBottom: '2px solid #2563eb', color: '#1e40af', background: '#eff6ff' }}>
                    💼 Con Experiencia Laboral (Formal / Informal)
                  </div>
                  <div style={s.arbolColumnaPreguntas}>
                    {preguntas.filter(p => (p.pregunta || '').startsWith('[CON_EXP]')).length === 0 ? (
                      <div style={s.arbolColumnaVacia}>Sin preguntas configuradas</div>
                    ) : (
                      preguntas.filter(p => (p.pregunta || '').startsWith('[CON_EXP]')).map((p, index) => {
                        const esEditando = editandoPreguntaId === p.id
                        const textoLimpio = p.pregunta.replace(/^\[CON_EXP\]\s*/i, '')
                        return (
                          <div 
                            key={p.id} 
                            style={{ 
                              ...s.arbolPreguntaCard, 
                              borderLeft: '3px solid #2563eb',
                              borderTop: esEditando ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              borderRight: esEditando ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              borderBottom: esEditando ? '2px solid #2563eb' : '1px solid #e2e8f0'
                            }} 
                            onClick={() => iniciarEdicion(p)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                              <div style={s.arbolPreguntaNum}>P{index + 1}</div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button style={s.arbolBotonMini} onClick={(e) => { e.stopPropagation(); eliminarPregunta(p.id); }} title="Eliminar">✕</button>
                              </div>
                            </div>
                            <div style={s.arbolPreguntaTexto}>{textoLimpio}</div>
                            <div style={s.arbolPreguntaMeta}>⏱ {p.tiempo_preparacion}s prep / {p.tiempo_respuesta}s resp</div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Rama Sin Experiencia */}
                <div style={s.arbolColumna}>
                  <div style={{ ...s.arbolColumnaHeader, borderBottom: '2px solid #0e7490', color: '#0e7490', background: '#ecfeff' }}>
                    🎓 Sin Experiencia Laboral previa
                  </div>
                  <div style={s.arbolColumnaPreguntas}>
                    {preguntas.filter(p => (p.pregunta || '').startsWith('[SIN_EXP]')).length === 0 ? (
                      <div style={s.arbolColumnaVacia}>Sin preguntas configuradas</div>
                    ) : (
                      preguntas.filter(p => (p.pregunta || '').startsWith('[SIN_EXP]')).map((p, index) => {
                        const esEditando = editandoPreguntaId === p.id
                        const textoLimpio = p.pregunta.replace(/^\[SIN_EXP\]\s*/i, '')
                        return (
                          <div 
                            key={p.id} 
                            style={{ 
                              ...s.arbolPreguntaCard, 
                              borderLeft: '3px solid #0e7490',
                              borderTop: esEditando ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              borderRight: esEditando ? '2px solid #2563eb' : '1px solid #e2e8f0',
                              borderBottom: esEditando ? '2px solid #2563eb' : '1px solid #e2e8f0'
                            }} 
                            onClick={() => iniciarEdicion(p)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
                              <div style={s.arbolPreguntaNum}>P{index + 1}</div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button style={s.arbolBotonMini} onClick={(e) => { e.stopPropagation(); eliminarPregunta(p.id); }} title="Eliminar">✕</button>
                              </div>
                            </div>
                            <div style={s.arbolPreguntaTexto}>{textoLimpio}</div>
                            <div style={s.arbolPreguntaMeta}>⏱ {p.tiempo_preparacion}s prep / {p.tiempo_respuesta}s resp</div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={s.listaPreguntas}>
               {preguntas.map((pregunta, index) => {
                 const txt = pregunta.pregunta || ''
                 const esConExp = txt.startsWith('[CON_EXP]')
                 const esSinExp = txt.startsWith('[SIN_EXP]')
                 const textoLimpio = txt.replace(/^\[CON_EXP\]\s*|^\[SIN_EXP\]\s*|^\[GENERAL\]\s*/i, '')

                 return (
                   <div key={pregunta.id} style={{ ...s.preguntaCard, border: editandoPreguntaId === pregunta.id ? '1px solid #2563eb' : '1px solid #e2e8f0' }}>
                     <div style={s.preguntaNum}>{index + 1}</div>
                     <div style={s.preguntaContenido}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                         <span style={{
                           fontSize: '8px',
                           fontWeight: 'bold',
                           padding: '2px 8px',
                           borderRadius: '99px',
                           background: esConExp ? '#eff6ff' : esSinExp ? '#ecfeff' : '#f1f5f9',
                           color: esConExp ? '#1e40af' : esSinExp ? '#0e7490' : '#475569',
                           border: esConExp ? '1px solid #bfdbfe' : esSinExp ? '1px solid #c5f2f7' : '1px solid #e2e8f0',
                           textTransform: 'uppercase'
                         }}>
                           {esConExp ? '💼 Con Experiencia' : esSinExp ? '🎓 Sin Experiencia' : '📋 General'}
                         </span>
                       </div>
                       <div style={s.preguntaTexto}>{textoLimpio}</div>
                       <div style={s.preguntaMeta}>
                         Preparación: {pregunta.tiempo_preparacion}s · Respuesta: {pregunta.tiempo_respuesta}s
                       </div>
                     </div>
                     <div style={{ display: 'flex', gap: '8px' }}>
                       <button
                         style={{ ...s.botonEliminar, color: '#64748b' }}
                         onClick={() => iniciarEdicion(pregunta)}
                         title="Editar pregunta"
                       >
                         ✎
                       </button>
                       <button
                         style={s.botonEliminar}
                         onClick={() => eliminarPregunta(pregunta.id)}
                         title="Eliminar pregunta"
                       >
                         ✕
                       </button>
                     </div>
                   </div>
                 )
               })}
            </div>
          )}
        </div>

        <div>
          <div style={s.seccionTitulo}>{editandoPreguntaId ? 'Editando pregunta' : 'Agregar pregunta'}</div>
          <div style={s.formulario}>
            <div style={s.campo}>
              <label style={s.label}>Pregunta *</label>
              <textarea
                style={{ ...s.input, minHeight: '100px', resize: 'vertical' as const }}
                value={nuevaPregunta}
                onChange={e => setNuevaPregunta(e.target.value)}
                placeholder="Ej: Contanos sobre tu experiencia en atención al cliente..."
              />
            </div>
            <div style={s.campo}>
              <label style={s.label}>Perfil del Candidato (Ramificación) *</label>
              <select style={s.input} value={perfilCandidato} onChange={e => setPerfilCandidato(e.target.value as any)}>
                <option value="con_experiencia">💼 Con Experiencia Laboral</option>
                <option value="sin_experiencia">🎓 Sin Experiencia Laboral</option>
              </select>
            </div>
            <div style={s.dosCols}>
              <div style={s.campo}>
                <label style={s.label}>Tiempo de preparación</label>
                <select style={s.input} value={tiempoPrep} onChange={e => setTiempoPrep(e.target.value)}>
                  <option value="15">15 segundos</option>
                  <option value="30">30 segundos</option>
                  <option value="60">1 minuto</option>
                </select>
              </div>
              <div style={s.campo}>
                <label style={s.label}>Tiempo de respuesta</label>
                <select style={s.input} value={tiempoResp} onChange={e => setTiempoResp(e.target.value)}>
                  <option value="30">30 segundos</option>
                  <option value="60">1 minuto</option>
                  <option value="90">1 min 30 seg</option>
                  <option value="120">2 minutos</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {editandoPreguntaId && (
                <button
                  style={{ ...s.botonPrimario, background: '#f1f5f9', color: '#475569', flex: 1 }}
                  onClick={() => { setEditandoPreguntaId(null); setNuevaPregunta(''); }}
                >
                  Cancelar
                </button>
              )}
              <button
                style={{ ...s.botonPrimario, flex: 2, opacity: guardando ? 0.7 : 1 }}
                onClick={guardarPregunta}
                disabled={guardando || !nuevaPregunta.trim()}
              >
                {guardando ? 'Guardando...' : editandoPreguntaId ? 'Actualizar pregunta' : '+ Agregar pregunta'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <div style={s.seccionTitulo}>Vista previa del link</div>
            <div style={s.linkBox}>
              <div style={s.linkTexto}>
                {`${getBaseUrl()}/entrevista-video/responder?entrevista=${entrevistaId}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  pestanas: { display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' } as React.CSSProperties,
  botonPestana: { padding: '4px 10px', fontSize: '11px', background: 'none', border: 'none', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontWeight: '500' } as React.CSSProperties,
  botonPestanaActiva: { background: '#fff', color: '#1e293b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } as React.CSSProperties,
  
  arbolContenedor: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' as const } as React.CSSProperties,
  arbolNodoRaiz: { background: '#1e293b', color: '#fff', padding: '10px 16px', borderRadius: '12px', display: 'inline-block', minWidth: '180px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' } as React.CSSProperties,
  arbolNodoRaizTitulo: { fontSize: '9px', textTransform: 'uppercase' as const, fontWeight: '700', letterSpacing: '0.05em', color: '#94a3b8', marginBottom: '2px' } as React.CSSProperties,
  arbolNodoRaizSub: { fontSize: '12px', fontWeight: '600' } as React.CSSProperties,

  arbolBifurcacionLineas: { position: 'relative' as const, height: '24px', margin: '0 auto', width: '60%' } as React.CSSProperties,
  arbolLineaVerticalCentral: { position: 'absolute' as const, top: 0, left: '50%', width: '2px', height: '10px', background: '#cbd5e1', transform: 'translateX(-50%)' } as React.CSSProperties,
  arbolLineaIzquierda: { position: 'absolute' as const, top: '10px', left: 0, right: '50%', height: '2px', background: '#cbd5e1', borderTopLeftRadius: '2px' } as React.CSSProperties,
  arbolLineaDerecha: { position: 'absolute' as const, top: '10px', left: '50%', right: 0, height: '2px', background: '#cbd5e1', borderTopRightRadius: '2px' } as React.CSSProperties,

  arbolColumnas: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '0px' } as React.CSSProperties,
  arbolColumna: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' } as React.CSSProperties,
  arbolColumnaHeader: { padding: '8px 12px', fontSize: '11px', fontWeight: '700', textAlign: 'center' as const } as React.CSSProperties,
  arbolColumnaPreguntas: { padding: '10px', display: 'flex', flexDirection: 'column' as const, gap: '8px' } as React.CSSProperties,
  arbolColumnaVacia: { padding: '1.5rem', color: '#94a3b8', fontSize: '11px', fontStyle: 'italic' as const } as React.CSSProperties,

  arbolPreguntaCard: { background: '#fff', borderRadius: '8px', padding: '8px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' as const } as React.CSSProperties,
  arbolPreguntaCardComun: { background: '#fff', border: '1px solid #e2e8f0', borderTop: '3px solid #64748b', borderRadius: '8px', padding: '8px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' as const } as React.CSSProperties,
  arbolPreguntaNum: { display: 'inline-flex', padding: '1px 6px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '8px', fontWeight: '700', marginBottom: '4px' } as React.CSSProperties,
  arbolPreguntaTexto: { fontSize: '11px', color: '#1e293b', lineHeight: '1.4', marginBottom: '6px', fontWeight: '500' } as React.CSSProperties,
  arbolPreguntaMeta: { fontSize: '9px', color: '#94a3b8' } as React.CSSProperties,
  arbolBotonMini: { background: '#fee2e2', border: 'none', borderRadius: '4px', color: '#991b1b', cursor: 'pointer', width: '14px', height: '14px', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,

  arbolConectorComun: { position: 'relative' as const, height: '20px', width: '100%' } as React.CSSProperties,
  arbolLineaVerticalComun: { position: 'absolute' as const, top: 0, bottom: 0, left: '50%', width: '2px', background: '#cbd5e1', transform: 'translateX(-50%)' } as React.CSSProperties,

  arbolNodoComun: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', maxWidth: '480px', margin: '0 auto', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' } as React.CSSProperties,
  arbolNodoComunHeader: { fontSize: '11px', fontWeight: '700', color: '#475569', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '8px', textAlign: 'center' as const } as React.CSSProperties,
  arbolNodoComunPreguntas: { display: 'flex', flexDirection: 'column' as const, gap: '8px' } as React.CSSProperties,

  centro: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' } as React.CSSProperties,
  contenedor: { maxWidth: '1200px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' } as React.CSSProperties,
  encabezado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' } as React.CSSProperties,
  volver: { fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', display: 'block', marginBottom: '0.5rem' } as React.CSSProperties,
  titulo: { fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 4px' } as React.CSSProperties,
  subtitulo: { fontSize: '0.875rem', color: '#64748b', margin: 0 } as React.CSSProperties,
  botonPrimario: { padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', cursor: 'pointer' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' } as React.CSSProperties,
  seccionTitulo: { fontSize: '11px', fontWeight: '500', textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.75rem' } as React.CSSProperties,
  vacio: { textAlign: 'center' as const, padding: '2rem', color: '#64748b', fontSize: '0.875rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' } as React.CSSProperties,
  listaPreguntas: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' } as React.CSSProperties,
  preguntaCard: { display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.875rem' } as React.CSSProperties,
  preguntaNum: { display: 'inline-flex', width: '24px', height: '24px', borderRadius: '50%', background: '#E6F1FB', color: '#0C447C', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', flexShrink: 0 } as React.CSSProperties,
  preguntaContenido: { flex: 1 } as React.CSSProperties,
  preguntaTexto: { fontSize: '0.875rem', color: '#1e293b', lineHeight: '1.5', marginBottom: '4px' } as React.CSSProperties,
  preguntaMeta: { fontSize: '11px', color: '#94a3b8' } as React.CSSProperties,
  botonEliminar: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px', flexShrink: 0 } as React.CSSProperties,
  formulario: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' } as React.CSSProperties,
  campo: { display: 'flex', flexDirection: 'column' as const, gap: '4px', marginBottom: '0.75rem' } as React.CSSProperties,
  label: { fontSize: '0.75rem', fontWeight: '500', color: '#475569' } as React.CSSProperties,
  input: { padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: '#fff', outline: 'none', width: '100%' } as React.CSSProperties,
  dosCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } as React.CSSProperties,
  linkBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.875rem' } as React.CSSProperties,
  linkTexto: { fontSize: '11px', fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all' as const, marginBottom: '6px' } as React.CSSProperties,
  linkNota: { fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' } as React.CSSProperties,
}