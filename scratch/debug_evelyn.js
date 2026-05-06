const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
  const { data: cand } = await supabase.from('candidatos')
    .select('id, nombre, apellido')
    .ilike('nombre', '%Evelyn%');

  console.log('Candidatos encontrados:', cand);

  for (const c of cand) {
    console.log(`\n--- Analizando a: ${c.nombre} ${c.apellido} (${c.id}) ---`);
    
    const { data: videos, error: vErr } = await supabase.from('respuestas_video')
      .select('*, preguntas_video(pregunta)')
      .eq('candidato_id', c.id);
    if (vErr) console.error('Error videos:', vErr);
    console.log(`Videos en DB: ${videos?.length || 0}`);
    
    const { data: sesiones, error: sErr } = await supabase.from('sesiones')
      .select('test_id, finalizada_en')
      .eq('candidato_id', c.id);
    if (sErr) console.error('Error sesiones:', sErr);
    console.log(`Sesiones totales: ${sesiones?.length || 0}`);
    sesiones?.forEach(s => console.log(`- ${s.test_id} (Finalizada: ${s.finalizada_en})`));
  }
}

run();
