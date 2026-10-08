import React from 'react'
import { Page, View, Document, StyleSheet } from '@react-pdf/renderer'
import { Text } from '@/components/pdfBase'
import { MarcaPDF } from '@/components/MarcaPDF'
import { SECCIONES_SUPERVISOR, type InformeSupervisor } from '@/lib/informeSupervisor'

// PDF del informe para supervisores: sin puntajes, sin datos tecnicos, sin dictamen. Misma marca y pie que el informe tecnico.

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 44, paddingBottom: 75, fontFamily: 'Roboto', backgroundColor: '#ffffff', fontSize: 10, color: '#1e293b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22, borderBottomWidth: 2, borderBottomColor: '#0f172a', paddingBottom: 10 },
  headerSubtitle: { fontSize: 9, color: '#64748b', marginTop: 2 },
  headerDate: { fontSize: 8, color: '#64748b' },
  nombre: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 3 },
  puesto: { fontSize: 10, color: '#475569', marginBottom: 2 },
  aviso: { marginTop: 8, marginBottom: 4, padding: 6, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 4, fontSize: 8, color: '#92400e' },
  seccion: { marginTop: 18 },
  titulo: { fontSize: 11, fontWeight: 'bold', color: '#0f172a', borderLeftWidth: 3, borderLeftColor: '#17594E', paddingLeft: 7, marginBottom: 6 },
  texto: { fontSize: 10, lineHeight: 1.55, color: '#334155' },
  footer: { position: 'absolute', bottom: 30, left: 44, right: 44, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7, color: '#94a3b8' },
  nota: { marginTop: 24, fontSize: 8, color: '#64748b', lineHeight: 1.4 },
})

export interface DatosInformeSupervisor {
  nombre: string
  cargo: string | null
  proceso: string | null
  /** Fecha de publicacion (ISO) o null si todavia no esta publicado. */
  fecha: string | null
  informe: InformeSupervisor
  /** Vista previa de un borrador: lleva un aviso para que no se tome por el documento final. */
  borrador?: boolean
}

export default function InformeSupervisorPDF({ datos }: { datos: DatosInformeSupervisor }) {
  const fecha = datos.fecha ? new Date(datos.fecha) : null
  const fechaTexto = fecha && !Number.isNaN(fecha.getTime()) ? fecha.toLocaleDateString('es-UY') : new Date().toLocaleDateString('es-UY')
  return (
    <Document title={`Informe para la incorporación - ${datos.nombre}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View><MarcaPDF fontSize={18} /><Text style={styles.headerSubtitle}>Informe para la incorporación</Text></View>
          <Text style={styles.headerDate}>{fechaTexto}</Text>
        </View>

        <Text style={styles.nombre}>{datos.nombre}</Text>
        {datos.cargo ? <Text style={styles.puesto}>Puesto: {datos.cargo}</Text> : null}
        {datos.proceso ? <Text style={styles.puesto}>Proceso: {datos.proceso}</Text> : null}
        {datos.borrador ? <Text style={styles.aviso}>Vista previa: este informe todavía no está publicado, el supervisor aún no lo ve.</Text> : null}

        {SECCIONES_SUPERVISOR.map(s => {
          const contenido = datos.informe[s.clave]
          if (!contenido) return null
          return (
            <View key={s.clave} style={styles.seccion} wrap={false}>
              <Text style={styles.titulo}>{s.titulo}</Text>
              <Text style={styles.texto}>{contenido}</Text>
            </View>
          )
        })}

        <Text style={styles.nota}>Informe orientativo para acompañar la incorporación. No reemplaza el criterio de quien conduce al equipo. Confidencial: no compartir fuera de la empresa.</Text>

        <View style={styles.footer} fixed>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MarcaPDF fontSize={8} color="#475569" />
            <Text style={[styles.footerText, { marginLeft: 8 }]}>Documento confidencial</Text>
          </View>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}`} fixed />
        </View>
      </Page>
    </Document>
  )
}
