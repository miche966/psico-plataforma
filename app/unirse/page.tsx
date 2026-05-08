'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { UserPlus, ChevronRight, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'

interface Proceso {
  id: string
  nombre: string
  cargo: string
}

export default function UnirsePage() {
  const router = useRouter()
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    documento: '',
    edad: '',
    sexo: '',
    formacion: '',
    profesion: '',
    procesoId: ''
  })

  useEffect(() => {
    cargarProcesos()
  }, [])

  async function cargarProcesos() {
    try {
      const { data, error } = await supabase
        .from('procesos')
        .select('id, nombre, cargo')
        .eq('activo', true)
        .order('creado_en', { ascending: false })

      if (error) throw error
      setProcesos(data || [])
    } catch (err) {
      console.error('Error cargando procesos:', err)
      setError('No pudimos cargar las búsquedas activas. Por favor, intenta más tarde.')
    } finally {
      setCargando(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombres || !form.apellidos || !form.email || !form.documento || !form.procesoId || !form.edad || !form.sexo) {
      setError('Por favor, completa todos los campos obligatorios.')
      return
    }

    setEnviando(true)
    setError(null)

    try {
      // 1. Crear el candidato
      const { data: candidato, error: candError } = await supabase
        .from('candidatos')
        .insert({
          nombre: form.nombres,
          apellido: form.apellidos,
          email: form.email,
          documento: form.documento,
          edad: parseInt(form.edad),
          sexo: form.sexo,
          formacion: form.formacion,
          profesion: form.profesion
        })
        .select()
        .single()

      if (candError) throw candError

      // 2. Redirigir a la evaluación vinculada al proceso
      // La ruta /evaluacion se encarga de crear las sesiones si no existen
      router.push(`/evaluacion?candidato=${candidato.id}&proceso=${form.procesoId}`)
      
    } catch (err: any) {
      console.error('Error en registro:', err)
      if (err.code === '23505') {
        setError('Este correo electrónico o documento ya está registrado para una evaluación.')
      } else {
        setError('Hubo un problema al procesar tu registro. Por favor, intenta de nuevo.')
      }
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Cargando portal de selección...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 py-12">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-100/50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="w-full max-w-xl relative">
        {/* Header Logo/Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-xl border border-slate-100 mb-6 group transition-transform hover:scale-105">
            <Building2 className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Portal del Candidato</h1>
          <p className="text-slate-500 font-medium">Completa tus datos para iniciar el proceso de evaluación psicométrica.</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-200/20 border border-slate-100 overflow-hidden">
          <div className="bg-indigo-600 p-6 text-white flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Formulario de Inscripción</h2>
              <p className="text-indigo-100 text-xs">Todos los campos con * son obligatorios</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nombres *</label>
                <input
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={form.nombres}
                  onChange={e => setForm({ ...form, nombres: e.target.value })}
                  placeholder="Ej: Franco"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Apellidos *</label>
                <input
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={form.apellidos}
                  onChange={e => setForm({ ...form, apellidos: e.target.value })}
                  placeholder="Ej: Rodríguez"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Edad *</label>
                <input
                  required
                  type="number"
                  min="18"
                  max="99"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={form.edad}
                  onChange={e => setForm({ ...form, edad: e.target.value })}
                  placeholder="Ej: 25"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Sexo *</label>
                <div className="relative">
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    value={form.sexo}
                    onChange={e => setForm({ ...form, sexo: e.target.value })}
                  >
                    <option value="">Selecciona...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro / No binario</option>
                    <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Correo Electrónico *</label>
                <input
                  required
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="ejemplo@correo.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Documento de Identidad *</label>
                <input
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={form.documento}
                  onChange={e => setForm({ ...form, documento: e.target.value })}
                  placeholder="DNI / Cédula"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Formación Académica</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={form.formacion}
                  onChange={e => setForm({ ...form, formacion: e.target.value })}
                  placeholder="Ej: Lic. en Psicología"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Profesión / Trabajo Actual</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  value={form.profesion}
                  onChange={e => setForm({ ...form, profesion: e.target.value })}
                  placeholder="Ej: Reclutador IT"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Posición a la que postulas *</label>
              <div className="relative">
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                  value={form.procesoId}
                  onChange={e => setForm({ ...form, procesoId: e.target.value })}
                >
                  <option value="">Selecciona una búsqueda activa...</option>
                  {procesos.map(p => (
                    <option key={p.id} value={p.id}>{p.cargo} - {p.nombre}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={enviando}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {enviando ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    Iniciar Evaluación
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="bg-slate-50 p-6 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Al iniciar, el sistema te guiará automáticamente por los tests asignados a tu perfil. Asegúrate de contar con tiempo suficiente y una conexión estable. Tus datos están protegidos y serán usados únicamente para fines de selección profesional.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-slate-400 text-xs mt-8 font-medium">
          PsicoPlataforma © 2026 • Evaluación Psicométrica Profesional
        </p>
      </div>
    </div>
  )
}
