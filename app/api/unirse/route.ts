import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { generarTokenEvaluacion } from '@/lib/server/evaluacionToken'

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
}

export async function GET() {
  try {
    const db = createSupabaseAdmin()
    const { data, error } = await db
      .from('procesos')
      .select('id, nombre, cargo')
      .eq('activo', true)
      .order('creado_en', { ascending: false })
    if (error) throw error
    return NextResponse.json({ procesos: data || [] })
  } catch (error) {
    console.error('[unirse GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las búsquedas activas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const nombres = String(body.nombres || '').trim()
    const apellidos = String(body.apellidos || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const documento = String(body.documento || '').trim()
    const edad = body.edad
    const sexo = String(body.sexo || '').trim()
    const formacion = String(body.formacion || '').trim()
    const profesion = String(body.profesion || '').trim()
    const procesoId = String(body.procesoId || '').trim()

    if (!nombres || !apellidos || !email || !documento || !procesoId || !edad || !sexo) {
      return NextResponse.json({ error: 'Por favor, completa todos los campos obligatorios.' }, { status: 400 })
    }

    const db = createSupabaseAdmin()

    // 1. Verificar si el candidato ya existe (por email, sin distinguir mayúsculas, o por documento)
    let { data: candidato, error: candError } = await db
      .from('candidatos')
      .select('*')
      .or(`email.ilike.${email},documento.eq.${documento}`)
      .maybeSingle()

    if (candError) throw candError

    if (!candidato) {
      const { data: nuevoCandidato, error: createError } = await db
        .from('candidatos')
        .insert({
          nombre: nombres,
          apellido: apellidos,
          email,
          documento,
          edad: parseInt(edad),
          sexo,
          formacion,
          profesion
        })
        .select()
        .single()

      if (createError) throw createError
      candidato = nuevoCandidato
    } else {
      const { error: updateError } = await db.from('candidatos').update({
        nombre: nombres,
        apellido: apellidos,
        edad: parseInt(edad),
        sexo,
        formacion,
        profesion
      }).eq('id', candidato.id)
      if (updateError) throw updateError
    }

    // 2. Verificar si ya tiene el vínculo con el proceso y sesiones creadas
    const { data: sesionesExistentes } = await db
      .from('sesiones')
      .select('id')
      .eq('candidato_id', candidato.id)
      .eq('proceso_id', procesoId)
      .limit(1)

    // 3. Solo crear el vínculo inicial si NO tiene sesiones previas
    if (!sesionesExistentes || sesionesExistentes.length === 0) {
      const { data: procData } = await db
        .from('procesos')
        .select('bateria_tests')
        .eq('id', procesoId)
        .single()

      if (procData) {
        const slugPrimerTest = procData.bateria_tests?.[0] || 'bigfive'
        let testIdFinal = slugPrimerTest
        if (slugPrimerTest.startsWith('entrevista:')) testIdFinal = slugPrimerTest.split(':')[1]
        else if (SLUG_TO_ID[slugPrimerTest]) testIdFinal = SLUG_TO_ID[slugPrimerTest]

        await db.from('sesiones').insert({
          candidato_id: candidato.id,
          proceso_id: procesoId,
          test_id: testIdFinal,
          estado: 'pendiente'
        })

        // Asegurar vínculo en tabla relacional para el panel
        await db.from('candidatos_procesos').upsert({
          candidato_id: candidato.id,
          proceso_id: procesoId
        })
      }
    }

    // 4. Generar token firmado para que el portal de evaluación pueda validar el acceso
    const token = generarTokenEvaluacion(candidato.id, procesoId)

    return NextResponse.json({ candidato_id: candidato.id, proceso_id: procesoId, token })

  } catch (error: any) {
    console.error('[unirse POST]', error)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Este correo electrónico o documento ya está registrado para una evaluación.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Hubo un problema al procesar tu registro. Por favor, intenta de nuevo.' }, { status: 500 })
  }
}
