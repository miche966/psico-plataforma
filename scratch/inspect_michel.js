const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzAxMTIsImV4cCI6MjA5MjcwNjExMn0.bEG_R33vXSxvMnQlPrAUNLdIS-suWbpYsUgOzuSewUQ');

async function inspect() {
  const { data: cands } = await supabase.from('candidatos').select('id, nombre').ilike('nombre', '%Michel%');
  console.log('Candidatos Michel:', cands);

  if (cands && cands.length > 0) {
    const { data: sess } = await supabase.from('sesiones').select('*').eq('candidato_id', cands[0].id);
    console.log('Sesiones Michel:', JSON.stringify(sess, null, 2));
  }
}

inspect();
