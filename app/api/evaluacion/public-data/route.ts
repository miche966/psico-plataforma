import { NextResponse } from 'next/server'
import { validarTokenEvaluacion } from '@/lib/server/evaluacionToken'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

const TEST_IDS = new Set([
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'f6a7b8c9-d0e1-2345-fabc-456789012345',
  'd0e1f2a3-b4c5-6789-defa-000000000001', 'e1f2a3b4-c5d6-7890-efab-111222333444',
  'e5f6a7b8-c9d0-1234-efab-345678901234', 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'c3d4e5f6-a7b8-9012-cdef-123456789012', 'd4e5f6a7-b8c9-0123-defa-234567890123',
  'a7b8c9d0-e1f2-3456-abcd-777777777777', 'e5f6a7b8-c9d0-1234-efab-555555555555', 'c3d4e5f6-a7b8-9012-cdef-333333333333', 'd4e5f6a7-b8c9-0123-defa-444444444444',
  'f2a3b4c5-d6e7-8901-fabc-222333444555', 'c9d0e1f2-a3b4-5678-cdef-999999999999',
  'b2c3d4e5-f6a7-8901-bcde-222222222222', 'a1b2c3d4-e5f6-7890-abcd-111111111111',
  'b8c9d0e1-f2a3-4567-bcde-888888888888', 'f6a7b8c9-d0e1-2345-fabc-666666666666',
  'e9b2c3d4-f5a6-7890-bcde-999999999999', '7a8b9c0d-e1f2-4356-abcd-999999999999',
  'f7a8b9c0-d1e2-4356-abcd-888888888888', 'd8e9f0a1-b2c3-4567-defa-888888888888',
  'd8e9f0a1-b2c3-4567-defa-777777777777'
])

function idsFrom(request: Request, body?: any) {
  const url = new URL(request.url)
  return { candidatoId: String(body?.candidato_id || url.searchParams.get('candidato') || ''), procesoId: String(body?.proceso_id || url.searchParams.get('proceso') || ''), token: String(body?.token || url.searchParams.get('token') || ''), testId: String(body?.test_id || url.searchParams.get('test_id') || '') }
}

async function validarContexto(request: Request, body?: any) {
  const ids = idsFrom(request, body)
  if (!ids.candidatoId || !ids.procesoId || !ids.token || !TEST_IDS.has(ids.testId) || !validarTokenEvaluacion(ids.token, ids.candidatoId, ids.procesoId)) return { error: NextResponse.json({ error: 'Enlace de evaluación inválido o vencido' }, { status: 401 }) }
  const db = createSupabaseAdmin()
  const [{ data: candidato, error: candidatoError }, { data: proceso, error: procesoError }, { data: vinculo, error: vinculoError }] = await Promise.all([
    db.from('candidatos').select('id, nombre, apellido').eq('id', ids.candidatoId).maybeSingle(),
    db.from('procesos').select('id, nombre, cargo').eq('id', ids.procesoId).maybeSingle(),
    db.from('candidatos_procesos').select('candidato_id, proceso_id').eq('candidato_id', ids.candidatoId).eq('proceso_id', ids.procesoId).maybeSingle()
  ])
  if (candidatoError || procesoError || vinculoError) throw candidatoError || procesoError || vinculoError
  if (!candidato || !proceso || !vinculo) return { error: NextResponse.json({ error: 'Candidato o proceso no encontrado' }, { status: 404 }) }
  return { ids, candidato, proceso, db, testId: ids.testId }
}

export async function GET(request: Request) {
  try {
    const contexto = await validarContexto(request)
    if ('error' in contexto) return contexto.error
    const { db, candidato, proceso, testId } = contexto
    const { data: items, error } = await db.from('items').select('id, orden, contenido, opciones, factor, inverso, respuesta_correcta').eq('test_id', testId).order('orden')
    if (error) throw error
    return NextResponse.json({ candidato, proceso, items: items || [] })
  } catch (error) {
    console.error('[evaluacion/public-data GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar los datos de la evaluación' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const contexto = await validarContexto(request, body)
    if ('error' in contexto) return contexto.error
    const { db, ids, testId } = contexto
    const action = String(body.action || '')
    if (action === 'start') {
      const requestedId = typeof body.sesion_id === 'string' ? body.sesion_id : ''
      const base = db.from('sesiones').select('id, estado, puntaje_bruto').eq('candidato_id', ids.candidatoId).eq('proceso_id', ids.procesoId).eq('test_id', testId).order('iniciada_en', { ascending: false }).limit(1)
      const query = requestedId ? db.from('sesiones').select('id, estado, puntaje_bruto').eq('id', requestedId).eq('candidato_id', ids.candidatoId).eq('proceso_id', ids.procesoId).eq('test_id', testId).limit(1) : base
      const { data: existentes, error: findError } = await query
      if (findError) throw findError
      const previa = existentes?.[0]
      if (previa?.estado === 'finalizado') return NextResponse.json({ sesion: previa, alreadyCompleted: true })
      if (previa) {
        const { data: actualizada, error } = await db.from('sesiones').update({ estado: 'iniciado' }).eq('id', previa.id).select('id, estado, puntaje_bruto').single()
        if (error) throw error
        return NextResponse.json({ sesion: actualizada })
      }
      const { data: nueva, error } = await db.from('sesiones').insert({ test_id: testId, candidato_id: ids.candidatoId, proceso_id: ids.procesoId, estado: 'iniciado', iniciada_en: new Date().toISOString() }).select('id, estado, puntaje_bruto').single()
      if (error) throw error
      return NextResponse.json({ sesion: nueva })
    }
    if (action === 'finalize') {
      let sesionId = String(body.sesion_id || '')
      const respuestas = Array.isArray(body.respuestas) ? body.respuestas : []
      const puntaje = body.puntaje_bruto && typeof body.puntaje_bruto === 'object' ? body.puntaje_bruto : {}
      if (!respuestas.length) return NextResponse.json({ error: 'Faltan respuestas para finalizar la evaluación' }, { status: 400 })
      if (sesionId) {
        const { data: sesion, error } = await db.from('sesiones').select('id, estado').eq('id', sesionId).eq('candidato_id', ids.candidatoId).eq('proceso_id', ids.procesoId).eq('test_id', testId).maybeSingle()
        if (error) throw error
        if (!sesion) return NextResponse.json({ error: 'Sesión no válida' }, { status: 404 })
        if (sesion.estado === 'finalizado') return NextResponse.json({ sesion, alreadyCompleted: true })
      } else {
        const { data: existentes, error } = await db.from('sesiones').select('id, estado').eq('candidato_id', ids.candidatoId).eq('proceso_id', ids.procesoId).eq('test_id', testId).order('iniciada_en', { ascending: false }).limit(1)
        if (error) throw error
        const previa = existentes?.[0]
        if (previa?.estado === 'finalizado') return NextResponse.json({ sesion: previa, alreadyCompleted: true })
        if (previa) sesionId = previa.id
        else {
          const { data: nueva, error: insertError } = await db.from('sesiones').insert({ test_id: testId, candidato_id: ids.candidatoId, proceso_id: ids.procesoId, estado: 'iniciado', iniciada_en: new Date().toISOString() }).select('id, estado').single()
          if (insertError) throw insertError
          sesionId = nueva.id
        }
      }
      const { data: actualizada, error: updateError } = await db.from('sesiones').update({ estado: 'finalizado', finalizada_en: new Date().toISOString(), puntaje_bruto: puntaje }).eq('id', sesionId).eq('estado', 'iniciado').select('id, estado, puntaje_bruto').maybeSingle()
      if (updateError) throw updateError
      if (!actualizada) return NextResponse.json({ error: 'La sesión cambió de estado; no se duplicaron respuestas' }, { status: 409 })
      const { data: existentes, error: existingError } = await db.from('respuestas').select('item_id').eq('sesion_id', sesionId)
      if (existingError) throw existingError
      if (!existentes?.length) {
        const filas = respuestas.map((r: any) => ({ sesion_id: sesionId, item_id: String(r.item_id), valor: Number(r.valor), tiempo_respuesta: Number(r.tiempo_respuesta || 0) }))
        const { error: insertError } = await db.from('respuestas').insert(filas)
        if (insertError) throw insertError
      }
      return NextResponse.json({ sesion: actualizada, alreadyCompleted: false })
    }
    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error) {
    console.error('[evaluacion/public-data POST]', error)
    return NextResponse.json({ error: 'No se pudo guardar la evaluación' }, { status: 500 })
  }
}