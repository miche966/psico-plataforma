'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { Marco } from '@/components/candidato/Marco'
import { PantallaCarga } from '@/components/candidato/Estados'
import { useSearchParams } from 'next/navigation'
import { nombreDeProcesoLegible } from '@/lib/nombreProceso'

declare global {
  interface Window {
    turnstile?: { reset: (widgetId?: string) => void }
    onTurnstileSuccess?: (token: string) => void
  }
}

interface Proceso {
  id: string
  nombre: string
  cargo: string
}

export default function UnirsePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')

  useEffect(() => {
    window.onTurnstileSuccess = (token: string) => setTurnstileToken(token)
    return () => { window.onTurnstileSuccess = undefined }
  }, [])

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
    const pId = searchParams.get('proceso')
    if (pId) {
      setForm(prev => ({ ...prev, procesoId: pId }))
    }
  }, [searchParams])

  async function cargarProcesos() {
    try {
      const response = await fetch('/api/unirse', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Error cargando procesos')
      setProcesos(data.procesos || [])
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
      const response = await fetch('/api/unirse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombres: form.nombres,
          apellidos: form.apellidos,
          email: form.email,
          documento: form.documento,
          edad: form.edad,
          sexo: form.sexo,
          formacion: form.formacion,
          profesion: form.profesion,
          procesoId: form.procesoId,
          turnstileToken
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Hubo un problema al procesar tu registro. Por favor, intenta de nuevo.')

      // Redirigir a la evaluación con el enlace firmado
      router.push(`/evaluacion?candidato=${data.candidato_id}&proceso=${data.proceso_id}&token=${encodeURIComponent(data.token)}`)

    } catch (err: any) {
      console.error('Error en registro:', err)
      setError(err.message || 'Hubo un problema al procesar tu registro. Por favor, intenta de nuevo.')
      setEnviando(false)
      setTurnstileToken('')
      window.turnstile?.reset()
    }
  }

  if (cargando) return <PantallaCarga texto="Cargando el portal…" />

  return (
    <Marco titulo="Inscripción">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      <h1 className="pp-titulo">Inscripción al proceso de selección</h1>
      <p className="pp-lead">Completá tus datos para empezar la evaluación psicométrica. Los campos con <span aria-hidden="true">*</span><span className="pp-sr">asterisco</span> son obligatorios.</p>

      <form onSubmit={handleSubmit} className="pp-formulario" noValidate={false}>
        {error && (
          <div className="pp-alerta" role="alert">
            <p>{error}</p>
          </div>
        )}

        <fieldset className="pp-grupo">
          <legend>Tus datos</legend>
          <div className="pp-grid2">
            <div className="pp-campo">
              <label htmlFor="nombres">Nombres <span aria-hidden="true">*</span></label>
              <input
                id="nombres"
                required
                value={form.nombres}
                onChange={e => setForm({ ...form, nombres: e.target.value })}
                placeholder="Ej: Franco"
              />
            </div>
            <div className="pp-campo">
              <label htmlFor="apellidos">Apellidos <span aria-hidden="true">*</span></label>
              <input
                id="apellidos"
                required
                value={form.apellidos}
                onChange={e => setForm({ ...form, apellidos: e.target.value })}
                placeholder="Ej: Rodríguez"
              />
            </div>
            <div className="pp-campo">
              <label htmlFor="edad">Edad <span aria-hidden="true">*</span></label>
              <input
                id="edad"
                required
                type="number"
                min="18"
                max="99"
                inputMode="numeric"
                value={form.edad}
                onChange={e => setForm({ ...form, edad: e.target.value })}
                placeholder="Ej: 25"
              />
            </div>
            <div className="pp-campo">
              <label htmlFor="sexo">Sexo <span aria-hidden="true">*</span></label>
              <select
                id="sexo"
                required
                value={form.sexo}
                onChange={e => setForm({ ...form, sexo: e.target.value })}
              >
                <option value="">Elegí una opción</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro / No binario</option>
                <option value="Prefiero no decirlo">Prefiero no decirlo</option>
              </select>
            </div>
            <div className="pp-campo">
              <label htmlFor="email">Correo electrónico <span aria-hidden="true">*</span></label>
              <input
                id="email"
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="ejemplo@correo.com"
              />
            </div>
            <div className="pp-campo">
              <label htmlFor="documento">Documento de identidad <span aria-hidden="true">*</span></label>
              <input
                id="documento"
                required
                value={form.documento}
                onChange={e => setForm({ ...form, documento: e.target.value })}
                placeholder="DNI / Cédula"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="pp-grupo">
          <legend>Tu formación</legend>
          <div className="pp-grid2">
            <div className="pp-campo">
              <label htmlFor="formacion">Formación académica</label>
              <input
                id="formacion"
                value={form.formacion}
                onChange={e => setForm({ ...form, formacion: e.target.value })}
                placeholder="Ej: Lic. en Psicología"
              />
            </div>
            <div className="pp-campo">
              <label htmlFor="profesion">Profesión o trabajo actual</label>
              <input
                id="profesion"
                value={form.profesion}
                onChange={e => setForm({ ...form, profesion: e.target.value })}
                placeholder="Ej: Reclutador IT"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="pp-grupo">
          <legend>Tu postulación</legend>
          <div className="pp-campo">
            <label htmlFor="procesoId">Posición a la que postulás <span aria-hidden="true">*</span></label>
            <select
              id="procesoId"
              required
              value={form.procesoId}
              onChange={e => setForm({ ...form, procesoId: e.target.value })}
            >
              <option value="">Elegí una búsqueda activa</option>
              {procesos.map(p => (
                <option key={p.id} value={p.id}>{p.cargo} - {nombreDeProcesoLegible(p.nombre)}</option>
              ))}
            </select>
          </div>
        </fieldset>

        <div
          className="cf-turnstile"
          data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          data-callback="onTurnstileSuccess"
        />

        <button type="submit" className="pp-boton pp-boton-ancho" disabled={enviando || !turnstileToken}>
          {enviando ? 'Procesando…' : !turnstileToken ? 'Verificando…' : 'Iniciar evaluación'}
        </button>

        <p className="pp-nota">
          Al iniciar, el sistema te guiará automáticamente por las pruebas asignadas a tu perfil. Asegurate de contar con tiempo suficiente y una conexión estable. Tus datos están protegidos y se usan únicamente para fines de selección profesional.
        </p>
      </form>
    </Marco>
  )
}
