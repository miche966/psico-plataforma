const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  const { data: sesiones, error } = await supabase
    .from('sesiones')
    .select('id, created_at, iniciada_en, finalizada_en')
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- MUESTRA DE DATOS DE SESIONES ---');
  sesiones.forEach(s => {
    const start = new Date(s.created_at).getTime();
    const end = new Date(s.finalizada_en).getTime();
    const diff = (end - start) / 1000 / 60;
    console.log(`ID: ${s.id}`);
    console.log(`Created: ${s.created_at}`);
    console.log(`Iniciada: ${s.iniciada_en}`);
    console.log(`Finalizada: ${s.finalizada_en}`);
    console.log(`Diferencia Calculada: ${diff.toFixed(2)} min`);
    console.log('-------------------');
  });
}

inspect();
