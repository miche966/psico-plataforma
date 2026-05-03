import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Registrar fuentes si fuera necesario, usando fuentes estándar por ahora para evitar problemas de red
// Font.register({ family: 'Inter', src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff' });

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: {
    backgroundColor: '#2563eb',
    margin: -40,
    marginBottom: 30,
    padding: 30,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: '#bfdbfe', fontSize: 10, marginTop: 4 },
  headerDate: { color: 'white', fontSize: 10 },
  
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    backgroundColor: '#eff6ff',
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
    marginBottom: 15,
    marginTop: 20
  },
  
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 10 },
  infoItem: { width: '50%', marginBottom: 10 },
  infoLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 11, color: '#0f172a', fontWeight: 'bold' },
  
  textBlock: { fontSize: 10, lineHeight: 1.5, color: '#334155', marginBottom: 15 },
  
  factorBlock: { marginBottom: 12 },
  factorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  factorName: { fontSize: 11, fontWeight: 'bold', color: '#1e293b' },
  factorValue: { fontSize: 10, color: '#2563eb', fontWeight: 'bold' },
  barBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 4 },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#2563eb' },
  factorDesc: { fontSize: 9, color: '#64748b', lineHeight: 1.4 },
  
  commentBox: { backgroundColor: '#f8fafc', padding: 10, borderLeftWidth: 3, borderLeftColor: '#cbd5e1', marginTop: 10, marginBottom: 15 },
  commentLabel: { fontSize: 8, fontWeight: 'bold', color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  commentText: { fontSize: 10, color: '#334155', lineHeight: 1.4 },
  
  recomendacionBox: {
    marginTop: 30,
    padding: 15,
    borderRadius: 6,
    alignItems: 'center'
  },
  recomendacionText: { color: 'white', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
  
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerText: { fontSize: 8, color: '#94a3b8' }
});

const REC_COLORS = {
  recomendado: '#16a34a',
  con_reservas: '#ea580c',
  no_recomendado: '#dc2626'
};

const REC_LABELS = {
  recomendado: 'Recomendado',
  con_reservas: 'Recomendado con reservas',
  no_recomendado: 'No recomendado'
};

export const InformePDF = ({ data }: any) => {
  const { candidato, proceso, sesiones, inf, helpers } = data;
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>PsicoPlataforma</Text>
            <Text style={styles.headerSubtitle}>Informe de Evaluación Psicolaboral — Confidencial</Text>
          </View>
          <Text style={styles.headerDate}>{helpers.hoy()}</Text>
        </View>

        {/* Datos Candidato */}
        <View style={styles.infoGrid}>
          <View style={{ width: '100%', marginBottom: 15 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>
              {candidato.nombre} {candidato.apellido}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{candidato.email}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Documento</Text>
            <Text style={styles.infoValue}>{candidato.documento || '—'}</Text>
          </View>
          {proceso && (
            <>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Proceso</Text>
                <Text style={styles.infoValue}>{proceso.nombre}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Cargo</Text>
                <Text style={styles.infoValue}>{proceso.cargo}</Text>
              </View>
            </>
          )}
        </View>

        {/* Resumen Ejecutivo */}
        {inf.resumenEjecutivo && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Resumen Ejecutivo</Text>
            <Text style={styles.textBlock}>{inf.resumenEjecutivo}</Text>
          </View>
        )}

        {/* Perfil de Personalidad */}
        {helpers.hasP && (
          <View>
            <Text style={styles.sectionTitle}>Perfil de Personalidad</Text>
            {helpers.sesBF.map((s: any, idx: number) => (
              <View key={s.id} style={{ marginBottom: 15 }}>
                {helpers.numEntries(s.puntaje_bruto).map(([factor, valor]: any) => {
                  const clr = helpers.clrOf(valor);
                  return (
                    <View key={factor} style={styles.factorBlock} wrap={false}>
                      <View style={styles.factorHeader}>
                        <Text style={styles.factorName}>{helpers.ETQ[factor] || factor}</Text>
                        <Text style={{ ...styles.factorValue, color: clr }}>{helpers.lvl(valor)}  {valor}/5</Text>
                      </View>
                      <View style={styles.barBg}>
                        <View style={{ ...styles.barFill, width: `${(valor/5)*100}%`, backgroundColor: helpers.CLR[factor] || clr }} />
                      </View>
                      {inf.interpretacionPorFactor[`${s.id}_${factor}`] && (
                        <Text style={styles.factorDesc}>{inf.interpretacionPorFactor[`${s.id}_${factor}`]}</Text>
                      )}
                    </View>
                  )
                })}
                {helpers.estimarMBTI(s.puntaje_bruto) && (
                  <View style={{ ...styles.commentBox, borderLeftColor: '#9333ea', backgroundColor: '#faf5ff' }} wrap={false}>
                    <Text style={{ ...styles.commentLabel, color: '#9333ea' }}>Tipología de personalidad (indicativa): {helpers.estimarMBTI(s.puntaje_bruto)}</Text>
                    <Text style={styles.commentText}>{helpers.MBTI_DESC[helpers.estimarMBTI(s.puntaje_bruto)]}</Text>
                    {inf.ajusteMbti && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ ...styles.commentLabel, color: '#9333ea' }}>Ajuste a la vacante</Text>
                        <Text style={styles.commentText}>{inf.ajusteMbti}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
            
            {inf.comentarioPersonalidad && (
              <View style={styles.commentBox} wrap={false}>
                <Text style={styles.commentLabel}>Comentario del evaluador</Text>
                <Text style={styles.commentText}>{inf.comentarioPersonalidad}</Text>
              </View>
            )}
          </View>
        )}

        {/* Aptitudes Cognitivas */}
        {helpers.hasC && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Aptitudes Cognitivas</Text>
            {helpers.sesCog.map((s: any) => {
              const d = helpers.cogData(s.puntaje_bruto);
              const lv = helpers.interpretarPercentil(d.percentil);
              const clr = helpers.clrOf(d.percentil, 100);
              return (
                <View key={s.id} style={styles.factorBlock}>
                  <View style={styles.factorHeader}>
                    <Text style={styles.factorName}>{helpers.testNombre(s.puntaje_bruto)}</Text>
                    <Text style={{ ...styles.factorValue, color: clr }}>{lv} (PC: {d.percentil})  {d.correctas}/{d.total} ({d.pct}%)</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={{ ...styles.barFill, width: `${d.percentil}%`, backgroundColor: clr }} />
                  </View>
                </View>
              )
            })}
            
            {inf.comentarioCognitivo && (
              <View style={styles.commentBox}>
                <Text style={styles.commentLabel}>Comentario del evaluador</Text>
                <Text style={styles.commentText}>{inf.comentarioCognitivo}</Text>
              </View>
            )}
          </View>
        )}

        {/* Competencias Conductuales */}
        {helpers.hasK && (
          <View wrap={false}>
            <Text style={styles.sectionTitle}>Competencias Conductuales</Text>
            {helpers.sesComp.map((s: any) => {
              const avg = helpers.avgOf(s.puntaje_bruto);
              const lv = helpers.lvl(avg);
              const clr = helpers.clrOf(avg);
              return (
                <View key={s.id} style={styles.factorBlock}>
                  <View style={styles.factorHeader}>
                    <Text style={styles.factorName}>{helpers.testNombre(s.puntaje_bruto)}</Text>
                    <Text style={{ ...styles.factorValue, color: clr }}>{lv}  {avg}/5</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={{ ...styles.barFill, width: `${(avg/5)*100}%`, backgroundColor: clr }} />
                  </View>
                </View>
              )
            })}
            
            {inf.comentarioCompetencias && (
              <View style={styles.commentBox}>
                <Text style={styles.commentLabel}>Comentario del evaluador</Text>
                <Text style={styles.commentText}>{inf.comentarioCompetencias}</Text>
              </View>
            )}
          </View>
        )}

        {/* Recomendación Final */}
        <View wrap={false}>
          <View style={{ ...styles.recomendacionBox, backgroundColor: (REC_COLORS as any)[inf.recomendacion] }}>
            <Text style={styles.recomendacionText}>{(REC_LABELS as any)[inf.recomendacion]}</Text>
          </View>
          
          {inf.fundamentacion && (
            <Text style={{ ...styles.textBlock, marginTop: 15 }}>{inf.fundamentacion}</Text>
          )}

          <View style={{ marginTop: 40, borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 10, width: 200 }}>
            <Text style={{ fontSize: 10, color: '#64748b' }}>Evaluador/a: {inf.nombreEvaluador || '_____________________'}</Text>
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 30 }}>Firma: _____________________</Text>
          </View>
        </View>

        {/* Pie de página para todas las páginas */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>PsicoPlataforma · seleccion@empresa.com</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
