# Migraciones de base de datos

Este proyecto no tiene CLI de Supabase configurado ni connection string a Postgres (confirmado: no hay `supabase/config.toml` funcional para link remoto, ni `DATABASE_URL`/`POSTGRES_URL` en `.env.local`). Todo cambio de esquema se aplica **a mano, en el SQL Editor del Dashboard de Supabase**, siguiendo el mismo procedimiento ya usado para `add_bateria_tests.sql`, `add_progreso_evaluaciones_y_recordatorios.sql` y la activación de RLS.

## Convención

- Cada cambio de esquema nuevo se agrega como un archivo `.sql` en esta carpeta, con nombre descriptivo en minúsculas y guiones bajos (`agregar_columna_x.sql`, no `migration_017.sql` — no hay una tabla de versiones que lleve la cuenta, así que el nombre es la única referencia).
- El archivo debe ser idempotente cuando sea posible (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) para poder reejecutarlo sin error si ya se aplicó.
- Encabezado de 1-2 líneas en comentario SQL explicando qué hace y cuándo ejecutarlo.
- Si el cambio es riesgoso o afecta datos productivos, acompañarlo de un archivo de reversión al lado (mismo patrón que `docs/rls_activar.sql` / `docs/rls_revertir.sql`).
- Envolver cambios de múltiples sentencias en `BEGIN` / `COMMIT` para que sean transaccionales.

## Procedimiento

1. Escribir el archivo `.sql` en esta carpeta (no ejecutar nada automáticamente — ninguna herramienta de este repo tiene permiso ni capacidad de ejecutar DDL directo).
2. Quien tenga acceso al proyecto de Supabase lo corre manualmente en el SQL Editor del Dashboard.
3. Verificar el cambio con una consulta de solo lectura antes de dar por terminado.
4. Dejar el archivo en el repo como registro histórico — no se borra después de aplicado.

## Por qué no viven en `docs/`

Los scripts de activación de RLS de esta sesión (`docs/rls_activar.sql`, `docs/rls_revertir.sql`) quedaron fuera de esta carpeta por apuro. A partir de ahora, cualquier cambio de esquema nuevo va en `supabase/migrations/`, no en `docs/`, para tener un único lugar de referencia.
