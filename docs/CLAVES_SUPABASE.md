# Claves de Supabase de la plataforma

La plataforma usa las **claves nuevas** de Supabase (desde 2026-10-02) en lugar de las clásicas (`anon` y `service_role`,
dos JWT con vencimiento en 2036 que no se pueden rotar sin cortar el servicio).

| Uso | Variable (nueva) | Respaldo clásico | Dónde se lee |
|---|---|---|---|
| Servidor, acceso total a la base, Storage y Auth admin | `SUPABASE_SECRET_KEY` (`sb_secret_…`) | `SUPABASE_SERVICE_ROLE_KEY` | `lib/server/clavesSupabase.ts` → `createSupabaseAdmin()` |
| Navegador y servidor, solo Auth (sesión, 2FA, login, recuperación) | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts` (lectura literal: Next la incrusta al compilar), `clavePublica()` en el servidor |

- Si la variable nueva está definida y no vacía, se usa; si no, cae a la clásica. Así se puede pasar de una a otra cambiando
  solo variables de entorno.
- La clave `secret` **no es un JWT**: no sirve en una cabecera `Authorization: Bearer`. Hay que usarla a través de
  `createSupabaseAdmin()` (supabase-js) o en la cabecera `apikey`. No volver a escribir llamadas REST a mano con `Bearer`.
- Todo acceso a la base es desde el servidor; la clave pública **no puede leer datos** (RLS sin políticas, verificado).
- `NEXT_PUBLIC_…` se incrusta al compilar: cambiarla exige **redesplegar**.

## Estado
| Paso | Fecha | Estado |
|---|---|---|
| Código con compatibilidad entre claves nuevas y clásicas | 2026-10-02 | hecho |
| Prueba local solo con claves nuevas (lectura/escritura, Storage, `auth.admin`, Auth) | 2026-10-02 | hecho |
| Variables nuevas en Vercel (Production) + redespliegue; prueba del responsable (2FA, panel, informe, Accesos, recordatorios) | 2026-10-02 | hecho |
| Quitar de Vercel (Production) `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` y redesplegar | 2026-10-02 | hecho |
| Deshabilitar las claves clásicas en el proyecto (API Keys → Legacy → *Disable JWT-based API keys*) | 2026-10-02 | hecho: `service_role` y `anon` clásicas responden 401 |
| Revocar la *Previous key* (Legacy HS256) en Settings → JWT Keys, que mantenía vivo el secreto legado | 2026-10-02 | hecho: las claves clásicas ya no valen ni en Storage (`signature verification failed`). La clave de firma vigente es ECC (P-256) |

## Rotar una clave (sin cortar el servicio)
1. En Supabase → Settings → API Keys → crear una `secret` (o `publishable`) nueva con otro nombre.
2. Reemplazar el valor en Vercel (Production) y redesplegar; verificar un flujo de candidato y el panel.
3. Recién entonces borrar la clave anterior en Supabase.

## Volver atrás
- **Antes de deshabilitar las clásicas**: borrar en Vercel `SUPABASE_SECRET_KEY` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y
  redesplegar: el código vuelve a usar las clásicas.
- **Después**: volver a habilitar las claves clásicas en Supabase (si el panel lo permite) y restaurar las dos variables
  clásicas en Vercel, o seguir con las nuevas. Por eso las clásicas **no se borran de Vercel** hasta confirmar la estabilidad.

## Cuidados
- Antes de cualquier acción de pausa, borrado o deshabilitación, **confirmar en la pantalla el nombre de la organización y el
  Reference ID** del proyecto: el de producción es `PsicoPlataforma Org Nueva` / PsicoPlataforma-V2 (`wzhdidxssnwfvzzapfwu`).
- El validador de secretos del CI (`scripts/validate-repository.cjs`) marca cualquier `sb_secret_` con 10 o más caracteres,
  incluso ficticios: en tests usar valores cortos.
- Los valores se pasan por archivo (nunca por el chat ni impresos) y se borran de los archivos sueltos al terminar.
