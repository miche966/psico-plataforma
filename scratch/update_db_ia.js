const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://hgoumdjvusixbjkiexjd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8'
)

async function run() {
  console.log('Intentando añadir columnas de IA a respuestas_video...')
  
  // Como no tenemos rpc('exec_sql') probablemente, intentamos una inserción que falle 
  // pero que nos diga si las columnas existen o no.
  // Pero lo más limpio es decirte qué ejecutar en el panel de Supabase si esto falla.
  
  console.log('----------------------------------------------------')
  console.log('EJECUTA ESTO EN EL SQL EDITOR DE SUPABASE:')
  console.log('----------------------------------------------------')
  console.log(`
    ALTER TABLE respuestas_video 
    ADD COLUMN IF NOT EXISTS transcripcion TEXT,
    ADD COLUMN IF NOT EXISTS analisis_ia JSONB;
  `)
  console.log('----------------------------------------------------')
}

run()
