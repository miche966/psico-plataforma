import { NextResponse } from 'next/server'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { candidatoIdsEnProcesos } from '@/lib/server/procesoScope'

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
    const results = await Promise.all(
      chunks.map(chunk =>
        db.from('sesiones')
          .select('id, test_id, candidato_id, proceso_id, estado, finalizada_en, puntaje_bruto')
          .in('candidato_id', chunk)
      )
    )
    for (const res of results) {
      if (res.error) throw res.error
      if (res.data) sesiones = sesiones.concat(res.data)
    }

    return NextResponse.json({ candidatos: candidatos || [], sesiones })
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
      const { data: existente, error: dupError } = await db
        .from('candidatos')
        .select('id, nombre, apellido, email')
        .or(`email.ilike.${email},documento.eq.${documento}`)
        .maybeSingle()
      if (dupError) throw dupError
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

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error) {
    console.error('[admin/candidatos POST]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 })
  }
}
