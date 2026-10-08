/**
 * Borra los factores de 2FA (dispositivos) de una cuenta de Supabase Auth: cierra todas sus sesiones y en su proximo ingreso
 * tendra que enrolar uno nuevo. Lo usan el restablecimiento de las cuentas de solo lectura y el de los supervisores.
 *
 * Supabase Auth no busca usuarios por email: se recorre el listado (hay pocas cuentas). Devuelve `encontrado: false` si la
 * cuenta todavia no creo su usuario (no acepto la invitacion). Lanza si Supabase falla.
 */
export async function borrarFactoresMfa(db: any, email: string): Promise<{ encontrado: boolean; eliminados: number }> {
  let userId: string | null = null
  for (let pagina = 1; pagina <= 20 && !userId; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) throw error
    userId = data.users.find((u: any) => (u.email || '').toLowerCase() === email)?.id || null
    if (data.users.length < 200) break
  }
  if (!userId) return { encontrado: false, eliminados: 0 }

  const { data: lista, error: listaError } = await db.auth.admin.mfa.listFactors({ userId })
  if (listaError) throw listaError
  const factores = lista?.factors || []
  for (const factor of factores) {
    const { error } = await db.auth.admin.mfa.deleteFactor({ id: factor.id, userId })
    if (error) throw error
  }
  return { encontrado: true, eliminados: factores.length }
}
