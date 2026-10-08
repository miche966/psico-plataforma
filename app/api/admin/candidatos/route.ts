import { NextResponse } from 'next/server'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { candidatoIdsEnProcesos } from '@/lib/server/procesoScope'
import { eliminarCandidato, resumenDeEliminacion } from '@/lib/server/eliminarCandidato'
import { registrarAcceso } from '@/lib/server/registroAccesos'
import { leerResumenes, resumenesVisibles } from '@/lib/server/resumenesIa'

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response

  try {
    const db = createSupabaseAdmin()
    const { data: candidatosSinFiltrar, error } = await db
      .from('candidatos')
      .select('*')
      .order('creado_en', { ascending: false })
    if (error) throw error

    let candidatos = candidatosSinFiltrar || []
    if (auth.role === 'viewer') {
      const idsPermitidos = await candidatoIdsEnProcesos(db, auth.allowedProcesoIds)
      candidatos = candidatos.filter((c: any) => idsPermitidos.has(c.id))
    }

    // Chunk candidate IDs to avoid the 1000-row PostgREST select limit in Supabase
    const candidateIds = candidatos.map((c: any) => c.id)
    const chunkSize = 50
    const chunks: string[][] = []
    for (let i = 0; i < candidateIds.length; i += chunkSize) {
      chunks.push(candidateIds.slice(i, i + chunkSize))
    }

    let sesiones: any[] = []
    // Para un viewer, ademas de recortar candidatos, se recortan sus sesiones: un candidato de un
    // proceso permitido puede tener sesiones (con puntajes) en otros procesos que no le corresponden.
    const results = await Promise.all(
      chunks.map(chunk => {
        let consulta = db.from('sesiones')
          .select('id, test_id, candidato_id, proceso_id, estado, finalizada_en, puntaje_bruto')
          .in('candidato_id', chunk)
        if (auth.role === 'viewer') consulta = consulta.in('proceso_id', auth.allowedProcesoIds)
        return consulta
      })
    )
    for (const res of results) {
      if (res.error) throw res.error
      if (res.data) sesiones = sesiones.concat(res.data)
    }

    // Resumenes con IA ya guardados (los genera el Centro de control): la ficha ejecutiva los muestra sin gastar IA
    const resumenes = resumenesVisibles(
      await leerResumenes(db),
      new Set<string>(candidateIds),
      auth.role === 'viewer' ? new Set<string>(auth.allowedProcesoIds) : null,
    )
    const procesoIds = Array.from(new Set(resumenes.map(x => x.proceso_id).filter((id): id is string => !!id)))
    const nombres = new Map<string, string>()
    if (procesoIds.length > 0) {
      const { data: procs, error: procsError } = await db.from('procesos').select('id, nombre').in('id', procesoIds)
      if (procsError) console.error('[admin/candidatos GET] No se pudieron leer los nombres de proceso de los resumenes:', procsError.message)
      for (const p of procs || []) nombres.set(p.id, p.nombre)
    }
    const resumenesIa = resumenes.map(x => ({ ...x, proceso_nombre: x.proceso_id ? nombres.get(x.proceso_id) || null : null }))

    return NextResponse.json({ candidatos: candidatos || [], sesiones, resumenesIa })
  } catch (error) {
    console.error('[admin/candidatos GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar los candidatos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response
  const bloqueado = requireFullAdmin(auth)
  if (bloqueado) return bloqueado

  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const db = createSupabaseAdmin()

    if (action === 'resetear_sesiones') {
      const candidatoId = String(body.candidatoId || '')
      if (!candidatoId) return NextResponse.json({ error: 'Falta candidatoId' }, { status: 400 })
      const { error } = await db.from('sesiones').update({
        estado: 'en_progreso',
        finalizada_en: null
      }).eq('candidato_id', candidatoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'crear_candidato') {
      const nombres = String(body.nombres || '').trim()
      const apellidos = String(body.apellidos || '').trim()
      const email = String(body.email || '').trim().toLowerCase()
      const documento = String(body.documento || '').trim()
      if (!nombres || !apellidos || !email || !documento) {
        return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
      }
      // Dos consultas separadas en vez de interpolar email/documento en un .or(): ese texto es
      // sintaxis de filtro de PostgREST, un valor con coma o parentesis inyectaba clausulas (mismo
      // fix que /api/unirse).
      const { data: porEmail, error: emailError } = await db
        .from('candidatos').select('id, nombre, apellido, email').ilike('email', email).limit(1).maybeSingle()
      if (emailError) throw emailError
      const { data: porDocumento, error: docError } = await db
        .from('candidatos').select('id, nombre, apellido, email').eq('documento', documento).limit(1).maybeSingle()
      if (docError) throw docError
      const existente = porEmail || porDocumento
      if (existente) {
        return NextResponse.json({ error: `Ya existe un candidato con ese email o documento: ${existente.nombre} ${existente.apellido} (${existente.email})` }, { status: 409 })
      }
      const { error } = await db.from('candidatos').insert({
        nombre: nombres,
        apellido: apellidos,
        email,
        documento,
        edad: parseInt(body.edad) || null,
        sexo: String(body.sexo || ''),
        formacion: String(body.formacion || ''),
        profesion: String(body.profesion || '')
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'detectar_duplicados') {
      const candidatosRows: Array<{ id: string, nombre: string, apellido: string, email: string, documento: string }> = []
      const pageSize = 1000
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await db
          .from('candidatos')
          .select('id, nombre, apellido, email, documento')
          .range(offset, offset + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        candidatosRows.push(...data)
        if (data.length < pageSize) break
      }

      const porEmail = new Map<string, typeof candidatosRows>()
      const porDocumento = new Map<string, typeof candidatosRows>()
      candidatosRows.forEach(c => {
        const emailKey = (c.email || '').trim().toLowerCase()
        const docKey = (c.documento || '').trim()
        if (emailKey) {
          if (!porEmail.has(emailKey)) porEmail.set(emailKey, [])
          porEmail.get(emailKey)!.push(c)
        }
        if (docKey) {
          if (!porDocumento.has(docKey)) porDocumento.set(docKey, [])
          porDocumento.get(docKey)!.push(c)
        }
      })

      const gruposEmail = Array.from(porEmail.entries()).filter(([, rows]) => rows.length > 1).map(([email, rows]) => ({ email, candidatos: rows }))
      const gruposDocumento = Array.from(porDocumento.entries()).filter(([, rows]) => rows.length > 1).map(([documento, rows]) => ({ documento, candidatos: rows }))

      return NextResponse.json({ gruposEmail, gruposDocumento })
    }

    // Eliminar un candidato: primero se pide el resumen de lo que se borraria y despues se confirma escribiendo su nombre
    if (action === 'resumen_eliminacion' || action === 'eliminar_candidato') {
      const candidatoId = String(body.candidatoId || '')
      if (!ES_UUID.test(candidatoId)) return NextResponse.json({ error: 'Falta candidatoId' }, { status: 400 })
      if (action === 'resumen_eliminacion') {
        const resumen = await resumenDeEliminacion(db, candidatoId)
        if (!resumen) return NextResponse.json({ error: 'El candidato no existe' }, { status: 404 })
        return NextResponse.json({ resumen })
      }
      const resultado = await eliminarCandidato(db, candidatoId, body.confirmacion)
      if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
      await registrarAcceso(db, auth, { accion: 'eliminar_candidato', candidatoId }, request)
      return NextResponse.json({ success: true, eliminado: resultado.resumen })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error) {
    console.error('[admin/candidatos POST]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 })
  }
}
