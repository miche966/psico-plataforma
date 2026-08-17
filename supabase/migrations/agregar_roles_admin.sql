-- Cuentas de solo lectura ("viewer") con acceso limitado a procesos especificos.
-- Aditivo: no toca ninguna tabla ni fila existente. Las cuentas admin siguen
-- controladas exclusivamente por la variable de entorno ADMIN_EMAILS (sin
-- fila en admin_roles) -- esta tabla es solo para el segundo nivel de acceso.
create table if not exists public.admin_roles (
  email text primary key,
  role text not null default 'viewer' check (role in ('viewer')),
  creado_en timestamptz not null default now(),
  invitado_por text
);

create table if not exists public.admin_role_procesos (
  email text not null references public.admin_roles(email) on delete cascade,
  proceso_id uuid not null references public.procesos(id) on delete cascade,
  primary key (email, proceso_id)
);

alter table public.admin_roles enable row level security;
alter table public.admin_role_procesos enable row level security;
