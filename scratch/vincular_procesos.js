const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8');

async function run() {
  // ATENCIÓN: No usar IDs hardcoded para evitar vincular sesiones a procesos equivocados
  const procesoId = process.argv[2]; 

  if (!procesoId) {
    console.error('ERROR: Debes proporcionar un UUID de proceso como argumento.');
    console.log('Uso: node scratch/vincular_procesos.js <UUID_PROCESO>');
    return;
  }

  console.log(`Vinculando sesiones huérfanas al proceso: ${procesoId}...`);

  // Actualizar todas las sesiones que tengan proceso_id null
  const { data, error } = await s.from('sesiones')
    .update({ proceso_id: procesoId })
    .is('proceso_id', null);

  if (error) console.error('Error al vincular:', error);
  else console.log('Vinculación completada con éxito.');
}

run();
