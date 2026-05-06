
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';
const supabase = createClient(supabaseUrl, supabaseKey);

const ID_BROU = '4ecf6491-5899-486f-96f3-0fdfc71235f9';
const ID_AGUSTINA = '65eaf1dd-9294-4308-9746-25815c4b782c';
const ID_MICHEL_DUP = '0695b54c-6f60-49bf-b60a-50f69a3ebe12';

async function fix() {
  console.log('Desvinculando candidatos no deseados del proceso Auxiliar...');

  // 1. Mover a Agustina a BROU
  const { error: errorAgustina } = await supabase
    .from('sesiones')
    .update({ proceso_id: ID_BROU })
    .eq('candidato_id', ID_AGUSTINA);

  if (errorAgustina) console.error('Error moviendo a Agustina:', errorAgustina);
  else console.log('Agustina Quinteiro movida de vuelta a BROU.');

  // 2. Desvincular Michel duplicado (anular proceso)
  const { error: errorMichel } = await supabase
    .from('sesiones')
    .update({ proceso_id: null })
    .eq('candidato_id', ID_MICHEL_DUP);

  if (errorMichel) console.error('Error desvinculando Michel duplicado:', errorMichel);
  else console.log('Sesión de Michel Ochoa (duplicado) desvinculada.');
}

fix();
