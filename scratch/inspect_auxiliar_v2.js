
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: procesos, error } = await supabase
    .from('procesos')
    .select('*')
    .ilike('nombre', '%Gestión Humana%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('RESULTADO:');
  console.log(JSON.stringify(procesos, null, 2));
}

run();
