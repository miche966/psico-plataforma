const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8');

async function run() {
  const francoEmail = 'francocavalheirohor@gmail.com';

  // 1. Obtener el proceso_id de Franco
  const { data: candFranco } = await s.from('candidatos').select('id').eq('email', francoEmail).single();
  const { data: sessFranco } = await s.from('sesiones').select('proceso_id').eq('candidato_id', candFranco.id).limit(1).single();
  const procesoId = sessFranco.proceso_id;

  console.log(`Auditoría para Proceso ID: ${procesoId}`);

  // 2. Obtener todas las sesiones de este proceso
  const { data: todasSesiones } = await s.from('sesiones').select('*, candidatos(nombre, apellido, email)').eq('proceso_id', procesoId);

  // 3. Agrupar por candidato y test_id
  const mapa = {};
  todasSesiones.forEach(ses => {
    const key = `${ses.candidato_id}_${ses.test_id}`;
    if (!mapa[key]) mapa[key] = [];
    mapa[key].push(ses);
  });

  for (const key in mapa) {
    const intentos = mapa[key];
    if (intentos.length > 1) {
      const c = intentos[0].candidatos;
      console.log(`\nDuplicados encontrados para ${c.nombre} ${c.apellido} (${c.email}):`);
      
      // Encontrar el mejor
      let mejor = intentos[0];
      intentos.forEach(i => {
        const score = i.puntaje_bruto?.correctas || 0;
        const mejorScore = mejor.puntaje_bruto?.correctas || 0;
        if (score > mejorScore) mejor = i;
      });

      const idsABorrar = intentos.filter(i => i.id !== mejor.id).map(i => i.id);
      console.log(`- Manteniendo ID: ${mejor.id} (Puntaje: ${mejor.puntaje_bruto?.correctas || 0})`);
      console.log(`- Borrando ${idsABorrar.length} intentos adicionales.`);

      // Borrar respuestas
      const { error: errResp } = await s.from('respuestas').delete().in('sesion_id', idsABorrar);
      if (errResp) {
        console.error(`  Error borrando respuestas:`, errResp);
        continue;
      }

      // Borrar sesiones
      const { error: errSess } = await s.from('sesiones').delete().in('id', idsABorrar);
      if (errSess) console.error(`  Error borrando sesiones:`, errSess);
      else console.log(`  Limpieza exitosa.`);
    }
  }
  console.log('\nAuditoría y limpieza finalizada.');
}

run();
