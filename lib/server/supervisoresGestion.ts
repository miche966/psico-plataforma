import { z } from 'zod'

// Reglas de la administracion de supervisores (alta, habilitaciones). Modulo puro (sin next/server) para poder testearlo;
// lo usan app/api/admin/supervisores y app/api/admin/supervisor-evaluados. Ver docs/PLAN_SUPERVISORES.md.

const esUuid = (v: unknown): v is string => z.guid().safeParse(v).success

export function normalizarEmail(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase()
}

const emailValido = (email: string) => z.string().email().safeParse(email).success

export type ResultadoValidacion<T> = ({ ok: true } & T) | { ok: false; error: string }

/** Alta de un supervisor: email valido y un nombre (opcional, hasta 120 caracteres). */
export function validarAlta(cuerpo: any): ResultadoValidacion<{ email: string; nombre: string }> {
  const email = normalizarEmail(cuerpo?.email)
  if (!email || !emailValido(email)) return { ok: false, error: 'Email inválido' }
  const nombre = String(cuerpo?.nombre ?? '').trim().replace(/\s+/g, ' ')
  if (nombre.length > 120) return { ok: false, error: 'El nombre es demasiado largo (máximo 120 caracteres)' }
  return { ok: true, email, nombre }
}

/** Habilitar o quitar a un supervisor un evaluado en un proceso: email y los dos ids (uuid). */
export function validarHabilitacion(cuerpo: any): ResultadoValidacion<{ email: string; candidatoId: string; procesoId: string }> {
  const email = normalizarEmail(cuerpo?.email)
  if (!email || !emailValido(email)) return { ok: false, error: 'Email inválido' }
  if (!esUuid(cuerpo?.candidato_id)) return { ok: false, error: 'Candidato inválido' }
  if (!esUuid(cuerpo?.proceso_id)) return { ok: false, error: 'Proceso inválido' }
  return { ok: true, email, candidatoId: cuerpo.candidato_id, procesoId: cuerpo.proceso_id }
}

export function idValido(valor: unknown): valor is string {
  return esUuid(valor)
}

/**
 * Otro rol que ya tiene una cuenta, si lo tiene: administrador (ADMIN_EMAILS) o cuenta de solo lectura (admin_roles).
 * Una cuenta no puede ser supervisor y ademas otra cosa. Lanza si la base falla (un fallo no se lee como "sin otro rol").
 */
export async function otroRolDeLaCuenta(db: any, email: string, emailsAdministradores: string[]): Promise<'admin' | 'viewer' | null> {
  if (emailsAdministradores.includes(email)) return 'admin'
  const { data, error } = await db.from('admin_roles').select('email').eq('email', email).maybeSingle()
  if (error) throw error
  return data ? 'viewer' : null
}

/** Procesos en los que participa un candidato: los vinculados (candidatos_procesos) y aquellos donde tiene sesiones. */
export async function procesosDelCandidato(db: any, candidatoId: string): Promise<string[]> {
  const [vinculos, sesiones] = await Promise.all([
    db.from('candidatos_procesos').select('proceso_id').eq('candidato_id', candidatoId),
    db.from('sesiones').select('proceso_id').eq('candidato_id', candidatoId).not('proceso_id', 'is', null),
  ])
  if (vinculos.error) throw vinculos.error
  if (sesiones.error) throw sesiones.error
  const ids = new Set<string>()
  for (const f of [...(vinculos.data || []), ...(sesiones.data || [])]) if (f.proceso_id) ids.add(f.proceso_id)
  return Array.from(ids)
}
