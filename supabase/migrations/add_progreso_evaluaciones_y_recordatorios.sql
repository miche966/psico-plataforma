-- Segunda fase: seguimiento operativo y control de recordatorios.
-- Aplicar despu?s de revisar las pol?ticas de acceso del proyecto Supabase.
create table if not exists public.progreso_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  proceso_id uuid not null references public.procesos(id) on delete cascade,
  evaluacion_key text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'pausada', 'completada', 'error', 'vencida')),
  iniciada_en timestamptz,
  ultima_actividad_en timestamptz,
  completada_en timestamptz,
  pregunta_actual integer,
  total_preguntas integer,
  respuestas_completadas integer not null default 0,
  ultimo_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidato_id, proceso_id, evaluacion_key)
);
create index if not exists progreso_evaluaciones_proceso_estado_idx on public.progreso_evaluaciones (proceso_id, estado);
create index if not exists progreso_evaluaciones_actividad_idx on public.progreso_evaluaciones (ultima_actividad_en);
create table if not exists public.recordatorios_evaluacion (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid references public.candidatos(id) on delete set null,
  proceso_id uuid references public.procesos(id) on delete set null,
  email text not null,
  estado text not null check (estado in ('enviado', 'error')),
  pendientes text,
  error text,
  enviado_en timestamptz not null default now()
);
create index if not exists recordatorios_evaluacion_destino_idx on public.recordatorios_evaluacion (candidato_id, proceso_id, enviado_en desc);

-- Seguridad: las tablas no exponen acceso público. El endpoint servidor usa
-- SUPABASE_SERVICE_ROLE_KEY y valida el token firmado antes de escribir.
alter table public.progreso_evaluaciones enable row level security;
alter table public.recordatorios_evaluacion enable row level security;

