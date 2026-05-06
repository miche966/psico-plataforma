const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
  const { data: cand } = await supabase.from('candidatos')
    .select('id, nombre, apellido')
    .ilike('apellido', '%Genta%');

  if (!cand || cand.length === 0) {
    console.log('Candidato no encontrado');
    return;
  }

  const id = cand[0].id;
  console.log(`Candidato: ${cand[0].nombre} ${cand[0].apellido} (${id})`);

  const { data: videos } = await supabase.from('respuestas_video')
    .select('*, preguntas_video(pregunta)')
    .eq('candidato_id', id)
    .order('grabada_en', { ascending: true });

  const entrevistasUnicas = new Set(videos.map(v => v.entrevista_id));
  console.log(`\nEntrevistas únicas encontradas: ${entrevistasUnicas.size}`);
  entrevistasUnicas.forEach(eid => {
    const vids = videos.filter(v => v.entrevista_id === eid);
    console.log(`- Entrevista ID: ${eid} (${vids.length} videos, Primera grabación: ${vids[0].grabada_en})`);
    vids.forEach((v, i) => {
      console.log(`  [${i+1}] Pregunta ID: ${v.pregunta_id.slice(0,8)} - ${v.preguntas_video?.pregunta?.substring(0, 50)}...`);
    });
  });
}

run();
