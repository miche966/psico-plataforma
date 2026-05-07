
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('sesiones').select('*').limit(1);
  if (error) console.error(error);
  else console.log('COLUMNS:', Object.keys(data[0]));
}
inspect();
