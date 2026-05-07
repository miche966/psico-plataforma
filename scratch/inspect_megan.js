const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hgoumdjvusixbjkiexjd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8'
);

async function inspect() {
  const meganId = 'c999b174-fd9f-4a73-a4d1-f36e12914f5a';
  const { data: sesiones, error } = await supabase
    .from('sesiones')
    .select('*')
    .eq('candidato_id', meganId);

  if (error) {
    console.error(error);
    return;
  }

  sesiones.forEach(s => {
    console.log(`\n--- Test: ${s.test_id} (${s.finalizada_en}) ---`);
    console.log('Puntaje Bruto:', JSON.stringify(s.puntaje_bruto, null, 2));
  });
}

inspect();
