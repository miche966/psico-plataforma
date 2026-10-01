-- Registro de accesos de administradores a datos sensibles de candidatos: quien abrio que, y cuando.
-- Aditivo: no toca ninguna tabla ni fila existente. Ejecutar a mano en el SQL Editor de Supabase.
-- Es seguro: solo crea una tabla nueva y vacia. Si algun dia hiciera falta revertirlo, basta con
-- eliminar la tabla registro_accesos desde el Table Editor del Dashboard.
BEGIN;

create table if not exists public.registro_accesos (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  admin_email text not null,
  rol text not null check (rol in ('admin', 'viewer')),
  accion text not null,
  candidato_id uuid,
  proceso_id uuid,
  ip text
);

-- candidato_id y proceso_id van sin clave foranea a proposito: el registro tiene que sobrevivir
-- aunque despues se borre el candidato o el proceso (si no, el borrado tambien borraria la evidencia).
create index if not exists registro_accesos_candidato_idx on public.registro_accesos (candidato_id, creado_en desc);
create index if not exists registro_accesos_admin_idx on public.registro_accesos (admin_email, creado_en desc);

-- Seguridad: sin acceso publico. Solo el servidor (service role) escribe y lee; con RLS activo y
-- ninguna politica, anon y authenticated no pueden ver ni modificar nada (mismo patron que el resto).
alter table public.registro_accesos enable row level security;

COMMIT;
