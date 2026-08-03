import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/server/adminAuth'
import { createSupabaseAdmin } from '@/lib/server/supabaseAdmin'

export async function GET(req: Request) {
  const auth = await requireAdminSession(req)
  if (auth.response) return auth.response

  try {
    const url = new URL(req.url)
    const candidatoId = url.searchParams.get('candidato_id')
    if (!candidatoId) return NextResponse.json({ error: 'Falta candidato_id' }, { status: 400 })

    const db = createSupabaseAdmin()

    let vids: any[] | null = null
    const { data: vidsDirect, error: vidsDirectError } = await db
      .from('respuestas_video')
      .select('*')
      .eq('candidato_id', candidatoId)
      .order('grabada_en', { ascending: true })
    if (vidsDirectError) throw vidsDirectError

    if (vidsDirect && vidsDirect.length > 0) {
      vids = vidsDirect
    } else {
      const { data: candidato, error: candidatoError } = await db
        .from('candidatos').select('email').eq('id', candidatoId).maybeSingle()
      if (candidatoError) throw candidatoError
      if (candidato?.email) {
        const { data: candsMismoEmail, error: candsError } = await db
          .from('candidatos').select('id').eq('email', candidato.email)
        if (candsError) throw candsError
        const idsEmail = (candsMismoEmail || []).map(x => x.id)
        if (idsEmail.length > 0) {
          const { data: vidsByEmail, error: vidsByEmailError } = await db
            .from('respuestas_video').select('*').in('candidato_id', idsEmail).order('grabada_en', { ascending: true })
          if (vidsByEmailError) throw vidsByEmailError
          vids = vidsByEmail
        }
      }
    }

    if (vids && vids.length > 0) {
      const pregIds = Array.from(new Set(vids.map(x => x.pregunta_id).filter(Boolean)))
      if (pregIds.length > 0) {
        const { data: pregsData, error: pregsError } = await db
          .from('preguntas_video').select('id, pregunta').in('id', pregIds)
        if (pregsError) throw pregsError
        const pregMap = new Map((pregsData || []).map(p => [p.id, p.pregunta]))
        vids.forEach(v => {
          if (!v.preguntas_video && v.pregunta_id) v.preguntas_video = { pregunta: pregMap.get(v.pregunta_id) }
        })
      }
    }

    const vMap = new Map<string, any>()
    vids?.forEach(v => {
      const k = `${v.entrevista_id}:${v.pregunta_id}`
      const ex = vMap.get(k)
      if (!ex || new Date(v.grabada_en) > new Date(ex.grabada_en)) vMap.set(k, v)
    })

    return NextResponse.json({ videos: Array.from(vMap.values()) })
  } catch (error) {
    console.error('[admin/videos-candidato GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las video entrevistas' }, { status: 500 })
  }
}
