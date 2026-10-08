-- Revierte agregar_supervisores.sql: borra las tablas de supervisores (y sus datos) y deja el registro de accesos como antes.
-- Antes de correrlo, si hay filas con rol 'supervisor' en registro_accesos, decidir que hacer con ellas
-- (la restriccion vieja las rechaza y el comando fallaria).
BEGIN;

drop table if exists public.informes_supervisor;
drop table if exists public.supervisor_evaluados;
drop table if exists public.supervisores;

alter table public.registro_accesos drop constraint if exists registro_accesos_rol_check;
alter table public.registro_accesos add constraint registro_accesos_rol_check check (rol in ('admin', 'viewer'));

COMMIT;
