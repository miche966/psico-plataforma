/* eslint-disable react/display-name */
/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Registro de fuentes para un look premium
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxP.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/roboto/v20/KFOlCnqEu92Fr1MmWUlfBBc9.ttf', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Roboto', backgroundColor: '#ffffff', fontSize: 9, color: '#1e293b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  headerSubtitle: { fontSize: 9, color: '#64748b', marginTop: 2 },
  headerDate: { fontSize: 8, color: '#64748b' },
  
  section: { marginBottom: 20 },
  sectionTitle: { 
    fontSize: 11, 
    fontWeight: 'bold', 
    color: '#0f172a', 
    backgroundColor: '#f8fafc', 
    padding: 6, 
    borderLeftWidth: 3, 
    borderLeftColor: '#2563eb',
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  infoItem: { width: '33.33%', marginBottom: 10 },
  infoLabel: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', marginBottom: 2, fontWeight: 'bold' },
  infoValue: { fontSize: 9, color: '#1e293b', fontWeight: 'bold' },
  
  card: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  cardTitle: { fontSize: 9, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 },
  cardText: { fontSize: 8, color: '#475569', lineHeight: 1.4 },
  
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, fontSize: 7, fontWeight: 'bold' },
  
  factorBlock: { marginBottom: 8 },
  factorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  factorName: { fontSize: 9, fontWeight: 'bold', color: '#334155' },
  factorValue: { fontSize: 8, fontWeight: 'bold' },
  barBg: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 3 },
  barFill: { height: 4, borderRadius: 2 },
  factorDesc: { fontSize: 8, color: '#475569', lineHeight: 1.3 },
  
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#94a3b8' }
});

const ETQ: Record<string, string> = {
  // Personalidad y Probidad
  extraversion: 'Extraversión', amabilidad: 'Amabilidad', responsabilidad: 'Responsabilidad',
  neuroticismo: 'Estabilidad Emocional', apertura: 'Apertura a la Experiencia',
  honestidad_humildad: 'Honestidad y Humildad',
  honestidad: 'Sinceridad y Franqueza',
  normas: 'Apego a Normas y Ética',
  promedio_general: 'Índice de Probidad General',
  
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
  liderazgo: 'Liderazgo Estratégico',
  trabajo_equipo: 'Trabajo en Equipo y Sinergia',
  adaptabilidad: 'Adaptabilidad al Cambio',
  resolucion_problemas: 'Resolución de Problemas Complejos',
  
  // Salud y Bienestar Laboral
  burnout: 'Nivel de Riesgo (Burnout)',
  equilibrio: 'Balance Vida-Trabajo',
  relaciones: 'Relaciones Interpersonales y Clima',
  claridad_rol: 'Percepción de Claridad de Rol',
  nivel_estres: 'Indicador de Tensión Psicológica',
  carga_laboral: 'Gestión de la Demanda de Trabajo',
  resiliencia: 'Capacidad de Resiliencia',
  manejo_estres: 'Gestión Situacional de Estrés',
  autoestima: 'Confianza y Autoestima Profesional',
  inteligencia_emocional: 'Inteligencia Emocional (IE)',
};

const DOMINIOS = {
  PERSONALIDAD: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad', 'honestidad', 'normas', 'promedio_general'],
  COGNITIVO: ['correctas', 'percentil', 'score', 'documentos', 'comparacion', 'concentracion', 'errores_texto', 'errores_numeros', 'metricas_fraude'],
  COMPETENCIAS: ['etica', 'negociacion', 'manejo_emocional', 'tolerancia_frustracion', 'comunicacion', 'liderazgo', 'trabajo_equipo', 'adaptabilidad', 'resolucion_problemas'],
  BIENESTAR: ['burnout', 'equilibrio', 'relaciones', 'claridad_rol', 'nivel_estres', 'carga_laboral', 'resiliencia', 'manejo_estres', 'autoestima', 'inteligencia_emocional']
}

export const InformePDF = ({ data }: any) => {
  const { candidato, proceso, sesiones, videos, inf, helpers } = data;

  // Detección robusta de dominios e inclusión de sesiones
  const { hasP, hasC, hasK, hasV, sesBF, sesCog, sesComp, sesBien } = (() => {
    const check = (dom: string[]) => sesiones.some((s: any) => {
      const pb = s.puntaje_bruto || {};
      const keys = Object.keys(pb).map(k => k.toLowerCase());
      return keys.some(k => dom.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => dom.includes(k.toLowerCase())));
    });

    const filter = (dom: string[], prefix?: string) => sesiones.filter((s: any) => {
      if (prefix && s.test_id?.toLowerCase().startsWith(prefix)) return true;
      const pb = s.puntaje_bruto || {};
      const keys = Object.keys(pb).map(k => k.toLowerCase());
      return keys.some(k => dom.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => dom.includes(k.toLowerCase())));
    });

    return {
      hasP: check(DOMINIOS.PERSONALIDAD),
      hasC: check(DOMINIOS.COGNITIVO),
      hasK: check(DOMINIOS.COMPETENCIAS) || sesiones.some((s: any) => s.test_id?.toLowerCase().startsWith('sjt-')),
      hasV: check(DOMINIOS.BIENESTAR) || sesiones.some((s: any) => {
        const tid = s.test_id?.toLowerCase() || '';
        return tid.includes('bienestar') || tid.includes('estres') || tid.includes('dass21');
      }),
      sesBF: filter(DOMINIOS.PERSONALIDAD),
      sesCog: filter(DOMINIOS.COGNITIVO),
      sesComp: filter(DOMINIOS.COMPETENCIAS, 'sjt-'),
      sesBien: filter(DOMINIOS.BIENESTAR, 'bienestar') // Simplified for now
    };
  })();

  const clrOf = (v: number) => v >= 4 ? '#059669' : v >= 3 ? '#2563eb' : v >= 2 ? '#d97706' : '#dc2626';

  const renderFactores = (dominio: string[], sesionesFilt: any[]) => {
    const mapa = new Map<string, any>();
    [...sesionesFilt].sort((a, b) => new Date(b.finalizada_en || 0).getTime() - new Date(a.finalizada_en || 0).getTime()).forEach(s => {
      const scan = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        Object.entries(obj).forEach(([f, v]: any) => {
          const key = f.toLowerCase();
          if (dominio.includes(key)) {
            if (!mapa.has(key)) mapa.set(key, { valor: v, sid: s.id });
          }
          if (f === 'por_factor') scan(v);
        });
      };
      scan(s.puntaje_bruto);
    });

    return Array.from(mapa.entries()).map(([factor, { valor, sid }]) => {
      let vNum = typeof valor === 'object' ? valor.correctas || valor.score : valor;
      if (typeof vNum === 'string') {
        const s = vNum.toLowerCase().trim();
        vNum = s === 'alto' ? 5 : s === 'medio' ? 3 : 1.5;
      }
      const max = (valor && typeof valor === 'object' && 'total' in valor) ? Number(valor.total) || 5 : 5;
      const rawVNorm = Math.round((Number(vNum) / max) * 5 * 10) / 10;
      const vNorm = isNaN(rawVNorm) ? 0 : rawVNorm;
      const clr = clrOf(vNorm);
      const fk = `${sid}_${factor}`;

      // Narrativas fallback (simplified version of the deep ones)
      const desc = inf.interpretacionPorFactor?.[fk] || 'Muestra un desempeño funcional acorde a los requerimientos del cargo evaluado.';

      return (
        <View key={factor} style={styles.factorBlock}>
          <View style={styles.factorHeader}>
            <Text style={styles.factorName}>{ETQ[factor] || factor}</Text>
            <Text style={[styles.factorValue, { color: clr }]}>{vNorm}/5</Text>
          </View>
          <View style={styles.barBg}><View style={[styles.barFill, { width: `${(vNorm/5)*100}%`, backgroundColor: clr }]} /></View>
          <Text style={styles.factorDesc}>{desc}</Text>
        </View>
      );
    });
  };

  return (
    <Document title={`Informe - ${candidato.nombre}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View><Text style={styles.headerTitle}>PSICO-PLATAFORMA 2.0</Text><Text style={styles.headerSubtitle}>Intelligence & Talent Analytics Report</Text></View>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString()}</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Candidato</Text><Text style={styles.infoValue}>{candidato.nombre} {candidato.apellido}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Documento</Text><Text style={styles.infoValue}>{candidato.documento || 'No provisto'}</Text></View>
          <View style={styles.infoItem}><Text style={styles.infoLabel}>Cargo</Text><Text style={styles.infoValue}>{proceso?.cargo || 'No especificado'}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. Diagnóstico Estratégico y Ajuste al Perfil</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={{ width: '25%', backgroundColor: '#f0f9ff', padding: 10, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: clrOf((inf.ajusteCargo?.score || 0)/20) }}>{inf.ajusteCargo?.score || 0}%</Text>
              <Text style={{ fontSize: 6, color: '#0369a1', fontWeight: 'bold' }}>AJUSTE GLOBAL</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <Text style={styles.cardText}>{inf.ajusteCargo?.analisis || 'Análisis pendiente...'}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
            <View style={{ flex: 1, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 6, border: '1px solid #bbf7d0' }}>
              <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#16a34a', marginBottom: 4 }}>FORTALEZAS CLAVE</Text>
              {(inf.fortalezas || []).map((f: string, i: number) => (
                <Text key={i} style={{ fontSize: 7, color: '#14532d', marginBottom: 2 }}>• {f}</Text>
              ))}
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff7ed', padding: 8, borderRadius: 6, border: '1px solid #ffedd5' }}>
              <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#ea580c', marginBottom: 4 }}>ÁREAS DE DESARROLLO</Text>
              {(inf.oportunidadesMejora || []).map((f: string, i: number) => (
                <Text key={i} style={{ fontSize: 7, color: '#7c2d12', marginBottom: 2 }}>• {f}</Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. Auditoría de Proceso y Confiabilidad</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <Text style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>ÍNDICE DE CONFIANZA</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: inf.confianza > 80 ? '#059669' : '#dc2626' }}>{inf.confianza || 0}%</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <Text style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>ALERTAS PROCTORING</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#334155' }}>{(inf.alertasTab || 0) + (inf.alertasCopia || 0)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <Text style={{ fontSize: 6, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>TIEMPO PROMEDIO</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#334155' }}>{inf.tiempoPromedio || 0} min</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. Matriz de Potencial Conductual (Soft Skills)</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: '#f5f3ff', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #ddd6fe' }}>
              <Text style={{ fontSize: 7, color: '#7c3aed', fontWeight: 'bold', marginBottom: 4 }}>LIDERAZGO</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#7c3aed' }}>{inf.liderazgo || 0}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff7ed', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #ffedd5' }}>
              <Text style={{ fontSize: 7, color: '#ea580c', fontWeight: 'bold', marginBottom: 4 }}>ADAPTABILIDAD</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ea580c' }}>{inf.adaptabilidad || 0}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#fef2f2', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #fee2e2' }}>
              <Text style={{ fontSize: 7, color: '#dc2626', fontWeight: 'bold', marginBottom: 4 }}>RESILIENCIA</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626' }}>{inf.resiliencia || 0}</Text>
            </View>
          </View>
        </View>

        {inf.resumenEjecutivo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumen Ejecutivo e Integrativo</Text>
            <Text style={[styles.cardText, { lineHeight: 1.5 }]}>{inf.resumenEjecutivo}</Text>
          </View>
        )}

        {hasP && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>IV. Perfil Conductual y Personalidad</Text>
            {renderFactores(DOMINIOS.PERSONALIDAD, sesBF)}
          </View>
        )}

        {hasC && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>V. Capacidad Analítica y Cognitiva</Text>
            {sesCog.length > 0 && (() => {
              const sesion = [...sesCog].sort((a, b) => new Date(b.finalizada_en || 0).getTime() - new Date(a.finalizada_en || 0).getTime())[0];
              const pb = sesion.puntaje_bruto || {};
              const corr = Number(pb.correctas || 0);
              const tot = Number(pb.total || 1);
              const perc = Number(pb.percentil || 0);
              const normVal = Math.round((corr / tot) * 5 * 10) / 10;
              
              return (
                <View>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <View style={{ flex: 1, backgroundColor: '#f0f9ff', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #bae6fd' }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0369a1' }}>{normVal}/5</Text>
                      <Text style={{ fontSize: 6, color: '#0369a1', fontWeight: 'bold', textTransform: 'uppercase' }}>Efectividad Cognitiva</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#f0f9ff', padding: 10, borderRadius: 6, alignItems: 'center', border: '1px solid #bae6fd' }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0369a1' }}>P{perc}</Text>
                      <Text style={{ fontSize: 6, color: '#0369a1', fontWeight: 'bold', textTransform: 'uppercase' }}>Rango Percentil</Text>
                    </View>
                  </View>
                  {renderFactores(DOMINIOS.COGNITIVO.filter(f => !['correctas', 'total', 'score', 'percentil'].includes(f)), sesCog)}
                </View>
              );
            })()}
          </View>
        )}

        <View break />

        {hasK && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VI. Competencias Profesionales</Text>
            {renderFactores(DOMINIOS.COMPETENCIAS, sesComp)}
          </View>
        )}

        {hasV && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VII. Salud y Bienestar Laboral</Text>
            {renderFactores(DOMINIOS.BIENESTAR, sesBien)}
          </View>
        )}

        {videos && videos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIII. Análisis de Video-Entrevista y Discurso</Text>
            {videos.map((v: any, i: number) => (
              <View key={i} style={[styles.card, { marginBottom: 10 }]}>
                <Text style={styles.cardTitle}>Pregunta {i + 1}: {v.pregunta || 'Respuesta en Video'}</Text>
                <Text style={[styles.cardText, { color: '#64748b' }]}>
                  {v.transcripcion || 'Transcripción no disponible o en proceso de análisis...'}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 20, padding: 15, borderTop: 1, borderTopColor: '#e2e8f0' }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: clrOf(inf.recomendacion === 'recomendado' ? 5 : inf.recomendacion === 'con_reservas' ? 3 : 1) }}>
            DICTAMEN FINAL: {inf.recomendacion?.replace('_', ' ').toUpperCase()}
          </Text>
          <Text style={[styles.cardText, { marginTop: 5 }]}>{inf.fundamentacion || 'Sin fundamentación técnica registrada.'}</Text>
          <Text style={{ fontSize: 8, color: '#64748b', marginTop: 15 }}>Evaluador: {inf.nombreEvaluador || 'Equipo de Consultoría'}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Psico-Plataforma 2.0 - Confidencial</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
        </View>
      </Page>
    </Document>
  );
};
