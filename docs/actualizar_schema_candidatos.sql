-- SQL para actualizar la tabla de candidatos con los nuevos campos demográficos
-- Ejecuta esto en el SQL Editor de tu Dashboard de Supabase

ALTER TABLE candidatos 
ADD COLUMN IF NOT EXISTS edad INTEGER,
ADD COLUMN IF NOT EXISTS sexo TEXT,
ADD COLUMN IF NOT EXISTS formacion TEXT,
ADD COLUMN IF NOT EXISTS profesion TEXT;

-- Asegurar que el documento sea único si se desea (opcional, pero recomendado)
-- ALTER TABLE candidatos ADD CONSTRAINT candidatos_documento_key UNIQUE (documento);
