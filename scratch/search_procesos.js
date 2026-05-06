const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzAxMTIsImV4cCI6MjA5MjcwNjExMn0.bEG_R33vXSxvMnQlPrAUNLdIS-suWbpYsUgOzuSewUQ');

async function inspect() {
  const { data, error } = await supabase
    .from('procesos')
    .select('id, nombre, cargo, bateria_tests')
    .ilike('nombre', '%Auxiliar%');

  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

inspect();
