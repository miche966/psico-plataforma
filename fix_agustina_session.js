
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fixSession() {
  const { data: candidatos, error: cError } = await supabase
    .from('candidatos')
    .select('id, nombre, apellido')
    .ilike('nombre', '%Agustina%')
    .ilike('apellido', '%Quinteiro%');

  if (cError) {
    console.error('Error buscando candidato:', cError);
    return;
  }

  if (!candidatos || candidatos.length === 0) {
    console.log('No se encontró a Agustina Quinteiro');
    return;
  }

  const candidatoId = candidatos[0].id;
  console.log(`Candidato encontrado: ${candidatos[0].nombre} ${candidatos[0].apellido} (ID: ${candidatoId})`);

  // Buscar sesiones de esta persona
  const { data: sesiones, error: sError } = await supabase
    .from('sesiones')
    .select('*')
    .eq('candidato_id', candidatoId);

  if (sError) {
    console.error('Error buscando sesiones:', sError);
    return;
  }

  console.log(`Sesiones encontradas: ${sesiones.length}`);
  
  for (const sesion of sesiones) {
    console.log(`Sesion ID: ${sesion.id}, Estado: ${sesion.estado}`);
    if (sesion.estado === 'completado' || sesion.estado === 'finalizado') {
      const { error: uError } = await supabase
        .from('sesiones')
        .update({ estado: 'en_progreso', finalizada_en: null })
        .eq('id', sesion.id);
      
      if (uError) {
        console.error(`Error actualizando sesión ${sesion.id}:`, uError);
      } else {
        console.log(`Sesión ${sesion.id} reseteada a 'en_progreso'`);
      }
    }
  }
}

fixSession();
