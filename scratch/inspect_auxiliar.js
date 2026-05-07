
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: procesos, error } = await supabase
    .from('procesos')
    .select('*')
    .ilike('nombre', '%Gestión Humana%');

  if (error) {
    console.error(error);
    return;
  }

  console.log(JSON.stringify(procesos, null, 2));
}

run();
