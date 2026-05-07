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
          {sesion.candidato?.email && <Text style={styles.infoText}>Email: {sesion.candidato.email}</Text>}
          <Text style={styles.infoText}>Fecha: {fecha}</Text>
          <Text style={styles.infoText}>Instrumento: {helpers.esBigFive(pb) ? 'Big Five IPIP-NEO' : helpers.esCognitivo(pb) ? 'Test Cognitivo' : 'Evaluación General'}</Text>
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

        {!helpers.esBigFive(pb) && !helpers.esCognitivo(pb) && (
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
