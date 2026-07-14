import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: {
    backgroundColor: '#2563eb',
    margin: -40,
    marginBottom: 30,
    padding: 30,
    paddingTop: 40,
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#bfdbfe', fontSize: 11, marginTop: 4 },
  
  infoSection: { marginBottom: 30, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 10 },
  nombre: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 },
  infoText: { fontSize: 10, color: '#64748b', marginBottom: 3 },

  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  
  factorBlock: { marginBottom: 12 },
  factorName: { fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  factorValue: { fontSize: 10, fontWeight: 'bold' },
  barBg: { height: 5, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 4 },
  barFill: { height: 5, borderRadius: 2 },
  desc: { fontSize: 9, color: '#64748b', lineHeight: 1.4 },

  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10 },
  footerText: { fontSize: 8, color: '#94a3b8' }
});

export const SimplePDF = ({ data }: any) => {
  const { sesion, nombre, fecha, helpers } = data;
  const pb = sesion.puntaje_bruto || {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PsicoPlataforma</Text>
          <Text style={styles.headerSubtitle}>Informe de Evaluación Psicolaboral</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.nombre}>{nombre}</Text>
          {(sesion.candidatos?.email || sesion.candidato?.email) && (
            <Text style={styles.infoText}>Email: {sesion.candidatos?.email || sesion.candidato?.email}</Text>
          )}
          <Text style={styles.infoText}>Fecha: {fecha}</Text>
          <Text style={styles.infoText}>
            Instrumento: {helpers.esBigFive(pb) ? 'Big Five IPIP-NEO' : helpers.esCognitivo(pb) ? 'Test Cognitivo' : helpers.esFrasesIncompletas?.(pb) ? 'Test de Frases Incompletas' : 'Evaluación General'}
          </Text>
        </View>

        {helpers.esBigFive(pb) && (
          <View>
            <Text style={styles.sectionTitle}>Perfil de Personalidad</Text>
            {helpers.valoresNumericos(pb).map(([factor, valor]: any) => {
              const rgb = helpers.coloresRGB[factor] || [37, 99, 235];
              const colorStr = `rgb(${rgb.join(',')})`;
              const nivel = valor >= 4 ? 'Alto' : valor >= 3 ? 'Moderado' : 'Bajo';
              const pct = (valor / 5) * 100;
              
              return (
                <View key={factor} style={styles.factorBlock} wrap={false}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.factorName}>{helpers.etiquetasPDF[factor] || factor}</Text>
                    <Text style={{ ...styles.factorValue, color: colorStr }}>{nivel} ({valor}/5)</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: colorStr }} />
                  </View>
                  <Text style={styles.desc}>{helpers.interpretacion(factor, valor)}</Text>
                </View>
              )
            })}
          </View>
        )}

        {helpers.esCognitivo(pb) && (
          <View>
            <Text style={styles.sectionTitle}>Resultado Cognitivo</Text>
            {(() => {
              const { correctas, total, pct } = helpers.datosCognitivos(pb);
              return (
                <View style={styles.factorBlock}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.factorName}>Aciertos</Text>
                    <Text style={{ ...styles.factorValue, color: '#2563eb' }}>{correctas}/{total} — {pct}%</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: '#2563eb' }} />
                  </View>
                </View>
              )
            })()}
          </View>
        )}

        {helpers.esSJT(pb) && !helpers.esRoleplay?.(pb) && (
          <View>
            <Text style={styles.sectionTitle}>Análisis Situacional (SJT)</Text>
            {Object.entries(pb.por_factor || {}).map(([factor, info]: any) => {
              const valor = Math.round(((info.correctas / info.total) * 5) * 10) / 10;
              const colorStr = '#b45309'; // Amber
              const nivel = valor >= 4 ? 'Alto' : valor >= 3 ? 'Moderado' : 'Bajo';
              const pct = (valor / 5) * 100;

              return (
                <View key={factor} style={styles.factorBlock} wrap={false}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.factorName}>{helpers.etiquetasPDF[factor] || factor}</Text>
                    <Text style={{ ...styles.factorValue, color: colorStr }}>{nivel} ({valor}/5)</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: colorStr }} />
                  </View>
                  <Text style={styles.desc}>{helpers.interpretacion(factor, valor)}</Text>
                </View>
              )
            })}
          </View>
        )}

        {helpers.esFrasesIncompletas?.(pb) && (
          <View>
            <Text style={styles.sectionTitle}>Análisis de Frases Incompletas</Text>
            
            {/* 1. Rasgos de personalidad */}
            {pb.analisis_ia?.rasgosPersonalidad && (
              <View style={styles.factorBlock} wrap={false}>
                <Text style={styles.factorName}>Análisis de Personalidad y Rasgos</Text>
                <Text style={styles.desc}>{pb.analisis_ia.rasgosPersonalidad}</Text>
              </View>
            )}
            
            {/* 2. Guía de Liderazgo */}
            {pb.analisis_ia?.guiaGestionLiderazgo && (
              <View style={{ ...styles.factorBlock, marginTop: 15, padding: 12, backgroundColor: '#f8fafc', borderRadius: 6 }} wrap={false}>
                <Text style={styles.factorName}>Guía de Gestión de Liderazgo (Supervisor)</Text>
                <Text style={styles.desc}>{pb.analisis_ia.guiaGestionLiderazgo}</Text>
              </View>
            )}
            
            {/* 3. Auditoría Ortográfica */}
            {pb.analisis_ia?.auditoriaOrtografica && (
              <View style={{ ...styles.factorBlock, marginTop: 15 }} wrap={false}>
                <Text style={styles.factorName}>Auditoría Ortográfica e Integridad</Text>
                <Text style={styles.desc}>
                  {pb.analisis_ia.auditoriaOrtografica.tieneErrores 
                    ? `Se identificaron los siguientes errores de redacción/ortografía: ${pb.analisis_ia.auditoriaOrtografica.erroresEncontrados}`
                    : 'No se detectaron errores ortográficos significativos en las respuestas del postulante.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {helpers.esRoleplay?.(pb) && (
          <View>
            <Text style={styles.sectionTitle}>Evaluación de Simulación Interactiva (Role Play)</Text>
            
            {/* 1. Dimensiones de Desempeño */}
            <View style={{ marginBottom: 15 }}>
              {Object.entries(pb.por_factor || {}).map(([factor, puntajeDirecto]: any) => {
                const valorNum = typeof puntajeDirecto === 'number' ? puntajeDirecto : parseFloat(String(puntajeDirecto)) || 0
                const valorEscala = Math.round((valorNum / 20) * 10) / 10
                const pct = valorNum
                const colorStr = '#4f46e5' // Indigo
                
                return (
                  <View key={factor} style={styles.factorBlock} wrap={false}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.factorName}>{factor}</Text>
                      <Text style={{ ...styles.factorValue, color: colorStr }}>{valorEscala} / 5 ({valorNum}%)</Text>
                    </View>
                    <View style={styles.barBg}>
                      <View style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: colorStr }} />
                    </View>
                  </View>
                )
              })}
            </View>

            {/* 2. Retroalimentación de la IA */}
            {pb.retroalimentacion && (
              <View style={{ padding: 10, backgroundColor: '#f5f3ff', borderLeftWidth: 3, borderLeftColor: '#7c3aed', marginBottom: 15 }} wrap={false}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#6d28d9', marginBottom: 3 }}>Retroalimentación del Evaluador IA</Text>
                <Text style={styles.desc}>"{pb.retroalimentacion}"</Text>
              </View>
            )}

            {/* 3. Transcripción de la Conversación */}
            {pb.transcripcion && pb.transcripcion.length > 0 && (
              <View>
                <Text style={{ ...styles.sectionTitle, fontSize: 11, marginBottom: 8, marginTop: 10 }}>Transcripción del Diálogo</Text>
                {pb.transcripcion.map((msg: any, idx: number) => {
                  const esModel = msg.role === 'model' || msg.role === 'assistant'
                  const esAtencion = sesion.test_id === 'd8e9f0a1-b2c3-4567-defa-777777777777'
                  const remitente = esModel ? `Cliente (${esAtencion ? 'Laura Benítez' : 'Carlos Gómez'})` : 'Candidato (Analista)'
                  return (
                    <View key={idx} style={{ marginBottom: 6, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }} wrap={false}>
                      <Text style={{ fontSize: 7, fontWeight: 'bold', color: esModel ? '#64748b' : '#4f46e5' }}>{remitente}</Text>
                      <Text style={{ fontSize: 8, color: '#334155', marginTop: 1, lineHeight: 1.3 }}>{msg.content}</Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {!helpers.esBigFive(pb) && !helpers.esCognitivo(pb) && !helpers.esSJT(pb) && !helpers.esFrasesIncompletas?.(pb) && !helpers.esRoleplay?.(pb) && (
          <View>
            <Text style={styles.sectionTitle}>Resultado General</Text>
            {(() => {
              const prom = helpers.promedioPuntaje(pb);
              const pct = Math.min((prom / 5) * 100, 100);
              return (
                <View style={styles.factorBlock}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.factorName}>Promedio</Text>
                    <Text style={{ ...styles.factorValue, color: '#2563eb' }}>{prom} / 5</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={{ ...styles.barFill, width: `${pct}%`, backgroundColor: '#2563eb' }} />
                  </View>
                </View>
              )
            })()}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>PsicoPlataforma · seleccion@republicamicrofinanzas.com.uy · WhatsApp: 092 651 770</Text>
        </View>
      </Page>
    </Document>
  );
};
