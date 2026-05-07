const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzAxMTIsImV4cCI6MjA5MjcwNjExMn0.bEG_R33vXSxvMnQlPrAUNLdIS-suWbpYsUgOzuSewUQ');

async function inspect() {
  const { data, error } = await supabase
    .from('sesiones')
    .select('id, test_id, proceso_id, estado')
    .eq('candidato_id', '99f7e4dd-9fec-4d7b-acd6-be78e272316b');

  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

inspect();
