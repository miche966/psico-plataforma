const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function testUnlink() {
  // Intentamos desvincular una sesión cualquiera para ver el error
  const { data: sesion } = await supabase.from('sesiones').select('*').limit(1).single();
  
  if (!sesion) {
    console.log('No hay sesiones para probar');
    return;
  }

  console.log(`Probando desvincular sesión ${sesion.id} del proceso ${sesion.proceso_id}`);

  const { error } = await supabase
    .from('sesiones')
    .update({ proceso_id: null })
    .eq('id', sesion.id);

  if (error) {
    console.log('ERROR DETECTADO:');
    console.log('Mensaje:', error.message);
    console.log('Código:', error.code);
    console.log('Detalles:', error.details);
    console.log('Hint:', error.hint);
  } else {
    console.log('Éxito: El campo proceso_id permite NULL');
    // Revertimos para no romper nada
    await supabase.from('sesiones').update({ proceso_id: sesion.proceso_id }).eq('id', sesion.id);
  }
}

testUnlink();
