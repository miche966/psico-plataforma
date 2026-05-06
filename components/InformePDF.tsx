import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Registrar fuentes si fuera necesario, usando fuentes estándar por ahora para evitar problemas de red
// Font.register({ family: 'Inter', src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff' });
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: {
    backgroundColor: '#0f172a',
    margin: -40,
    marginBottom: 30,
    padding: 30,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  headerSubtitle: { color: '#94a3b8', fontSize: 8, marginTop: 4, textTransform: 'uppercase' },
  headerDate: { color: 'white', fontSize: 9 },
  
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    padding: 6,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
    marginBottom: 12,
    marginTop: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15 },
  infoItem: { width: '33.33%', marginBottom: 12 },
  infoLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' },
  infoValue: { fontSize: 10, color: '#1e293b', fontWeight: 'bold' },
  
  textBlock: { fontSize: 9.5, lineHeight: 1.6, color: '#334155', marginBottom: 12, textAlign: 'justify' },
  
  aiSection: {
    backgroundColor: '#f5f3ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    marginTop: 10,
    marginBottom: 20
  },
  aiTitle: { fontSize: 9, fontWeight: 'bold', color: '#7c3aed', marginBottom: 6, textTransform: 'uppercase', flexDirection: 'row', alignItems: 'center' },
  aiText: { fontSize: 9, color: '#4c1d95', lineHeight: 1.5, fontStyle: 'italic' },

  factorBlock: { marginBottom: 10 },
  factorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  factorName: { fontSize: 10, fontWeight: 'bold', color: '#1e293b' },
  factorValue: { fontSize: 9, color: '#2563eb', fontWeight: 'bold' },
  barBg: { height: 5, backgroundColor: '#f1f5f9', borderRadius: 2, marginBottom: 3 },
  barFill: { height: 5, borderRadius: 2, backgroundColor: '#2563eb' },
  factorDesc: { fontSize: 8.5, color: '#64748b', lineHeight: 1.4, marginBottom: 5 },
  
  commentBox: { backgroundColor: '#f8fafc', padding: 10, borderLeftWidth: 2, borderLeftColor: '#cbd5e1', marginTop: 8, marginBottom: 12 },
  commentLabel: { fontSize: 7, fontWeight: 'bold', color: '#64748b', marginBottom: 3, textTransform: 'uppercase' },
  commentText: { fontSize: 9, color: '#334155', lineHeight: 1.4 },
  
  recomendacionBox: {
    marginTop: 25,
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    width: '100%'
  },
  recomendacionText: { color: 'white', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  
  section: { marginBottom: 20 },
  
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerText: { fontSize: 7, color: '#94a3b8' }
});

const ETQ: Record<string, string> = {
  // Personalidad
  extraversion: 'Extraversión', amabilidad: 'Amabilidad', responsabilidad: 'Responsabilidad',
  neuroticismo: 'Estabilidad Emocional', apertura: 'Apertura a la Experiencia',
  honestidad_humildad: 'Honestidad y Humildad',
  
  // Cognitivo y Atención
  correctas: 'Efectividad Cognitiva',
  percentil: 'Rango Comparativo (Percentil)',
  score: 'Puntuación Global',
  documentos: 'Gestión Documental',
  comparacion: 'Velocidad de Procesamiento',
  concentracion: 'Nivel de Foco y Concentración',
  errores_texto: 'Precisión en Datos de Texto',
  errores_numeros: 'Precisión en Datos Numéricos',
  metricas_fraude: 'Índice de Sinceridad Laboral',

  // Competencias Profesionales (SJT)
  etica: 'Ética y Valores Profesionales',
  negociacion: 'Capacidad de Negociación',
  manejo_emocional: 'Inteligencia Emocional Aplicada',
  tolerancia_frustracion: 'Tolerancia a la Presión',
  comunicacion: 'Comunicación Efectiva',
  
  // Salud y Bienestar Laboral
  burnout: 'Nivel de Riesgo (Burnout)',
  equilibrio: 'Balance Vida-Trabajo',
  relaciones: 'Relaciones Interpersonales y Clima',
  claridad_rol: 'Percepción de Claridad de Rol',
  nivel_estres: 'Indicador de Tensión Psicológica',
  carga_laboral: 'Gestión de la Demanda de Trabajo',
};

const DOMINIOS = {
  PERSONALIDAD: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad'],
  COGNITIVO: ['correctas', 'percentil', 'score', 'documentos', 'comparacion', 'concentracion', 'errores_texto', 'errores_numeros', 'metricas_fraude'],
  COMPETENCIAS: ['etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion', 'comunicacion'],
  BIENESTAR: ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'nivel_estres', 'carga_laboral']
}

const REC_COLORS = {
  recomendado: '#059669',
  con_reservas: '#d97706',
  no_recomendado: '#dc2626'
};

const REC_LABELS = {
  recomendado: 'Candidato Recomendado',
  con_reservas: 'Recomendado con Reservas',
  no_recomendado: 'No Recomendado para el cargo'
};

export const InformePDF = ({ data }: any) => {
  const { candidato, proceso, sesiones, videos, inf, helpers } = data;
  const { sesBF, sesHX, sesCog, sesComp } = helpers;

  return (
    <Document title={`Informe - ${candidato.nombre} ${candidato.apellido}`}>
      <Page size="A4" style={styles.page}>
        {/* Encabezado Premium */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>PSICO-PLATAFORMA 2.0</Text>
            <Text style={styles.headerSubtitle}>Intelligence & Talent Analytics Report</Text>
          </View>
          <Text style={styles.headerDate}>{helpers.hoy()}</Text>
        </View>

        {/* Perfil del Candidato */}
        <View style={styles.infoGrid}>
          <View style={{ width: '100%', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>
              {candidato.nombre} {candidato.apellido}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Identificación</Text>
            <Text style={styles.infoValue}>{candidato.documento || 'No provisto'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Correo Electrónico</Text>
            <Text style={styles.infoValue}>{candidato.email}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>ID Referencia</Text>
            <Text style={styles.infoValue}>#{candidato.id.slice(0, 8)}</Text>
          </View>
          {proceso && (
            <>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Proceso de Selección</Text>
                <Text style={styles.infoValue}>{proceso.nombre}</Text>
              </View>
              <View style={{ width: '66.66%', marginBottom: 12 }}>
                <Text style={styles.infoLabel}>Posición Objetivo</Text>
                <Text style={styles.infoValue}>{proceso.cargo}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── SECCIÓN ESTRATÉGICA (I) ───────────────────────────────────────── */}
        <View style={{ marginBottom: 25 }}>
          <Text style={[styles.sectionTitle, { fontSize: 13, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }]}>I. Diagnóstico Estratégico y Ajuste al Perfil</Text>
          
          <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15, marginTop: 10 }}>
            <View style={{ width: '30%', backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: helpers.clrOf ? helpers.clrOf(inf.ajusteCargo?.score || 0, 100) : '#1e293b' }}>{inf.ajusteCargo?.score || 0}%</Text>
              <Text style={{ fontSize: 7, color: '#64748b', textAlign: 'center', marginTop: 4, textTransform: 'uppercase', fontWeight: 'bold' }}>Ajuste al Cargo</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 }}>Justificación del Ajuste al Perfil</Text>
              <Text style={{ fontSize: 8, color: '#475569', lineHeight: 1.4 }}>{inf.ajusteCargo?.analisis || 'Análisis estratégico pendiente de generación...'}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#16a34a', marginBottom: 8 }}>✦ Fortalezas Clave</Text>
              {(inf.fortalezas || []).length > 0 ? (inf.fortalezas || []).map((f: string, i: number) => (
                <Text key={i} style={{ fontSize: 8, color: '#14532d', marginBottom: 4 }}>• {f}</Text>
              )) : <Text style={{ fontSize: 8, color: '#64748b' }}>Pendiente de análisis...</Text>}
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff7ed', padding: 12, borderRadius: 8, border: '1px solid #ffedd5' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#ea580c', marginBottom: 8 }}>▲ Áreas de Desarrollo</Text>
              {(inf.oportunidadesMejora || []).length > 0 ? (inf.oportunidadesMejora || []).map((f: string, i: number) => (
                <Text key={i} style={{ fontSize: 8, color: '#7c2d12', marginBottom: 4 }}>• {f}</Text>
              )) : <Text style={{ fontSize: 8, color: '#64748b' }}>Pendiente de análisis...</Text>}
            </View>
          </View>

          {/* Sincronización Matriz Soft Skills en PDF */}
          <View style={{ marginTop: 15, backgroundColor: '#f5f3ff', padding: 12, borderRadius: 8, border: '1px solid #ddd6fe' }}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#7c3aed', marginBottom: 8, textTransform: 'uppercase' }}>✦ Matriz de Potencial Conductual (Soft Skills)</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: 'white', padding: 8, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 6, color: '#6d28d9', fontWeight: 'bold', marginBottom: 2 }}>LIDERAZGO</Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#7c3aed' }}>{inf.liderazgo}%</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'white', padding: 8, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 6, color: '#c2410c', fontWeight: 'bold', marginBottom: 2 }}>ADAPTABILIDAD</Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#ea580c' }}>{inf.adaptabilidad}%</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'white', padding: 8, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 6, color: '#991b1b', fontWeight: 'bold', marginBottom: 2 }}>RESILIENCIA</Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#dc2626' }}>{inf.resiliencia}%</Text>
              </View>
            </View>
            <Text style={{ fontSize: 6.5, color: '#6d28d9', marginTop: 6, fontStyle: 'italic', textAlign: 'center' }}>
              * Análisis integrativo basado en personalidad, competencias y evidencias conductuales.
            </Text>
          </View>
        </View>

        {/* Resumen Ejecutivo IA */}
        {inf.resumenEjecutivo && (
          <View style={{ marginBottom: 25 }}>
            <Text style={[styles.sectionTitle, { fontSize: 13, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }]}>Síntesis Ejecutiva e Integrativa</Text>
            <Text style={{ ...styles.textBlock, fontSize: 8.5, lineHeight: 1.5, marginTop: 10 }}>{inf.resumenEjecutivo}</Text>
          </View>
        )}

        {/* Insights de Entrevista Video (IA) */}
        {(videos || []).length > 0 && (
          <View style={[styles.aiSection, { marginBottom: 25 }]}>
            <Text style={styles.aiTitle}>✧ Insight de Comunicación & Actitud (Análisis IA)</Text>
            {videos.map((v: any, idx: number) => (
              <View key={idx} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#6d28d9' }}>Pregunta {idx + 1}:</Text>
                <Text style={styles.aiText}>"{v.transcripcion ? v.transcripcion.slice(0, 200) + '...' : 'Sin transcripción disponible.'}"</Text>
                {v.analisis_ia?.actitud && (
                  <Text style={{ fontSize: 8, color: '#7c3aed', marginTop: 2 }}>Observación: {v.analisis_ia.actitud}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── SECCIONES POR DOMINIOS ────────────────────────────────────────── */}
        
        {/* II. PERSONALIDAD Y CONDUCTA */}
        {(sesBF.length > 0 || sesHX.length > 0) && (
          <View style={[styles.section, { marginTop: 10 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 13, marginBottom: 15, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }]}>II. Perfil Conductual y Estilo de Personalidad</Text>
            {sesBF.concat(sesHX).map((sesion: any) => {
              const entries = helpers.numEntries(sesion.puntaje_bruto);
              if (entries.length === 0) return null;
              return (
                <View key={sesion.id} style={{ marginBottom: 10 }}>
                  {entries.map(([factor, valor]: any) => {
                    let numVal = Number(typeof valor === 'object' ? valor.correctas || valor.score : valor);
                    let max = (valor && typeof valor === 'object' && 'total' in valor) ? Math.max(1, Number(valor.total)) : 5;
                    
                    if (isNaN(numVal)) numVal = 0;
                    if (isNaN(max) || max <= 0) max = 5;

                    const normVal = Math.round((numVal / max) * 5 * 10) / 10;
                    const clr = helpers.clrOf ? helpers.clrOf(normVal, 5) : '#2563eb';
                    const percent = (normVal / 5) * 100;
                    const fk = `${sesion.id}_${factor}`;
                    return (
                      <View key={factor} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#334155' }}>{ETQ[factor.toLowerCase()] || factor}</Text>
                          <Text style={{ fontSize: 8, color: clr, fontWeight: 'bold' }}>{normVal}/5</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3 }}>
                          <View style={{ width: `${percent}%`, height: 6, backgroundColor: clr, borderRadius: 3 }} />
                        </View>
                        {inf.interpretacionPorFactor?.[fk] && (
                          <Text style={{ fontSize: 8, color: '#475569', marginTop: 4, fontStyle: 'italic', lineHeight: 1.3 }}>
                            {inf.interpretacionPorFactor[fk]}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
            
            {/* MBTI y Ajuste de Tipología */}
            {(() => {
              const mainPB = sesBF[0]?.puntaje_bruto;
              const mbti = helpers.estimarMBTI ? helpers.estimarMBTI(mainPB) : null;
              if (!mbti && !inf.ajusteMbti) return null;
              return (
                <View style={{ marginTop: 15, padding: 12, backgroundColor: '#faf5ff', borderRadius: 8, borderLeft: '4px solid #9333ea' }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#7e22ce', marginBottom: 5 }}>
                    Tipología Predictiva: {mbti || (inf.ajusteMbti ? 'Estimación por Perfil' : 'No determinado')}
                  </Text>
                  {mbti && (
                    <Text style={{ fontSize: 8, color: '#6b21a8', fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>
                      {helpers.MBTI_DESC?.[mbti] || ''}
                    </Text>
                  )}
                  <View style={{ marginTop: 5, borderTop: '1px solid #e9d5ff', paddingTop: 8 }}>
                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#7e22ce', marginBottom: 4 }}>Análisis de Ajuste al Cargo:</Text>
                    <Text style={{ fontSize: 8, color: '#1e293b', lineHeight: 1.4 }}>{inf.ajusteMbti || 'Análisis de ajuste pendiente...'}</Text>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* III. CAPACIDAD ANALÍTICA */}
        {helpers.hasC && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 13, marginBottom: 15, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }]}>III. Capacidad Analítica y Potencial Cognitivo</Text>
            {sesCog.map((sesion: any) => {
              const { correctas, total, percentil } = helpers.cogData(sesion.puntaje_bruto);
              const normVal = Math.round((correctas / total) * 5 * 10) / 10;
              const nivel = percentil >= 85 ? 'Muy Superior' : percentil >= 70 ? 'Superior' : percentil >= 40 ? 'Promedio' : 'Bajo';
              const entries = helpers.numEntries(sesion.puntaje_bruto).filter(([f]: any) => f !== 'correctas' && f !== 'total' && f !== 'score' && f !== 'percentil');
              return (
                <View key={sesion.id}>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <View style={{ flex: 1, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, alignItems: 'center', border: '1px solid #bae6fd' }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0369a1' }}>{normVal}/5</Text>
                      <Text style={{ fontSize: 7, color: '#0369a1', textTransform: 'uppercase', fontWeight: 'bold', marginTop: 2 }}>Efectividad Cognitiva</Text>
                    </View>
                    <View style={{ flex: 1, padding: 12, backgroundColor: '#f0f9ff', borderRadius: 6, alignItems: 'center', border: '1px solid #bae6fd' }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0369a1' }}>P{percentil}</Text>
                      <Text style={{ fontSize: 7, color: '#0369a1', textTransform: 'uppercase', fontWeight: 'bold', marginTop: 2 }}>{nivel}</Text>
                    </View>
                  </View>
                  {entries.map(([factor, valor]: any) => {
                    const vNum = typeof valor === 'object' ? valor.correctas || valor.score : valor;
                    const vMax = (valor && typeof valor === 'object' && 'total' in valor) ? Number(valor.total) : total;
                    const vNorm = Math.round((vNum / vMax) * 5 * 10) / 10;
                    return (
                      <View key={factor} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#334155' }}>{ETQ[factor.toLowerCase()] || factor}</Text>
                          <Text style={{ fontSize: 8, color: '#0369a1', fontWeight: 'bold' }}>{vNorm}/5</Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: '#f1f5f9', borderRadius: 2 }}>
                          <View style={{ width: `${(vNorm/5)*100}%`, height: 4, backgroundColor: '#0369a1', borderRadius: 2 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

        {/* IV. COMPETENCIAS PROFESIONALES */}
        {helpers.hasK && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 13, marginBottom: 15, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }]}>IV. Competencias Profesionales</Text>
            {sesComp.map((sesion: any) => {
              const entries = helpers.numEntries(sesion.puntaje_bruto).filter(([f]: any) => DOMINIOS.COMPETENCIAS.includes(f));
              if (entries.length === 0) return null;
              return (
                <View key={sesion.id} style={{ marginBottom: 15 }}>
                  {entries.map(([factor, valor]: any) => {
                    let rawVal = typeof valor === 'object' ? valor.correctas || valor.score : valor;
                    
                    if (typeof rawVal === 'string') {
                      const s = rawVal.toLowerCase().trim();
                      if (s === 'bajo') rawVal = 1.5;
                      else if (s === 'medio') rawVal = 3.0;
                      else if (s === 'alto') rawVal = 5.0;
                    }

                    let numVal = Number(rawVal);
                    let max = (valor && typeof valor === 'object' && 'total' in valor) ? Math.max(1, Number(valor.total)) : 5;
                    
                    if (isNaN(numVal)) numVal = 0;
                    if (isNaN(max) || max <= 0) max = 5;

                    const normVal = Math.round((numVal / max) * 5 * 10) / 10;
                    const clr = helpers.clrOf ? helpers.clrOf(normVal, 5) : '#2563eb';
                    const percent = (normVal / 5) * 100;
                    const fk = `${sesion.id}_${factor}`;
                    return (
                      <View key={factor} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#334155' }}>{ETQ[factor.toLowerCase()] || factor}</Text>
                          <Text style={{ fontSize: 8, color: clr, fontWeight: 'bold' }}>{normVal}/5</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3 }}>
                          <View style={{ width: `${isNaN(percent) ? 0 : percent}%`, height: 6, backgroundColor: clr, borderRadius: 3 }} />
                        </View>
                        {inf.interpretacionPorFactor?.[fk] && (
                          <Text style={{ fontSize: 8, color: '#475569', marginTop: 4, fontStyle: 'italic', lineHeight: 1.3 }}>
                            {inf.interpretacionPorFactor[fk]}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

        {/* V. SALUD Y BIENESTAR LABORAL */}
        {helpers.hasK && (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 13, marginBottom: 15, borderBottom: '1px solid #e2e8f0', paddingBottom: 5 }]}>V. Salud y Bienestar Laboral</Text>
            {sesComp.map((sesion: any) => {
              const entries = helpers.numEntries(sesion.puntaje_bruto).filter(([f]: any) => DOMINIOS.BIENESTAR.includes(f));
              if (entries.length === 0) return null;
              return (
                <View key={sesion.id} style={{ marginBottom: 15 }}>
                  {entries.map(([factor, valor]: any) => {
                    let rawVal = typeof valor === 'object' ? valor.correctas || valor.score : valor;
                    
                    if (typeof rawVal === 'string') {
                      const s = rawVal.toLowerCase().trim();
                      if (s === 'bajo') rawVal = 1.5;
                      else if (s === 'medio') rawVal = 3.0;
                      else if (s === 'alto') rawVal = 5.0;
                    }

                    let numVal = Number(rawVal);
                    let max = (valor && typeof valor === 'object' && 'total' in valor) ? Math.max(1, Number(valor.total)) : 5;
                    
                    if (isNaN(numVal)) numVal = 0;
                    if (isNaN(max) || max <= 0) max = 5;

                    const normVal = Math.round((numVal / max) * 5 * 10) / 10;
                    const clr = helpers.clrOf ? helpers.clrOf(normVal, 5) : '#2563eb';
                    const percent = (normVal / 5) * 100;
                    const fk = `${sesion.id}_${factor}`;
                    return (
                      <View key={factor} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#334155' }}>{ETQ[factor.toLowerCase()] || factor}</Text>
                          <Text style={{ fontSize: 8, color: clr, fontWeight: 'bold' }}>{normVal}/5</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#f1f5f9', borderRadius: 3 }}>
                          <View style={{ width: `${isNaN(percent) ? 0 : percent}%`, height: 6, backgroundColor: clr, borderRadius: 3 }} />
                        </View>
                        {inf.interpretacionPorFactor?.[fk] && (
                          <Text style={{ fontSize: 8, color: '#475569', marginTop: 4, fontStyle: 'italic', lineHeight: 1.3 }}>
                            {inf.interpretacionPorFactor[fk]}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

        {/* Recomendación y Cierre */}
        <View wrap={false} style={{ marginTop: 10 }}>
          <Text style={styles.sectionTitle}>Dictamen y Fundamentación</Text>
          <View style={{ ...styles.recomendacionBox, backgroundColor: (REC_COLORS as any)[inf.recomendacion], marginBottom: 15 }}>
            <Text style={styles.recomendacionText}>{(REC_LABELS as any)[inf.recomendacion]}</Text>
          </View>
          
          {inf.fundamentacion && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 }}>Argumentación Técnica:</Text>
              <Text style={{ ...styles.textBlock, fontSize: 8.5 }}>{inf.fundamentacion}</Text>
            </View>
          )}

          <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: '45%', borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 10 }}>
              <Text style={{ fontSize: 8, color: '#64748b' }}>Firma del Evaluador</Text>
              <Text style={{ fontSize: 9, color: '#1e293b', marginTop: 4, fontWeight: 'bold' }}>{inf.nombreEvaluador || 'Firma Autorizada'}</Text>
            </View>
            <View style={{ width: '45%', borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 10 }}>
              <Text style={{ fontSize: 8, color: '#64748b' }}>Sello de la Institución</Text>
            </View>
          </View>
        </View>

        {/* Pie de página */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Documento generado por Psico-Plataforma 2.0 · Confidencial</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
