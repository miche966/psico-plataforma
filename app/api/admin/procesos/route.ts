import { NextResponse } from 'next/server'
import { requireAdminSession, requireFullAdmin } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { readAll } from '@/lib/server/readAll'
import { candidatoIdsEnProcesos } from '@/lib/server/procesoScope'

export async function GET(req: Request) {
  try {
    const auth = await requireAdminSession(req)
    if (auth.response) return auth.response
    const db = createSupabaseAdmin()
    const procesoId = new URL(req.url).searchParams.get('proceso_id')

    if (procesoId) {
      if (auth.role === 'viewer' && !auth.allowedProcesoIds.includes(procesoId)) {
        return NextResponse.json({ error: 'No tenes acceso a este proceso' }, { status: 403 })
      }
      const [{ data: sesiones, error: sesionesError }, { data: candidatos, error: candidatosError }, { data: respuestasVideo, error: videosError }, { data: preguntasVideo, error: preguntasError }] = await Promise.all([
        db.from('sesiones').select('candidato_id, test_id, estado').eq('proceso_id', procesoId).not('candidato_id', 'is', null),
        db.from('candidatos').select('id, nombre, apellido, email'),
        db.from('respuestas_video').select('candidato_id, entrevista_id, pregunta_id').eq('estado', 'completado'),
        db.from('preguntas_video').select('id, entrevista_id, pregunta')
      ])
      if (sesionesError || candidatosError || videosError || preguntasError) throw sesionesError || candidatosError || videosError || preguntasError
      // Filtramos la lista global de candidatos al set real vinculado a este proceso (aplica siempre,
      // no solo para viewer -- esta rama ya recorta por proceso_id en sesiones, corresponde recortar igual el resto).
      const idsDelProceso = new Set((sesiones || []).map(s => s.candidato_id))
      const candidatosDelProceso = (candidatos || []).filter(c => idsDelProceso.has(c.id))
      return NextResponse.json({ sesiones: sesiones || [], candidatos: candidatosDelProceso, respuestasVideo: respuestasVideo || [], preguntasVideo: preguntasVideo || [] })
    }

    const [{ data, error }, { data: candidatos, error: candidatosError }, { data: entrevistas, error: entrevistasError }, sesiones, respuestasVideo] = await Promise.all([
      db.from('procesos').select('*').order('creado_en', { ascending: false }),
      db.from('candidatos').select('id, nombre, apellido, email').order('creado_en', { ascending: false }),
      db.from('entrevistas_video').select('*').order('creada_en', { ascending: false }),
      readAll(db, 'sesiones', '*'),
      readAll(db, 'respuestas_video', 'candidato_id, entrevista_id')
    ])
    if (error || candidatosError || entrevistasError) throw error || candidatosError || entrevistasError

    if (auth.role === 'viewer') {
      const procesosPermitidos = new Set(auth.allowedProcesoIds)
      const procesosFiltrados = (data || []).filter(p => procesosPermitidos.has(p.id))
      const sesionesFiltradas = (sesiones || []).filter(s => s.proceso_id && procesosPermitidos.has(s.proceso_id))
      const idsCandidatos = await candidatoIdsEnProcesos(db, auth.allowedProcesoIds)
      const candidatosFiltrados = (candidatos || []).filter(c => idsCandidatos.has(c.id))
      const respuestasFiltradas = (respuestasVideo || []).filter((r: any) => idsCandidatos.has(r.candidato_id))
      return NextResponse.json({ data: procesosFiltrados, candidatos: candidatosFiltrados, entrevistas: entrevistas || [], sesiones: sesionesFiltradas, respuestasVideo: respuestasFiltradas })
    }

    return NextResponse.json({ data: data || [], candidatos: candidatos || [], entrevistas: entrevistas || [], sesiones, respuestasVideo })
  } catch (error) {
    console.error('Error cargando procesos administrativos:', error)
    return NextResponse.json({ error: 'No se pudieron cargar los procesos' }, { status: 500 })
  }
}

const SLUG_TO_ID: Record<string, string> = {
  'bigfive': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'icar': 'f6a7b8c9-d0e1-2345-fabc-456789012345',
  'estres-laboral': 'd0e1f2a3-b4c5-6789-defa-000000000001',
  'creatividad': 'e1f2a3b4-c5d6-7890-efab-111222333444',
  'integridad': 'e5f6a7b8-c9d0-1234-efab-345678901234',
  'hexaco': 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'numerico': 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'verbal': 'd4e5f6a7-b8c9-0123-defa-234567890123',
  'sjt-ventas': 'a7b8c9d0-e1f2-3456-abcd-777777777777',
  'tolerancia-frustracion': 'e5f6a7b8-c9d0-1234-efab-555555555555',
  'sjt-problemas': 'f2a3b4c5-d6e7-8901-fabc-222333444555',
  'sjt-legal': 'c9d0e1f2-a3b4-5678-cdef-999999999999',
  'sjt-comercial': 'b2c3d4e5-f6a7-8901-bcde-222222222222',
  'comercial': 'a1b2c3d4-e5f6-7890-abcd-111111111111',
  'atencion-detalle': 'b8c9d0e1-f2a3-4567-bcde-888888888888',
  'sjt-atencion': 'f6a7b8c9-d0e1-2345-fabc-666666666666',
  'sjt-cobranzas': 'e9b2c3d4-f5a6-7890-bcde-999999999999',
  'dass21': '7a8b9c0d-e1f2-4356-abcd-999999999999',
  'iniciativa-dinamismo': '0b6ade42-0c8f-4084-a4a5-9ff7869d73b6',
  'frases-incompletas': 'f7a8b9c0-d1e2-4356-abcd-888888888888',
  'roleplay': 'd8e9f0a1-b2c3-4567-defa-888888888888',
  'roleplay_atencion': 'd8e9f0a1-b2c3-4567-defa-777777777777',
}

function testIdDesdeSlug(slug: string) {
  if (slug.startsWith('entrevista:')) return slug.split(':')[1]
  return SLUG_TO_ID[slug] || slug
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

    if (action === 'crear_proceso') {
      const { data, error } = await db.from('procesos').insert({
        nombre: body.nombre,
        cargo: body.cargo,
        descripcion: body.descripcion,
        descripcion_cargo: body.descripcion_cargo,
        competencias_requeridas: body.competencias_requeridas,
        activo: true,
        bateria_tests: body.bateria_tests
      }).select().single()
      if (error) throw error
      return NextResponse.json({ proceso: data })
    }

    if (action === 'actualizar_proceso') {
      const procesoId = String(body.procesoId || '')
      if (!procesoId) return NextResponse.json({ error: 'Falta procesoId' }, { status: 400 })
      const { error } = await db.from('procesos').update({
        nombre: body.nombre,
        cargo: body.cargo,
        descripcion: body.descripcion,
        descripcion_cargo: body.descripcion_cargo,
        competencias_requeridas: body.competencias_requeridas,
        bateria_tests: body.bateria_tests
      }).eq('id', procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'eliminar_proceso') {
      const procesoId = String(body.procesoId || '')
      if (!procesoId) return NextResponse.json({ error: 'Falta procesoId' }, { status: 400 })
      await db.from('sesiones').update({ proceso_id: null }).eq('proceso_id', procesoId)
      const { error } = await db.from('procesos').delete().eq('id', procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_estado') {
      const procesoId = String(body.procesoId || '')
      if (!procesoId) return NextResponse.json({ error: 'Falta procesoId' }, { status: 400 })
      const { error } = await db.from('procesos').update({ activo: Boolean(body.activo) }).eq('id', procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'asignar_candidato') {
      const candidatoId = String(body.candidatoId || '')
      const procesoId = String(body.procesoId || '')
      const slugPrimerTest = String(body.slugPrimerTest || 'control')
      if (!candidatoId || !procesoId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
      const testIdFinal = testIdDesdeSlug(slugPrimerTest)

      const { data: existe } = await db.from('sesiones').select('id').eq('candidato_id', candidatoId).eq('proceso_id', procesoId).limit(1)
      if (!existe || existe.length === 0) {
        const { error } = await db.from('sesiones').insert({
          candidato_id: candidatoId,
          proceso_id: procesoId,
          test_id: testIdFinal,
          estado: 'pendiente'
        })
        if (error) throw error
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'desvincular_candidato') {
      const candidatoId = String(body.candidatoId || '')
      const procesoId = String(body.procesoId || '')
      if (!candidatoId || !procesoId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
      const { error } = await db.from('sesiones').update({ proceso_id: null }).eq('candidato_id', candidatoId).eq('proceso_id', procesoId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'reparar_vinculos') {
      const procesoId = String(body.procesoId || '')
      const slugPrimerTest = String(body.slugPrimerTest || 'control')
      if (!procesoId) return NextResponse.json({ error: 'Falta procesoId' }, { status: 400 })
      const testIdFinal = testIdDesdeSlug(slugPrimerTest)

      const { data: candidatos, error: candidatosError } = await db.from('candidatos').select('id')
      if (candidatosError) throw candidatosError

      const sesionesNuevas = (candidatos || []).map((c: any) => ({
        candidato_id: c.id,
        proceso_id: procesoId,
        test_id: testIdFinal,
        estado: 'pendiente'
      }))
      const { error } = await db.from('sesiones').upsert(sesionesNuevas, { onConflict: 'candidato_id,proceso_id' })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'carga_masiva') {
      const candidatosParaCargar = Array.isArray(body.candidatos) ? body.candidatos : []
      const procesoId = String(body.procesoId || '')
      if (!candidatosParaCargar.length) return NextResponse.json({ error: 'Sin candidatos para cargar' }, { status: 400 })

      const emails = candidatosParaCargar.map((c: any) => c.email)
      const { data: existentes, error: existentesError } = await db.from('candidatos').select('*').in('email', emails)
      if (existentesError) throw existentesError

      const emailsExistentes = new Set((existentes || []).map((e: any) => e.email))
      const nuevosParaInsertar = candidatosParaCargar.filter((c: any) => !emailsExistentes.has(c.email))

      let todosLosCandidatos = existentes || []
      if (nuevosParaInsertar.length > 0) {
        const { data: insertados, error: insertError } = await db.from('candidatos').insert(nuevosParaInsertar).select()
        if (insertError) throw insertError
        if (insertados) todosLosCandidatos = [...todosLosCandidatos, ...insertados]
      }

      if (procesoId && todosLosCandidatos.length > 0) {
        const slugPrimerTest = String(body.slugPrimerTest || 'control')
        const testIdFinal = testIdDesdeSlug(slugPrimerTest)

        const { data: sesionesActuales } = await db.from('sesiones').select('candidato_id').eq('proceso_id', procesoId)
        const idsConSesion = new Set((sesionesActuales || []).map((s: any) => s.candidato_id))

        const sesionesNuevas = todosLosCandidatos
          .filter((c: any) => !idsConSesion.has(c.id))
          .map((c: any) => ({ candidato_id: c.id, proceso_id: procesoId, test_id: testIdFinal, estado: 'pendiente' }))

        if (sesionesNuevas.length > 0) {
          const { error: sesionesError } = await db.from('sesiones').insert(sesionesNuevas)
          if (sesionesError) throw sesionesError
        }
      }

      return NextResponse.json({ success: true, total: todosLosCandidatos.length })
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error: any) {
    console.error('[admin/procesos POST]', error)
    return NextResponse.json({ error: error?.message || 'No se pudo completar la operación' }, { status: 500 })
  }
}