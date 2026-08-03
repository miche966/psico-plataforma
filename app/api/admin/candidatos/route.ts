import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response

  try {
    const db = createSupabaseAdmin()
    const { data: candidatos, error } = await db
      .from('candidatos')
      .select('*')
      .order('creado_en', { ascending: false })
    if (error) throw error

    // Chunk candidate IDs to avoid the 1000-row PostgREST select limit in Supabase
    const candidateIds = candidatos ? candidatos.map((c: any) => c.id) : []
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
      const nombres = String(body.nombres || '')
      const apellidos = String(body.apellidos || '')
      const email = String(body.email || '')
      const documento = String(body.documento || '')
      if (!nombres || !apellidos || !email || !documento) {
        return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
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

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 })
  } catch (error) {
    console.error('[admin/candidatos POST]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 })
  }
}
