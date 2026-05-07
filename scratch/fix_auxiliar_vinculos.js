
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';

const supabase = createClient(supabaseUrl, supabaseKey);

const ID_BROU = '4ecf6491-5899-486f-96f3-0fdfc71235f9';
const ID_AUXILIAR = '13466a4b-ec9b-47ae-b44e-8f81b7d41c01';
const FECHA_CORTE = '2026-05-05T22:44:00Z'; // Justo antes de crear Auxiliar

async function run() {
  console.log('--- REPARACIÓN DE VÍNCULOS ---');
  
  // 1. Buscar sesiones sospechosas
  const { data: sesiones, error } = await supabase
    .from('sesiones')
    .select('id, iniciada_en, candidato_id, test_id, proceso_id')
    .gt('iniciada_en', FECHA_CORTE);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const paraCorregir = sesiones.filter(s => s.proceso_id === ID_BROU || s.proceso_id === null);
  
  console.log(`Encontradas ${sesiones.length} sesiones después de la fecha de corte.`);
  console.log(`Sesiones para corregir (vinculadas a BROU o NULL): ${paraCorregir.length}`);

  if (paraCorregir.length === 0) {
    console.log('No hay nada que corregir.');
    return;
  }

  // 2. Ejecutar corrección
  const ids = paraCorregir.map(s => s.id);
  const { error: updateError } = await supabase
    .from('sesiones')
    .update({ proceso_id: ID_AUXILIAR })
    .in('id', ids);

  if (updateError) {
    console.error('Error actualizando:', updateError);
  } else {
    console.log(`ÉXITO: ${paraCorregir.length} sesiones re-vinculadas al proceso Auxiliar.`);
  }
}

run();
