'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { ArrowLeft, Play, VideoOff, MessageSquare } from 'lucide-react'

interface Pregunta {
  id: string
  orden: number
  pregunta: string
  tiempo_respuesta: number
}

interface RespuestaVideo {
  id: string
  pregunta_id: string
  candidato_id: string | null
  url_video: string | null
  estado: string
  grabada_en: string
  candidato?: { nombre: string, apellido: string, email: string }
}

interface Entrevista {
  id: string
  nombre: string
}

export default function RevisarPage() {
  const [entrevista, setEntrevista] = useState<Entrevista | null>(null)
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [respuestas, setRespuestas] = useState<RespuestaVideo[]>([])
  const [cargando, setCargando] = useState(true)
  const [preguntaSeleccionada, setPreguntaSeleccionada] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const entrevistaId = searchParams.get('id')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    if (entrevistaId) cargarDatos()
    else setCargando(false)
  }, [entrevistaId])

  async function cargarDatos() {
    const { data: entrevistaData } = await supabase
      .from('entrevistas_video').select('*').eq('id', entrevistaId).single()
    setEntrevista(entrevistaData)

    const { data: preguntasData } = await supabase
      .from('preguntas_video').select('*')
      .eq('entrevista_id', entrevistaId).order('orden')
    setPreguntas(preguntasData || [])

    const { data: respuestasData } = await supabase
      .from('respuestas_video').select('*')
      .eq('entrevista_id', entrevistaId)
      .order('grabada_en', { ascending: false })

    const candidatoIds = respuestasData?.filter(r => r.candidato_id).map(r => r.candidato_id) || []
    let candidatos: { id: string, nombre: string, apellido: string, email: string }[] = []
    if (candidatoIds.length > 0) {
      const { data } = await supabase.from('candidatos')
        .select('id, nombre, apellido, email').in('id', candidatoIds)
      candidatos = data || []
    }

    const respuestasConCandidato = respuestasData?.map(r => ({
      ...r,
      candidato: candidatos.find(c => c.id === r.candidato_id)
    })) || []

    setRespuestas(respuestasConCandidato)
    if (preguntasData && preguntasData.length > 0) {
      setPreguntaSeleccionada(preguntasData[0].id)
    }
    setCargando(false)
  }

  function nombreCandidato(respuesta: RespuestaVideo) {
    return respuesta.candidato
      ? `${respuesta.candidato.nombre} ${respuesta.candidato.apellido}`
      : 'Candidato anónimo'
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const respuestasFiltradas = respuestas.filter(r => r.pregunta_id === preguntaSeleccionada)

  if (!entrevistaId) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm mt-8">
          <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">No se ha seleccionado ninguna entrevista</h2>
          <p className="text-sm text-slate-500 mt-2 mb-6">Debes seleccionar una entrevista desde el panel principal.</p>
          <a href="/panel" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm text-sm flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver al Panel
          </a>
        </div>
      </AppLayout>
    )
  }

  if (cargando) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <a href="/entrevista-video" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a entrevistas
        </a>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{entrevista?.nombre}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {respuestas.length} respuesta{respuestas.length !== 1 ? 's' : ''} recibida{respuestas.length !== 1 ? 's' : ''} en total
            </p>
          </div>
        </div>
      </div>

      {preguntas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-500 font-medium">No hay preguntas configuradas en esta entrevista.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1">Preguntas</h3>
            {preguntas.map(pregunta => {
              const cantRespuestas = respuestas.filter(r => r.pregunta_id === pregunta.id).length
              const isActive = preguntaSeleccionada === pregunta.id
              return (
                <div
                  key={pregunta.id}
                  onClick={() => setPreguntaSeleccionada(pregunta.id)}
                  className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                    isActive 
                      ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-500/10' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {pregunta.orden}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-medium leading-relaxed mb-1.5 ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {pregunta.pregunta}
                    </div>
                    <div className={`text-[11px] font-semibold ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {cantRespuestas} respuesta{cantRespuestas !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-1">
              Respuestas Recibidas
            </h3>
            {respuestasFiltradas.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                <VideoOff className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">No hay respuestas para esta pregunta todavía.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {respuestasFiltradas.map(respuesta => (
                  <div key={respuesta.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-5 flex justify-between items-start border-b border-slate-100 bg-slate-50/50">
                      <div>
                        <div className="font-bold text-slate-900">{nombreCandidato(respuesta)}</div>
                        {respuesta.candidato && (
                          <div className="text-xs font-medium text-slate-500 mt-0.5">{respuesta.candidato.email}</div>
                        )}
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          {formatearFecha(respuesta.grabada_en)}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide flex items-center gap-1 ${
                        respuesta.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {respuesta.estado === 'completado' ? <><Play className="w-3 h-3" /> Con video</> : 'Sin video'}
                      </span>
                    </div>
                    <div className="p-5 bg-slate-900 flex justify-center">
                      {respuesta.url_video ? (
                        <video
                          controls
                          className="w-full max-h-[400px] rounded-xl shadow-lg ring-1 ring-white/10"
                          src={respuesta.url_video}
                        />
                      ) : (
                        <div className="py-16 text-center flex flex-col items-center justify-center">
                          <VideoOff className="w-10 h-10 text-slate-700 mb-3" />
                          <p className="text-sm font-medium text-slate-500">Video no disponible o no grabado</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}