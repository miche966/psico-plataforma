-- Supervisores de la empresa: ven solo los evaluados (candidato + proceso) que el administrador les habilita,
-- con sus videoentrevistas y un informe sencillo publicado por el administrador. Aditivo: no toca filas existentes.
-- Ejecutar a mano en el SQL Editor de Supabase. Reversion: supabase/migrations/revertir_supervisores.sql
BEGIN;

create table if not exists public.supervisores (
  email text primary key,
  nombre text not null default '',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  invitado_por text
);

create table if not exists public.supervisor_evaluados (
  supervisor_email text not null references public.supervisores(email) on delete cascade,
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  proceso_id uuid not null references public.procesos(id) on delete cascade,
  habilitado_por text,
  habilitado_en timestamptz not null default now(),
  primary key (supervisor_email, candidato_id, proceso_id)
);
create index if not exists supervisor_evaluados_candidato_idx on public.supervisor_evaluados (candidato_id, proceso_id);

create table if not exists public.informes_supervisor (
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  proceso_id uuid not null references public.procesos(id) on delete cascade,
  borrador jsonb,
  publicado jsonb,
  actualizado_en timestamptz not null default now(),
  publicado_en timestamptz,
  publicado_por text,
  primary key (candidato_id, proceso_id)
);

-- El registro de accesos tambien anota a los supervisores (antes solo admitia 'admin' y 'viewer').
-- Se buscan las restricciones check de la tabla que mencionan la columna rol (no se asume su nombre) y se reemplazan.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.registro_accesos'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%rol%'
  loop
    execute format('alter table public.registro_accesos drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.registro_accesos add constraint registro_accesos_rol_check check (rol in ('admin', 'viewer', 'supervisor'));

-- Sin acceso publico: solo el servidor (service role). RLS activo y ninguna politica, igual que el resto.
alter table public.supervisores enable row level security;
alter table public.supervisor_evaluados enable row level security;
alter table public.informes_supervisor enable row level security;

COMMIT;
