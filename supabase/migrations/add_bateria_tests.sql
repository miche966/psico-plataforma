-- Agrega columna bateria_tests a la tabla procesos
-- Ejecutar en el SQL Editor de Supabase Dashboard

ALTER TABLE procesos
  ADD COLUMN IF NOT EXISTS bateria_tests JSONB DEFAULT '[]'::jsonb;
