
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkCandidatos() {
  const { data: candidatos, error } = await supabase
    .from('candidatos')
    .select('id, nombre, apellido')
    .in('nombre', ['Lucía', 'Iliana', 'Franco']);

  console.log('Candidatos encontrados:', candidatos);

  for (const c of candidatos || []) {
    const { data: sesiones } = await supabase
      .from('sesiones')
      .select('id, test_id, puntaje_bruto, estado')
      .eq('candidato_id', c.id);
    
    console.log(`Sesiones para ${c.nombre} ${c.apellido}:`);
    sesiones?.forEach(s => {
      console.log(`- ID: ${s.id}, Test: ${s.test_id}, Estado: ${s.estado}`);
      console.log(`  Puntaje: ${JSON.stringify(s.puntaje_bruto, null, 2)}`);
    });
  }
}

checkCandidatos();
