const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkProcesos() {
  const { data: procesos, error } = await supabase
    .from('procesos')
    .select('id, nombre, bateria')
    .ilike('nombre', '%Gestión Humana%');

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- PROCESOS DE GESTIÓN HUMANA ---');
  procesos.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`Nombre: ${p.nombre}`);
    console.log(`Batería Actual: ${p.bateria}`);
    console.log('-------------------');
  });
}

checkProcesos();
