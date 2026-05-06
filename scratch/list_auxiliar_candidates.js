
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';
const supabase = createClient(supabaseUrl, supabaseKey);

const ID_AUXILIAR = '13466a4b-ec9b-47ae-b44e-8f81b7d41c01';

async function listCandidates() {
  // 1. Obtener sesiones vinculadas
  const { data: sesiones, error: sError } = await supabase
    .from('sesiones')
    .select('candidato_id')
    .eq('proceso_id', ID_AUXILIAR);

  if (sError) { console.error(sError); return; }

  const candidateIds = [...new Set(sesiones.map(s => s.candidato_id))];

  // 2. Obtener nombres de candidatos
  const { data: candidatos, error: cError } = await supabase
    .from('candidatos')
    .select('id, nombre, apellido')
    .in('id', candidateIds);

  if (cError) { console.error(cError); return; }

  console.log('Candidatos vinculados al proceso Auxiliar:');
  candidatos.forEach(c => {
    console.log(`- ${c.nombre} ${c.apellido} (ID: ${c.id})`);
  });
}

listCandidates();
