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

    if (auth.role === 'viewer') {
      const { data: sesionPermitida } = await db
        .from('sesiones').select('id').eq('candidato_id', candidatoId).in('proceso_id', auth.allowedProcesoIds).limit(1).maybeSingle()
      if (!sesionPermitida) return NextResponse.json({ error: 'Candidato no encontrado' }, { status: 404 })
    }

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

    const ordenMap = new Map<string, number>()
    if (vids && vids.length > 0) {
      const pregIds = Array.from(new Set(vids.map(x => x.pregunta_id).filter(Boolean)))
      if (pregIds.length > 0) {
        const { data: pregsData, error: pregsError } = await db
          .from('preguntas_video').select('id, pregunta, orden').in('id', pregIds)
        if (pregsError) throw pregsError
        const pregMap = new Map((pregsData || []).map(p => [p.id, p.pregunta]))
        ;(pregsData || []).forEach(p => { if (typeof p.orden === 'number') ordenMap.set(p.id, p.orden) })
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

    // Se ordena por el orden canonico de diseno de cada pregunta (no por cuando se grabo
    // la respuesta): dos candidatos pueden grabar en momentos distintos, con reintentos, o
    // responder ramas [CON_EXP]/[SIN_EXP] distintas, y grabada_en no refleja el orden real
    // de la entrevista. Si a alguna pregunta le faltara el orden (dato inesperado), se la
    // deja al final ordenada por grabada_en como resguardo, en vez de romper el listado.
    const resultado = Array.from(vMap.values()).sort((a, b) => {
      const oa = ordenMap.get(a.pregunta_id)
      const ob = ordenMap.get(b.pregunta_id)
      if (oa != null && ob != null) return oa - ob
      if (oa != null) return -1
      if (ob != null) return 1
      return new Date(a.grabada_en).getTime() - new Date(b.grabada_en).getTime()
    })

    return NextResponse.json({ videos: resultado })
  } catch (error) {
    console.error('[admin/videos-candidato GET]', error)
    return NextResponse.json({ error: 'No se pudieron cargar las video entrevistas' }, { status: 500 })
  }
}
