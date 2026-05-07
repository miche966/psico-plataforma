
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';
const supabase = createClient(supabaseUrl, supabaseKey);

const ID_AUXILIAR = '13466a4b-ec9b-47ae-b44e-8f81b7d41c01';

async function checkMichels() {
  const { data: sesiones, error } = await supabase
    .from('sesiones')
    .select('id, candidato_id, test_id, puntaje_bruto')
    .eq('proceso_id', ID_AUXILIAR);

  if (error) { console.error(error); return; }

  const michel1 = sesiones.filter(s => s.candidato_id === '99f7e4dd-9fec-4d7b-acd6-be78e272316b');
  const michel2 = sesiones.filter(s => s.candidato_id === '0695b54c-6f60-49bf-b60a-50f69a3ebe12');
  const agustina = sesiones.filter(s => s.candidato_id === '65eaf1dd-9294-4308-9746-25815c4b782c');

  console.log('Michel 1 (99f7...):', michel1.length, 'sesiones');
  console.log('Michel 2 (0695...):', michel2.length, 'sesiones');
  console.log('Agustina (65ea...):', agustina.length, 'sesiones');
}

checkMichels();
