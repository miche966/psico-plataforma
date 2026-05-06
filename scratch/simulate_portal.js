const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzAxMTIsImV4cCI6MjA5MjcwNjExMn0.bEG_R33vXSxvMnQlPrAUNLdIS-suWbpYsUgOzuSewUQ');

const candidatoId = '99f7e4dd-9fec-4d7b-acd6-be78e272316b';
const procesoId = '13466a4b-ec9b-47ae-b44e-8f81b7d41c01';

async function simulate() {
  const [{ data: cand }, { data: proc }] = await Promise.all([
    supabase.from('candidatos').select('nombre, apellido').eq('id', candidatoId).single(),
    supabase.from('procesos').select('nombre, cargo, bateria_tests').eq('id', procesoId).single(),
  ])

  console.log('--- PROCESO ---');
  console.log(JSON.stringify(proc, null, 2));

  const { data: sesiones } = await supabase
    .from('sesiones')
    .select('test_id, estado')
    .eq('candidato_id', candidatoId);

  console.log('--- SESIONES ---');
  console.log(JSON.stringify(sesiones, null, 2));
}

simulate();
