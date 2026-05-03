const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8');

async function run() {
  const email = 'francocavalheirohor@gmail.com';
  const testId = 'b8c9d0e1-f2a3-4567-bcde-888888888888';

  const { data: c } = await s.from('candidatos').select('id').eq('email', email).single();
  if (!c) return console.log('Candidato no encontrado');

  const { data: sess } = await s.from('sesiones').select('*').eq('candidato_id', c.id).eq('test_id', testId);
  
  if (!sess || sess.length <= 1) {
    console.log('No hay duplicados para limpiar.');
    return;
  }

  let mejor = sess[0];
  sess.forEach(session => {
    const score = session.puntaje_bruto?.correctas || 0;
    const mejorScore = mejor.puntaje_bruto?.correctas || 0;
    if (score > mejorScore) {
      mejor = session;
    }
  });

  const idsABorrar = sess.filter(s => s.id !== mejor.id).map(s => s.id);
  console.log('Borrando respuestas para IDs:', idsABorrar);

  // Borrar respuestas primero
  const { error: errResp } = await s.from('respuestas').delete().in('sesion_id', idsABorrar);
  if (errResp) return console.error('Error al borrar respuestas:', errResp);

  console.log('Borrando sesiones...');
  const { error: errSess } = await s.from('sesiones').delete().in('id', idsABorrar);
  if (errSess) console.error('Error al borrar sesiones:', errSess);
  else console.log('Limpieza completada con éxito. Se mantuvo el intento con puntaje:', mejor.puntaje_bruto?.correctas);
}

run();
