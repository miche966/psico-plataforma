import React from 'react';
import { Page, Text as PDFText, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { normalizarPuntaje, colorPuntaje, interpretacionVigente } from '@/lib/puntajes';

// Registro de fuentes para un look premium
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxP.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/roboto/v20/KFOlCnqEu92Fr1MmWUlfBBc9.ttf', fontWeight: 700 },
  ],
});

// Bug conocido de @react-pdf/renderer + Roboto: la ligadura tipográfica "fi"/"fl" pierde
// la segunda letra al renderizar (https://github.com/diegomura/react-pdf/issues/2762).
// Insertar un caracter invisible (ZWNJ) no funciona: esta fuente lo trata como glifo
// faltante y deja un hueco visible. La solucion sin efectos visuales es partir el texto
// justo entre "f" e "i"/"l" en Text hijos independientes: cada uno se mide por separado,
// asi el shaper nunca ve la secuencia "fi"/"fl" contigua y no arma la ligadura.
// Se desactiva ademas el guionado automatico para que el salto de linea no elija justo
// ese punto de corte (evita fragmentos de una sola letra como "f-" al final de renglon).
Font.registerHyphenationCallback(word => [word]);

function partirLigaduras(texto: string): string[] {
  const partes: string[] = []
  let lastIndex = 0
  const re = /f(?=[il])/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) {
    partes.push(texto.slice(lastIndex, m.index + 1))
    lastIndex = m.index + 1
  }
  partes.push(texto.slice(lastIndex))
  return partes.filter(p => p.length > 0)
}
function evitarLigaduras(valor: React.ReactNode): React.ReactNode {
  if (typeof valor === 'string') return partirLigaduras(valor).map((parte, i) => <PDFText key={i}>{parte}</PDFText>)
  if (Array.isArray(valor)) return valor.map(evitarLigaduras)
  return valor
}
function Text({ children, ...props }: any) {
  return <PDFText {...props}>{evitarLigaduras(children)}</PDFText>
}

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

import { ETQ } from '@/lib/labels';


const DOMINIOS = {
  PERSONALIDAD: ['extraversion', 'amabilidad', 'responsabilidad', 'neuroticismo', 'apertura', 'honestidad_humildad', 'honestidad', 'normas', 'promedio_general', 'logro', 'dinamismo'],
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

  const clrOf = (v: number) => colorPuntaje(v);

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
      const vNorm = Math.round(normalizarPuntaje(valor, factor) * 10) / 10;
      const clr = clrOf(vNorm);
      const fk = `${sid}_${factor}`;

      // Narrativas fallback e integración con IA profunda
      const desc = interpretacionVigente(inf)
        ? (inf.interpretacionPorFactor?.[fk] || inf.interpretacionPorFactor?.[factor.toLowerCase()] || obtenerInterpretacionLocal(factor, vNorm))
        : obtenerInterpretacionLocal(factor, vNorm);

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
          <Text style={styles.sectionTitle}>I. Evaluacion General y Ajuste al Puesto</Text>
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
              <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#16a34a', marginBottom: 4 }}>FORTALEZAS PRINCIPALES</Text>
              {(inf.fortalezas || []).map((f: any, i: number) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  {typeof f === 'object' ? (
                    <>
                      <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#14532d' }}>• {f.tendencia || f.competencia || f.titulo || f.nombre || f.fortaleza || 'Fortaleza'}</Text>
                      <Text style={{ fontSize: 6, color: '#166534', marginLeft: 6 }}>Qué se observa: {f.mecanismo || f.descripcion || f.queSeObserva || f.observacion || 'No especificado'}</Text>
                      <Text style={{ fontSize: 6, color: '#166534', marginLeft: 6 }}>Qué puede aportar: {f.impacto_organizacional || f.impacto || f.valor || f.consecuencia || f.quePuedeAportar || 'No especificado'}</Text>
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
                      <Text style={{ fontSize: 6, color: '#9a3412', marginLeft: 6 }}>Qué se observa: {f.mecanismo || f.descripcion || f.queSeObserva || f.observacion || 'No especificado'}</Text>
                      <Text style={{ fontSize: 6, color: '#9a3412', marginLeft: 6 }}>Qué puede aportar: {f.impacto_organizacional || f.impacto || f.valor || f.consecuencia || f.quePuedeAportar || 'No especificado'}</Text>
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
          <Text style={styles.sectionTitle}>II. Controles del proceso</Text>
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
          <Text style={styles.sectionTitle}>III. Habilidades para el trabajo</Text>
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
            <Text style={styles.sectionTitle}>IV. Resultados de la evaluacion (Personalidad)</Text>
            {renderFactores(DOMINIOS.PERSONALIDAD, sesBF)}
          </View>
        )}

        {hasC && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>V. Resultados de la evaluacion (Atencion y tareas)</Text>
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
            <Text style={styles.sectionTitle}>VI. Resultados de la evaluacion (Competencias)</Text>
            {renderFactores(DOMINIOS.COMPETENCIAS, sesComp)}
          </View>
        )}

        {hasV && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VII. Resultados de la evaluacion (Bienestar)</Text>
            {renderFactores(DOMINIOS.BIENESTAR, sesBien)}
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
          <Text style={styles.footerText} render={({ pageNumber, totalPages }: { pageNumber: number, totalPages: number }) => `Página ${pageNumber} de ${totalPages}`} fixed />
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
    logro: {
      alto: 'Fuerte orientación al logro. Se fija metas exigentes, se entrega a las tareas y busca activamente superar lo esperado.',
      moderado: 'Nivel adecuado de orientación al logro. Cumple con lo que se le pide y responde bien ante exigencias puntuales.',
      bajo: 'Menor motivación de logro autoreportada. Puede requerir objetivos y seguimiento más explícitos para sostener el esfuerzo.'
    },
    dinamismo: {
      alto: 'Alto nivel de energía y actividad. Se mantiene ocupado, reacciona rápido y puede sostener varios frentes a la vez.',
      moderado: 'Ritmo de trabajo equilibrado. Se adapta tanto a tareas que exigen rapidez como a otras más pausadas.',
      bajo: 'Estilo más pausado y reflexivo. Prefiere avanzar a un ritmo propio antes que bajo presión constante.'
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
      alto: 'Se maneja con tranquilidad frente a la presión del día a día. Las demandas externas no le generan sobresaltos y mantiene un ritmo de trabajo estable.',
      moderado: 'Maneja bien la tensión habitual del trabajo, aunque en momentos de mayor exigencia agradece poder tomarse una pausa para reordenarse.',
      bajo: 'Actualmente convive con un nivel de tensión más alto de lo deseable, lo que puede afectar su claridad para tomar decisiones en el día a día. Un entorno con rutinas previsibles y objetivos bien delimitados lo ayudaría a recuperar el equilibrio y sostener su rendimiento habitual.'
    },
    carga_laboral: {
      alto: 'Siente que el volumen de trabajo actual le queda cómodo y tiene margen para sumar tareas o desafíos nuevos.',
      moderado: 'Organiza bien la carga de trabajo que le toca, ajustando prioridades sin que esto afecte la calidad de lo que entrega.',
      bajo: 'Percibe que el volumen de tareas actual supera su capacidad de organización, lo que puede derivar en demoras o en la sensación de estar siempre "atrás". Definir prioridades junto a su líder directo lo ayudaría a ordenar la carga y recuperar margen de acción.'
    },
    documentos: {
      alto: 'Destaca por un manejo prolijo y ordenado de los activos documentales y registros administrativos. Su capacidad para organizar volúmenes de datos asegura que la información sea tratada con rigor, facilitando un entorno operativo fluido y fortaleciendo la calidad de la gestión administrativa interna.',
      moderado: 'Muestra un cuidado profesional adecuado en la organización y revisión de documentos. Mantiene un estándar de orden constante, logrando procesar la información con claridad y criterio, lo que asegura que las tareas de soporte avancen sin contratiempos.',
      bajo: 'En tareas que exigen un rigor sistemático extremo en la gestión de archivos, se beneficiará del apoyo de listas de verificación. Su enfoque tiende a ser más ágil que detallista, por lo que una revisión de cierre asegurará la integridad total de los registros.'
    },
    comparacion: {
      alto: 'Manifiesta una notable agilidad en el procesamiento y reconocimiento de patrones. Logra contrastar información y detectar discrepancias con una fluidez que optimiza los tiempos de respuesta, aportando una alta efectividad en tareas que demandan validación constante.',
      moderado: 'Demuestra un ritmo de ejecución equilibrado que le permite abordar tareas habituales con una fluidez adecuada. Es capaz de contrastar información de manera efectiva, manteniendo una cadencia estable que asegura la calidad del resultado final.',
      bajo: 'Tiende a procesar la comparación de datos de forma más pausada para asegurar la exactitud. Su desempeño mejora en entornos que no dependan de una respuesta inmediata, permitiéndole realizar una revisión más deliberada de la información.'
    },
    concentracion: {
      alto: 'Posee una capacidad de enfoque sostenido y constante, incluso en entornos con múltiples estímulos. Su atención se mantiene estable durante periodos prolongados, lo que le permite completar tareas complejas manteniendo un estándar de calidad homogéneo.',
      moderado: 'Mantiene un nivel de atención funcional durante la jornada. Logra enfocarse en sus objetivos a pesar de las distracciones comunes, asegurando una ejecución estable en sus responsabilidades diarias de manera profesional.',
      bajo: 'Muestra un estilo de atención que puede fluctuar ante entornos de alta estimulación. Se beneficia de espacios de trabajo organizados que favorezcan la inmersión en la tarea, minimizando así el impacto de las distracciones en su desempeño.'
    },
    errores_texto: {
      alto: 'Se identifica una notable minuciosidad en el procesamiento de información escrita y registros de texto. Su habilidad para identificar inconsistencias garantiza que la comunicación institucional sea presentada con un estándar de calidad constante, protegiendo la integridad de los reportes.',
      moderado: 'Es capaz de producir y revisar documentos con un nivel de corrección profesional claro. Detecta los errores comunes y mantiene una coherencia narrativa lógica, asegurando que las comunicaciones cumplan con los parámetros de claridad esperados.',
      bajo: 'Su enfoque se centra principalmente en la agilidad de la comunicación. Para asegurar la precisión absoluta en la redacción de informes críticos, se recomienda una revisión final o el uso de herramientas de soporte que garanticen la consistencia de los textos.'
    },
    errores_numeros: {
      alto: 'Demuestra un manejo seguro y criterioso de la información cuantitativa. Su enfoque en el cálculo y la transcripción de datos numéricos asegura una consistencia sólida en los reportes de gestión, aportando fiabilidad a los procesos de alta exactitud.',
      moderado: 'Maneja la información cuantitativa con seguridad y criterio profesional. Realiza cálculos y transcripciones con una baja incidencia de errores en condiciones normales, contribuyendo a la estabilidad y orden de los reportes del área.',
      bajo: 'Ante volúmenes moderados de datos numéricos, su precisión mejora con una validación secundaria. Se beneficia de metodologías de trabajo pautadas que le permitan mantener el rigor en tareas que impliquen indicadores críticos de gestión.'
    },
    comunicacion: {
      alto: 'Transmite información de manera clara y estructurada, facilitando el intercambio de datos entre áreas con fluidez. Su discurso se adapta a los requerimientos del entorno, lo que asegura que los objetivos sean comprendidos con precisión y sin ambigüedades.',
      moderado: 'Logra transmitir información de manera efectiva y profesional, asegurando que los mensajes clave lleguen a su destino con claridad. Posee habilidades de escucha activa que le permiten interactuar de forma constructiva con su entorno laboral.',
      bajo: 'Se recomienda fortalecer la estructura de sus mensajes para asegurar la total claridad en la transmisión de datos. El uso de canales de comunicación pautados garantizaría que sus interacciones mantengan la efectividad en procesos dinámicos.'
    },
    liderazgo: {
      alto: 'Muestra una sólida facultad para coordinar procesos y guiar la ejecución de tareas bajo estándares de calidad. Su enfoque se centra en el cumplimiento de objetivos organizando el flujo de trabajo de manera que se optimicen los recursos y el tiempo del equipo.',
      moderado: 'Actúa como un referente operativo que facilita la ejecución de tareas y apoya la estabilidad del grupo. Posee un estilo de influencia funcional que permite mantener la cohesión y el avance de las metas diarias bajo directrices claras.',
      bajo: 'Manifiesta una marcada preferencia por roles de ejecución individual y autónoma. Se beneficiará de un acompañamiento que le permita desarrollar progresivamente habilidades de gestión de equipos y toma de decisiones compartidas.'
    },
    trabajo_equipo: {
      alto: 'Se integra a la dinámica grupal de forma proactiva, favoreciendo un clima de confianza y soporte mutuo. Su enfoque fomenta la sinergia organizacional, asegurando que el cumplimiento de los objetivos colectivos se realice con una productividad estable.',
      moderado: 'Participa de forma colaborativa en el equipo, cumpliendo con sus responsabilidades técnicas y manteniendo una interacción profesional cordial. Facilita que los proyectos compartidos avancen con fluidez, respetando siempre los acuerdos del grupo.',
      bajo: 'Tiende a priorizar el trabajo autónomo sobre la interdependencia. Se recomienda su integración en proyectos colaborativos que le permitan fortalecer su sentido de pertenencia y desarrollar una mayor agilidad en el intercambio con pares.'
    },
    adaptabilidad: {
      alto: 'Posee una notable facultad para ajustar su ritmo de trabajo ante cambios en las prioridades del área. Su flexibilidad le permite transitar modificaciones operativas manteniendo la calidad de su ejecución técnica y asegurando la continuidad de los resultados.',
      moderado: 'Logra asimilar cambios en procesos y estructuras organizacionales de manera profesional, mostrando una apertura constructiva hacia las nuevas metodologías necesarias para la evolución del negocio.',
      bajo: 'Muestra una preferencia por rutinas operativas estables y predecibles. Se beneficia de una gestión del cambio estructurada y comunicada con antelación, lo que le permite adaptarse con mayor seguridad a las nuevas demandas del entorno.'
    },
    resolucion_problemas: {
      alto: 'Utiliza criterios lógicos y un enfoque práctico para identificar la raíz de desafíos operativos. Su análisis facilita soluciones que no solo resuelven la urgencia, sino que aportan mejoras al proceso para prevenir recurrencias de manera efectiva.',
      moderado: 'Es capaz de resolver inconvenientes operativos de manera autónoma utilizando su experiencia y criterio profesional. Muestra iniciativa para destrabar situaciones que impiden el avance de sus tareas diarias con seguridad.',
      bajo: 'Tiende a requerir guías claras para abordar situaciones que se alejan de su rutina habitual. Se recomienda el desarrollo de metodologías de análisis de problemas para ganar mayor autonomía y agilidad resolutiva ante imprevistos.'
    },
    etica: {
      alto: 'Demuestra un compromiso sólido con la integridad y el manejo responsable de la información. Su estilo de trabajo se alinea con los estándares institucionales, mitigando riesgos operativos mediante un apego consistente a los protocolos del área.',
      moderado: 'Mantiene un comportamiento profesional alineado con las normas y la cultura organizacional. Su criterio permite tomar decisiones equilibradas que aseguran la transparencia y la confianza en la ejecución de sus responsabilidades diarias.',
      bajo: 'Se recomienda reforzar el conocimiento de los protocolos específicos de integridad del cargo. Una guía cercana le permitirá alinear sus acciones con los estándares de transparencia requeridos por la organización de manera más sólida.'
    },
    negociacion: {
      alto: 'Utiliza argumentos fundamentados para alcanzar acuerdos que aseguren la fluidez operativa. Su enfoque facilita la resolución de diferencias mediante criterios prácticos, preservando siempre la calidad de los vínculos profesionales y el objetivo común.',
      moderado: 'Posee habilidades de comunicación que le permiten llegar a consensos en la operativa diaria. Logra representar los intereses del área de forma profesional, mostrando la flexibilidad necesaria cuando el éxito del proyecto así lo requiere.',
      bajo: 'Muestra preferencia por defender posturas técnicas fijas en situaciones de desacuerdo. Se beneficiaría de fortalecer sus habilidades de comunicación asertiva para facilitar el alcance de acuerdos constructivos en el día a día.'
    },
    manejo_emocional: {
      alto: 'Gestiona sus reacciones ante desafíos o conflictos laborales con profesionalismo y calma. Su estabilidad actúa como un factor de equilibrio que favorece la toma de decisiones objetivas y mantiene el foco en la tarea bajo situaciones de demanda.',
      moderado: 'Maneja el impacto de las demandas laborales de manera estable, asegurando que las variables externas no afecten su desempeño técnico. Es capaz de mantener un trato profesional y cordial incluso ante periodos de actividad intensa.',
      bajo: 'Ante situaciones de alta presión, su estilo de respuesta puede verse influenciado por la tensión del momento. Se beneficia de entornos predecibles y de una estructura de apoyo que le permita recuperar su objetividad de forma rápida.'
    },
    tolerancia_frustracion: {
      alto: 'Mantiene el ritmo de ejecución previsto ante el aumento en el volumen de tareas o demoras en los resultados esperados. Su respuesta profesional se mantiene estable, capitalizando los obstáculos como una oportunidad para el ajuste de procesos y la mejora continua.',
      moderado: 'Muestra una capacidad adecuada para recuperarse ante fallos operativos, manteniendo su compromiso con las metas pendientes. Logra retomar sus funciones con profesionalismo una vez superado el inconveniente detectado.',
      bajo: 'La gestión de los reveses operativos es un área que se beneficia de un acompañamiento cercano. Mantiene su compromiso, aunque requiere pautas claras para recuperar la fluidez en sus funciones tras resultados imprevistos.'
    }
  };

  return textos[k]?.[nivel] || 'Muestra un desempeño funcional acorde a los requerimientos del cargo evaluado.';
}
