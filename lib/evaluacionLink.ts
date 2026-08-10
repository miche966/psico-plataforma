import { supabase } from '@/lib/supabase'

export async function getAdminHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('La sesion administrativa expiro. Inicia sesion nuevamente.')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function obtenerLinkEvaluacion(candidatoId: string, procesoId: string, ruta?: string) {
  const response = await fetch('/api/evaluacion-link', {
    method: 'POST',
    headers: await getAdminHeaders(),
    body: JSON.stringify({ candidato_id: candidatoId, proceso_id: procesoId, ruta }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || typeof data.link !== 'string') {
    throw new Error(data.error || 'No se pudo generar el enlace firmado')
  }
  return data.link as string
}