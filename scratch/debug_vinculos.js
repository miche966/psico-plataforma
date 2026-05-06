const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function restaurarVinculos() {
  const procesoId = '4ecf6491-c069-4ed2-bbef-0c258be77272'; // Asumiendo el UUID completo
  
  console.log('Buscando sesiones para el proceso...', procesoId);
  
  // 1. Ver qué hay en sesiones
  const { data: sesiones, error: errorS } = await supabase
    .from('sesiones')
    .select('*')
    .or(`proceso_id.eq.${procesoId},proceso_id.is.null`);

  if (errorS) {
    console.error('Error buscando sesiones:', errorS);
    return;
  }

  console.log(`Encontradas ${sesiones.length} sesiones totales.`);
  
  // 2. Si hay sesiones con proceso_id null, intentar restaurarlas si pertenecen a este proceso
  // (Esto es difícil si no sabemos a qué proceso pertenecían antes, pero podemos ver si hay duplicados)
  
  // 3. Vamos a intentar re-vincular a los candidatos que el usuario mencione si es necesario.
  // Por ahora, vamos a ver cuántas sesiones tienen proceso_id real.
  const vinculadas = sesiones.filter(s => s.proceso_id === procesoId);
  console.log(`Vinculadas actualmente: ${vinculadas.length}`);
}

restaurarVinculos();
