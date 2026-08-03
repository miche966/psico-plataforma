import React from 'react';
import { Page, Text as PDFText, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { normalizarPuntaje, colorPuntaje, interpretacionVigente } from '@/lib/puntajes';
import { obtenerNarrativaFactor } from '@/lib/interpretaciones/narrativasFactor';

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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: '#f5f3ff', padding: 8, borderRadius: 6, alignItems: 'center', border: '1px solid #ddd6fe' }}>
              <Text style={{ fontSize: 6, color: '#7c3aed', fontWeight: 'bold', marginBottom: 4 }}>{labelLiderazgo}</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#7c3aed' }}>{inf.liderazgo || 0}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#fff7ed', padding: 8, borderRadius: 6, alignItems: 'center', border: '1px solid #ffedd5' }}>
              <Text style={{ fontSize: 6, color: '#ea580c', fontWeight: 'bold', marginBottom: 4 }}>ADAPTABILIDAD</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#ea580c' }}>{inf.adaptabilidad || 0}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#fef2f2', padding: 8, borderRadius: 6, alignItems: 'center', border: '1px solid #fee2e2' }}>
              <Text style={{ fontSize: 6, color: '#dc2626', fontWeight: 'bold', marginBottom: 4 }}>RESILIENCIA</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#dc2626' }}>{inf.resiliencia || 0}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#ecfdf5', padding: 8, borderRadius: 6, alignItems: 'center', border: '1px solid #d1fae5' }}>
              <Text style={{ fontSize: 6, color: '#059669', fontWeight: 'bold', marginBottom: 4 }}>COLABORACIÓN</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#059669' }}>{inf.colaboracion || 0}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#f0f9ff', padding: 8, borderRadius: 6, alignItems: 'center', border: '1px solid #e0f2fe' }}>
              <Text style={{ fontSize: 6, color: '#0284c7', fontWeight: 'bold', marginBottom: 4 }}>COMUNICACIÓN</Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0284c7' }}>{inf.comunicacion || 0}</Text>
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
  return obtenerNarrativaFactor(factor, valor) || 'Muestra un desempeño funcional acorde a los requerimientos del cargo evaluado.';
}
