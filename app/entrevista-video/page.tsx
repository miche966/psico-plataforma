'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { Plus, Video, Calendar, Eye, Trash2, Settings } from 'lucide-react'

interface Entrevista {
  id: string
  nombre: string
  created_at: string
}

export default function EntrevistasVideoPage() {
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([])
  const [cargando, setCargando] = useState(true)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
    cargarDatos()
  }, [])

  const [error, setError] = useState<string | null>(null)

  async function cargarDatos() {
    setError(null)
    const { data, error: dbError } = await supabase
      .from('entrevistas_video')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('entrevistas_video')
        .select('*')
      
      if (fallbackError) {
        setError(`Error crítico de base de datos: ${fallbackError.message}`)
      } else {
        setEntrevistas(fallbackData || [])
      }
    } else {
      setEntrevistas(data || [])
    }
    setCargando(false)
  }

  async function borrarEntrevista(id: string, nombre: string) {
    if (!confirm(`¿Estás seguro de que deseas eliminar la librería "${nombre}"? \n\nSe borrarán todas las preguntas asociadas. Esta acción no se puede deshacer.`)) {
      return
    }

    setBorrandoId(id)
    try {
      // 1. Borrar preguntas asociadas (el cascade debería ocuparse, pero lo aseguramos)
      await supabase.from('preguntas_video').delete().eq('entrevista_id', id)
      
      // 2. Borrar la entrevista
      const { error } = await supabase.from('entrevistas_video').delete().eq('id', id)
      
      if (error) throw error
      
      setEntrevistas(entrevistas.filter(e => e.id !== id))
      alert('Librería eliminada con éxito.')
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setBorrandoId(null)
    }
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Librería de Evaluaciones</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona tus plantillas de videoentrevistas y componentes de evaluación
          </p>
        </div>
        <button 
          onClick={() => router.push('/entrevista-video/crear')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nueva Entrevista
        </button>
      </div>

      {entrevistas.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Video className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 mb-4 font-medium">No has creado ninguna entrevista en video todavía.</p>
          <button 
            onClick={() => router.push('/entrevista-video/crear')}
            className="text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Armar mi primera entrevista
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entrevistas.map(entrevista => (
            <div
              key={entrevista.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Video className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{entrevista.nombre}</h3>
                  </div>
                  <button 
                    onClick={() => borrarEntrevista(entrevista.id, entrevista.nombre)}
                    disabled={borrandoId === entrevista.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar librería"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
                  <Calendar className="w-3.5 h-3.5" />
                  Creada el {formatearFecha(entrevista.created_at)}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => router.push(`/entrevista-video/revisar?id=${entrevista.id}`)}
                  className="w-full px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Ver respuestas
                </button>
                <button
                  onClick={() => router.push(`/entrevista-video/crear?id=${entrevista.id}`)}
                  className="w-full px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2 border border-slate-200"
                >
                  <Settings className="w-4 h-4" /> Configurar preguntas
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
