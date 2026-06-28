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

function obtenerTextoAnalisis(analisis: any): string {
  if (!analisis) return ''
  if (typeof analisis === 'string') return analisis
  
  if (typeof analisis === 'object') {
    if (analisis.actitud) {
      if (typeof analisis.actitud === 'string') return analisis.actitud
      if (typeof analisis.actitud === 'object') {
        return Object.entries(analisis.actitud)
          .map(([key, val]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${val}`)
          .join(' | ')
      }
    }
    if (analisis.resumen && typeof analisis.resumen === 'string') return analisis.resumen
    if (analisis.analisis && typeof analisis.analisis === 'string') return analisis.analisis

    // Fallback: mapear todas las propiedades excluyendo transcripción
    return Object.entries(analisis)
      .filter(([k]) => k !== 'transcripcion')
      .map(([key, val]) => {
        const readableKey = key.replace(/_/g, ' ').toUpperCase()
        const readableVal = typeof val === 'object' ? JSON.stringify(val) : String(val)
        return `${readableKey}: ${readableVal}`
      })
      .join(' | ')
  }
  return String(analisis)
}

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
  extraversion: 'Extraversión', 
  'extraversión y energía social': 'Extraversión',
  'extraversión': 'Extraversión',
  amabilidad: 'Amabilidad',
  'amabilidad y cooperación': 'Amabilidad',
  responsabilidad: 'Responsabilidad',
  'responsabilidad y organización': 'Responsabilidad',
  neuroticismo: 'Estabilidad Emocional',
  'neuroticismo y ajuste': 'Estabilidad Emocional',
  'estabilidad emocional': 'Estabilidad Emocional',
  apertura: 'Apertura a la Experiencia',
  'apertura a la experiencia': 'Apertura a la Experiencia',
  'apertura y curiosidad': 'Apertura a la Experiencia',
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

  const esCargoLiderazgo = proceso?.cargo ? (
    proceso.cargo.toLowerCase().includes('jefe') ||
    proceso.cargo.toLowerCase().includes('jefa') ||
    proceso.cargo.toLowerCase().includes('gerente') ||
    proceso.cargo.toLowerCase().includes('lider') ||
    proceso.cargo.toLowerCase().includes('líder') ||
    proceso.cargo.toLowerCase().includes('director') ||
    proceso.cargo.toLowerCase().includes('coordinador') ||
    proceso.cargo.toLowerCase().includes('supervisor') ||
    proceso.cargo.toLowerCase().includes('responsable')
  ) : false;

  const labelLiderazgo = esCargoLiderazgo ? 'LIDERAZGO' : 'AUTOGESTIÓN';

  // Detección robusta de dominios e inclusión de sesiones
  const { hasP, hasC, hasK, hasV, sesBF, sesCog, sesComp, sesBien } = (() => {
    const check = (dom: string[]) => sesiones.some((s: any) => {
      const pb = s.puntaje_bruto || {};
      const keys = Object.keys(pb).map(k => k.toLowerCase());
      return keys.some(k => dom.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => dom.includes(k.toLowerCase())));
    });

    const filter = (dom: string[], prefix?: string) => sesiones.filter((s: any) => {
      if (prefix && s.test_id?.toLowerCase().startsWith(prefix)) return true;
      // Evitar que la sesión de estrés (bienestar) meta ruido en el dominio de personalidad
      if (dom === DOMINIOS.PERSONALIDAD && s.test_id === 'd0e1f2a3-b4c5-6789-defa-000000000001') return false;
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
      sesCog: sesiones.filter((s: any) => {
        const tid = s.test_id?.toLowerCase() || ''
        if (tid.includes('dass21') || tid.includes('estres')) return false
        const pb = s.puntaje_bruto || {};
        const keys = Object.keys(pb).map(k => k.toLowerCase());
        return keys.some(k => DOMINIOS.COGNITIVO.includes(k)) || (pb.por_factor && Object.keys(pb.por_factor).some(k => DOMINIOS.COGNITIVO.includes(k.toLowerCase())));
      }),
      sesComp: filter(DOMINIOS.COMPETENCIAS, 'sjt-'),
      sesBien: filter(DOMINIOS.BIENESTAR, 'bienestar') // Simplified for now
    };
  })();

  const clrOf = (v: number) => v >= 4 ? '#059669' : v >= 3 ? '#2563eb' : v >= 2 ? '#d97706' : '#dc2626';

  const sesionFrases = sesiones.find((s: any) => s.test_id === 'f7a8b9c0-d1e2-4356-abcd-888888888888');
  const analisisFrases = sesionFrases?.puntaje_bruto?.analisis_ia;

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
      let vNum = typeof valor === 'object' && valor !== null ? (valor.correctas || valor.score || valor.valor || 0) : valor;
      if (typeof vNum === 'string') {
        const s = vNum.toLowerCase().trim();
        vNum = s === 'alto' ? 5 : s === 'medio' ? 3 : s === 'bajo' ? 1.5 : (Number(vNum) || 0);
      }
      
      const k = factor.toLowerCase().trim();
      let finalV = Number(vNum);
      const max = (valor && typeof valor === 'object' && 'total' in valor) ? Number(valor.total) || 5 : 5;
      
      // Normalización a escala 5
      finalV = (finalV / max) * 5;

      // Inversión lógica
      if (['neuroticismo', 'nivel_estres', 'burnout', 'equilibrio', 'relaciones', 'carga_laboral'].includes(k)) {
        finalV = Math.max(0, 6 - finalV);
      } else if (k === 'errores_texto') {
        finalV = Math.max(0, 5 - finalV);
      }

      const vNorm = Math.round(Math.min(5, Math.max(0, finalV)) * 10) / 10;
      const clr = clrOf(vNorm);
      const fk = `${sid}_${factor}`;

      // Narrativas fallback e integración con IA profunda
      const desc = inf.interpretacionPorFactor?.[fk] || 
                   inf.interpretacionPorFactor?.[factor.toLowerCase()] || 
                   obtenerInterpretacionLocal(factor, vNorm);

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
              {(inf.fortalezas || []).map((f: any, i: number) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  {typeof f === 'object' ? (
                    <>
                      <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#14532d' }}>• {f.tendencia || f.competencia || 'Fortaleza'}</Text>
                      <Text style={{ fontSize: 6, color: '#166534', marginLeft: 6 }}>Mecanismo: {f.mecanismo || 'No especificado'}</Text>
                      <Text style={{ fontSize: 6, color: '#166534', marginLeft: 6 }}>Impacto: {f.impacto_organizacional || f.impacto || 'No especificado'}</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 7, color: '#14532d' }}>• {f}</Text>
                  )}
                </View>
              ))}
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff7ed', padding: 8, borderRadius: 6, border: '1px solid #ffedd5' }}>
              <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#ea580c', marginBottom: 4 }}>ÁREAS DE DESARROLLO</Text>
              {(inf.oportunidadesMejora || []).map((f: any, i: number) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  {typeof f === 'object' ? (
                    <>
                      <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#7c2d12' }}>• {f.tendencia || f.competencia || 'Área de mejora'}</Text>
                      <Text style={{ fontSize: 6, color: '#9a3412', marginLeft: 6 }}>Mecanismo: {f.mecanismo || 'No especificado'}</Text>
                      <Text style={{ fontSize: 6, color: '#9a3412', marginLeft: 6 }}>Impacto: {f.impacto_organizacional || f.impacto || 'No especificado'}</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 7, color: '#7c2d12' }}>• {f}</Text>
                  )}
                </View>
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
              <Text style={{ fontSize: 7, color: '#7c3aed', fontWeight: 'bold', marginBottom: 4 }}>{labelLiderazgo}</Text>
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
            <Text style={styles.sectionTitle}>IV. Evaluación Psicométrica por Técnica (Personalidad)</Text>
            {renderFactores(DOMINIOS.PERSONALIDAD, sesBF)}
          </View>
        )}

        {hasC && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>V. Evaluación Psicométrica por Técnica (Cognitivo y Atención)</Text>
            {sesCog.length > 0 && (() => {
              let sumaCorrectas = 0
              let sumaTotal = 0
              let sumaPercentil = 0
              
              sesCog.forEach((s: any) => {
                const pb = s.puntaje_bruto || {};
                const corr = Number(pb.correctas || 0);
                const tot = Number(pb.total || 1);
                let perc = Number(pb.percentil);
                if (isNaN(perc) || !pb.hasOwnProperty('percentil')) {
                  perc = Math.round((corr / tot) * 100);
                }
                sumaCorrectas += corr;
                sumaTotal += tot;
                sumaPercentil += perc;
              });

              const normVal = sumaTotal > 0 ? Math.round((sumaCorrectas / sumaTotal) * 5 * 10) / 10 : 0;
              const perc = Math.round(sumaPercentil / sesCog.length);
              
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
            <Text style={styles.sectionTitle}>VI. Evaluación Psicométrica por Técnica (Competencias)</Text>
            {renderFactores(DOMINIOS.COMPETENCIAS, sesComp)}
          </View>
        )}

        {hasV && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VII. Evaluación Psicométrica por Técnica (Bienestar)</Text>
            {renderFactores(DOMINIOS.BIENESTAR, sesBien)}
          </View>
        )}

        {videos && videos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VIII. Análisis de Video-Entrevista y Discurso</Text>
            {videos.map((v: any, i: number) => (
              <View key={i} style={[styles.card, { marginBottom: 10 }]}>
                <Text style={styles.cardTitle}>Pregunta {i + 1}: {v.preguntas_video?.pregunta || 'Respuesta en Video'}</Text>
                <Text style={[styles.cardText, { color: '#64748b', marginBottom: 5 }]}>
                  Transcripción: "{v.transcripcion || 'Transcripción no disponible o en proceso de análisis...'}"
                </Text>
                {v.analisis_ia && (
                  <View style={{ marginTop: 5, padding: 5, backgroundColor: '#f0f4f8', borderRadius: 4 }}>
                    <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#1e40af', marginBottom: 2 }}>Análisis de Actitud e IA:</Text>
                    <Text style={{ fontSize: 8, color: '#334155', lineHeight: 1.3 }}>
                      {obtenerTextoAnalisis(v.analisis_ia)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {analisisFrases && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>IX. Análisis de Frases Incompletas (Sacks/Rotter)</Text>
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 }}>DINÁMICA INTELECTUAL Y LABORAL</Text>
                <Text style={styles.cardText}>{analisisFrases.analisisClinico?.dinamicaLaboral}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 }}>ACTITUD INTERPERSONAL Y AUTORIDAD</Text>
                <Text style={styles.cardText}>{analisisFrases.analisisClinico?.interpersonal}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 }}>MANEJO EMOCIONAL Y RESILIENCIA</Text>
                <Text style={styles.cardText}>{analisisFrases.analisisClinico?.emocional}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 }}>AUTOCONCEPTO Y VALORES</Text>
                <Text style={styles.cardText}>{analisisFrases.analisisClinico?.autoconcepto}</Text>
              </View>
            </View>

            {/* AUDITORÍA ORTOGRÁFICA */}
            <View style={[styles.card, { backgroundColor: analisisFrases.auditoriaOrtografica?.tieneErrores ? '#fff5f5' : '#f0fdf4', borderColor: analisisFrases.auditoriaOrtografica?.tieneErrores ? '#feb2b2' : '#bbf7d0' }]}>
              <Text style={{ fontSize: 7, fontWeight: 'bold', color: analisisFrases.auditoriaOrtografica?.tieneErrores ? '#c53030' : '#15803d', marginBottom: 4 }}>
                AUDITORÍA ORTOGRÁFICA Y DE REDACCIÓN: {analisisFrases.auditoriaOrtografica?.tieneErrores ? `${analisisFrases.auditoriaOrtografica.conteoErrores} Errores detectados` : 'Redacción Óptima'}
              </Text>
              {analisisFrases.auditoriaOrtografica?.tieneErrores ? (
                <View style={{ marginTop: 2 }}>
                  {analisisFrases.auditoriaOrtografica.detalles?.map((det: any, i: number) => (
                    <Text key={i} style={{ fontSize: 7, color: '#4a5568', marginBottom: 1 }}>
                      • Frase {det.frase}: palabra "{det.original}" corregida a "{det.corregida}" ({det.tipo})
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 7, color: '#166534' }}>El candidato demuestra excelente ortografía y dominio de las reglas ortográficas en todas sus respuestas redactadas.</Text>
              )}
            </View>

            {/* RECOMENDACIÓN DE GESTIÓN */}
            <View style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 6, marginTop: 5 }}>
              <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#818cf8', marginBottom: 2, textTransform: 'uppercase' }}>Guía Práctica de Gestión y Liderazgo</Text>
              <Text style={{ fontSize: 8, color: '#e2e8f0', lineHeight: 1.3 }}>{analisisFrases.conclusion?.recomendacionGestion}</Text>
            </View>

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

function obtenerInterpretacionLocal(factor: string, valor: number): string {
  const k = factor.toLowerCase().trim();
  const nivel = valor >= 4 ? 'alto' : valor >= 3 ? 'moderado' : 'bajo';
  
  const textos: Record<string, Record<string, string>> = {
    extraversion: {
      alto: 'Persona sociable, enérgica y orientada hacia el mundo externo. Disfruta del trabajo en equipo y los entornos dinámicos.',
      moderado: 'Equilibrio entre sociabilidad y reserva. Se adapta tanto a trabajos en equipo como a tareas individuales.',
      bajo: 'Persona reservada y reflexiva. Prefiere entornos tranquilos y el trabajo independiente.'
    },
    amabilidad: {
      alto: 'Alta orientación hacia los demás, cooperativa y empática. Facilita el trabajo en equipo y las relaciones interpersonales.',
      moderado: 'Equilibrio entre cooperación y asertividad. Puede trabajar bien con otros sin perder independencia de criterio.',
      bajo: 'Persona directa y orientada a resultados. Puede ser más competitiva que colaborativa.'
    },
    responsabilidad: {
      alto: 'Alta organización, disciplina y orientación al logro. Cumple compromisos y mantiene altos estándares de trabajo.',
      moderado: 'Nivel adecuado de organización y compromiso. Puede adaptarse a distintos niveles de estructura.',
      bajo: 'Estilo flexible y espontáneo. Puede tener dificultades con tareas que requieren alta planificación.'
    },
    neuroticismo: {
      alto: 'Mayor estabilidad emocional y resiliencia. Maneja de manera adecuada la presión y los entornos de alta demanda.',
      moderado: 'Respuesta emocional equilibrada ante el estrés. Maneja bien la mayoría de las situaciones laborales.',
      bajo: 'Mayor sensibilidad emocional y tendencia a experimentar estrés. Puede requerir entornos de trabajo estables.'
    },
    apertura: {
      alto: 'Alta curiosidad intelectual, creatividad y apertura al cambio. Destaca en roles que requieren innovación.',
      moderado: 'Equilibrio entre creatividad y pragmatismo. Se adapta tanto a entornos estructurados como creativos.',
      bajo: 'Preferencia por métodos conocidos y entornos predecibles. Destaca en roles con procesos claros y definidos.'
    },
    honestidad: {
      alto: 'Muestra una actitud de sinceridad y franqueza en su estilo de trabajo, prefiriendo la transparencia en sus interacciones.',
      moderado: 'Mantiene un estilo de comunicación honesto y adecuado a las demandas del entorno profesional.',
      bajo: 'Presenta posibles tendencias a la reserva o a omitir detalles para evitar la confrontación o favorecer la aceptación.'
    },
    normas: {
      alto: 'Alto apego a normas y ética profesional. Respeta los procedimientos establecidos de forma consistente.',
      moderado: 'Cumple con los reglamentos y normas generales del entorno de trabajo.',
      bajo: 'Riesgo de omitir o flexibilizar normas organizacionales en beneficio de la rapidez o la comodidad personal.'
    },
    promedio_general: {
      alto: 'Demuestra una sólida base ética general y alta consistencia en sus valores profesionales.',
      moderado: 'Muestra un desempeño ético y funcional acorde a los requerimientos estándar del puesto.',
      bajo: 'Se aprecian desvíos o inconsistencias en los indicadores generales de probidad. Se sugeriría validar detalladamente.'
    },
    metricas_fraude: {
      alto: 'El perfil de respuestas muestra un nivel normal y honesto de autorreporte, libre de fingimiento.',
      moderado: 'Muestra un perfil de respuestas aceptable, con baja influencia de deseabilidad social.',
      bajo: 'Nivel crítico de deseabilidad social. El candidato pudo haber manipulado sus respuestas para agradar al evaluador.'
    },
    burnout: {
      alto: 'Presenta una muy baja propensión a experimentar agotamiento, gestionando su energía de manera efectiva.',
      moderado: 'Nivel controlado de cansancio. Mantiene un ritmo operativo razonable.',
      bajo: 'Muestra señales de desgaste o agotamiento percibido. Se beneficia de revisión de tareas y apoyo.'
    },
    equilibrio: {
      alto: 'Demuestra una capacidad para mantener un sano balance entre sus responsabilidades laborales y su bienestar personal.',
      moderado: 'Mantiene un equilibrio adecuado en situaciones ordinarias de trabajo.',
      bajo: 'Se observa una afectación en el balance vida-trabajo, lo que puede influir en su salud laboral a mediano plazo.'
    },
    relaciones: {
      alto: 'La persona tiende a establecer vínculos cordiales y a mantener un ambiente de trabajo armonioso.',
      moderado: 'Se relaciona de forma profesional y correcta con sus compañeros.',
      bajo: 'Puede experimentar fricciones o dificultades de comunicación con compañeros y superiores.'
    },
    claridad_rol: {
      alto: 'Muestra una excelente comprensión de sus tareas y responsabilidades del puesto.',
      moderado: 'Comprende adecuadamente sus funciones generales, aunque requiere aclaraciones de vez en cuando.',
      bajo: 'Siente confusión o falta de claridad respecto a las expectativas de su puesto. Se beneficia de una guía estructurada.'
    },
    nivel_estres: {
      alto: 'Bajo nivel de tensión psicológica percibido. Afronta de forma serena el entorno laboral.',
      moderado: 'Nivel de tensión estándar del puesto. Manejo adaptativo en el día a día.',
      bajo: 'Alta tensión psicológica percibida. Afronta altos niveles de estrés que pueden condicionar su desempeño.'
    },
    carga_laboral: {
      alto: 'Manejo eficiente de las cargas de trabajo. Percibe las demandas como razonables.',
      moderado: 'Afronta las cargas habituales con normalidad, pudiendo requerir apoyos puntuales.',
      bajo: 'Percibe una alta sobrecarga en las demandas de su puesto. Requiere revisión de procesos.'
    }
  };

  return textos[k]?.[nivel] || 'Muestra un desempeño funcional acorde a los requerimientos del cargo evaluado.';
}
