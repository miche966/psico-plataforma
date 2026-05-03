const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8');

async function run() {
  const procesoId = '4ecf6491-5899-486f-96f3-0fdfc71235f9'; // Pasantías Yo Estudio y Trabajo BROU

  console.log('Vinculando sesiones huérfanas al proceso BROU...');

  // Actualizar todas las sesiones que tengan proceso_id null y que hayan sido creadas recientemente
  const { data, error } = await s.from('sesiones')
    .update({ proceso_id: procesoId })
    .is('proceso_id', null);

  if (error) console.error('Error al vincular:', error);
  else console.log('Vinculación completada con éxito.');
}

run();
