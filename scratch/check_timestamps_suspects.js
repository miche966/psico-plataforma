
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTimestamps() {
  const ids = [
    '99f7e4dd-9fec-4d7b-acd6-be78e272316b', // Michel 1
    '0695b54c-6f60-49bf-b60a-50f69a3ebe12', // Michel 2
    '65eaf1dd-9294-4308-9746-25815c4b782c'  // Agustina
  ];

  const { data: sesiones, error } = await supabase
    .from('sesiones')
    .select('candidato_id, iniciada_en, test_id')
    .in('candidato_id', ids);

  if (error) { console.error(error); return; }

  sesiones.forEach(s => {
    console.log(`Cand: ${s.candidato_id}, Test: ${s.test_id}, Fecha: ${s.iniciada_en}`);
  });
}

checkTimestamps();
