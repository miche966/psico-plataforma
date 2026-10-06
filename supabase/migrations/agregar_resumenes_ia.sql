-- Guarda el resumen ejecutivo con IA de cada candidato (uno por candidato y proceso), para que no se pierda al recargar el panel.
-- Aditivo: solo crea una tabla nueva y vacia; no toca ninguna tabla ni fila existente. Ejecutar a mano en el SQL Editor de Supabase.
-- Revertir: eliminar la tabla resumenes_ia (public.resumenes_ia) desde el Table Editor; el panel sigue funcionando sin ella.
BEGIN;

create table if not exists public.resumenes_ia (
  id uuid primary key default gen_random_uuid(),
  -- "candidato:proceso" (o "candidato:independiente"): permite reemplazar el resumen anterior con un upsert
  clave text not null unique,
  candidato_id uuid not null references public.candidatos (id) on delete cascade,
  proceso_id uuid references public.procesos (id) on delete cascade,
  resumen text not null,
  generado_en timestamptz not null default now(),
  generado_por text not null
);

-- Con clave foranea a proposito: si se borra al candidato (o al proceso), su resumen se borra tambien.
create index if not exists resumenes_ia_candidato_idx on public.resumenes_ia (candidato_id);

-- Seguridad: sin acceso publico. Solo el servidor (service role) escribe y lee; con RLS activo y
-- ninguna politica, anon y authenticated no pueden ver ni modificar nada (mismo patron que el resto).
alter table public.resumenes_ia enable row level security;

COMMIT;
