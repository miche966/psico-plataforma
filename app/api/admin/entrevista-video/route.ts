import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(request: Request) {
  const auth = await requireAdminSession(request)
  if (auth.response) return auth.response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id de entrevista' }, { status: 400 })

  try {
    const db = createSupabaseAdmin()
    const [{ data: entrevista, error: entrevistaError }, { data: preguntas, error: preguntasError }, { data: respuestas, error: respuestasError }] = await Promise.all([
      db.from('entrevistas_video').select('*').eq('id', id).single(),
      db.from('preguntas_video').select('*').eq('entrevista_id', id).order('orden'),
      db.from('respuestas_video').select('*').eq('entrevista_id', id).eq('estado', 'completado').order('grabada_en', { ascending: false })
    ])
    if (entrevistaError) throw entrevistaError
    if (preguntasError) throw preguntasError
    if (respuestasError) throw respuestasError

    const ids = [...new Set((respuestas || []).map((r: any) => r.candidato_id).filter(Boolean))]
    let candidatos: any[] = []
    if (ids.length) {
      const result = await db.from('candidatos').select('id, nombre, apellido, email').in('id', ids)
      if (result.error) throw result.error
      candidatos = result.data || []
    }
    const respuestasConCandidato = (respuestas || []).map((r: any) => ({
      ...r,
      candidato: candidatos.find(c => c.id === r.candidato_id)
    }))
    return NextResponse.json({ entrevista, preguntas: preguntas || [], respuestas: respuestasConCandidato })
  } catch (error) {
    console.error('[admin/entrevista-video]', error)
    return NextResponse.json({ error: 'No se pudo cargar la entrevista' }, { status: 500 })
  }
}
