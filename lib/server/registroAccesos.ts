import { z } from 'zod'

export type AccionRegistrada = 'ver_informe' | 'ver_videos' | 'ver_respuestas_sesion' | 'generar_informe'

const esUuid = (v: unknown): v is string => z.guid().safeParse(v).success

/**
 * Anota que un administrador accedio a datos sensibles de un candidato (tabla registro_accesos,
 * ver supabase/migrations/agregar_registro_accesos.sql).
 *
 * Nunca lanza ni bloquea: si la tabla no existe todavia o la BD falla, se loguea en consola y el
 * administrador ve su informe igual -- mismo criterio fail-open que el rate limiting. Se llama con
 * `await` (no en segundo plano) para que en Vercel la funcion no se congele antes de escribir.
 *
 * Los ids se guardan solo si tienen forma de uuid: en generar-informe el candidato viene del cuerpo
 * de la solicitud, y un valor raro no debe hacer fallar el registro.
 */
export async function registrarAcceso(
  db: any,
  auth: { user?: { email?: string | null }; role?: string },
  datos: { accion: AccionRegistrada; candidatoId?: unknown; procesoId?: unknown },
  req: Request,
): Promise<void> {
  try {
    const { error } = await db.from('registro_accesos').insert({
      admin_email: String(auth.user?.email || '').trim().toLowerCase(),
      rol: auth.role,
      accion: datos.accion,
      candidato_id: esUuid(datos.candidatoId) ? datos.candidatoId : null,
      proceso_id: esUuid(datos.procesoId) ? datos.procesoId : null,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    })
    if (error) console.error('[REGISTRO ACCESOS] No se pudo registrar el acceso:', error.message)
  } catch (err) {
    console.error('[REGISTRO ACCESOS] Error registrando el acceso, se deja pasar:', err)
  }
}
