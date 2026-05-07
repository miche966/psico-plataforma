const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://hgoumdjvusixbjkiexjd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8');

async function run() {
  console.log('Iniciando auditoría global de duplicados...');

  // 1. Obtener todas las sesiones con datos del candidato
  const { data: todas, error } = await s.from('sesiones').select('*, candidatos(nombre, apellido, email)');
  if (error) return console.error('Error al obtener sesiones:', error);

  // 2. Agrupar por candidato_id y test_id
  const grupos = {};
  todas.forEach(ses => {
    const key = `${ses.candidato_id}_${ses.test_id}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(ses);
  });

  let totalBorrados = 0;

  for (const key in grupos) {
    const intentos = grupos[key];
    if (intentos.length > 1) {
      const c = intentos[0].candidatos || { nombre: 'Anon', apellido: 'Anon', email: 'N/A' };
      console.log(`\nDuplicados para: ${c.nombre} ${c.apellido} (${c.email}) - Test ID: ${intentos[0].test_id}`);
      
      // Encontrar el mejor
      let mejor = intentos[0];
      intentos.forEach(i => {
        const score = i.puntaje_bruto?.correctas || 0;
        const mejorScore = mejor.puntaje_bruto?.correctas || 0;
        if (score > mejorScore) mejor = i;
      });

      const idsABorrar = intentos.filter(i => i.id !== mejor.id).map(i => i.id);
      console.log(`- Manteniendo: ${mejor.id} (Puntaje: ${mejor.puntaje_bruto?.correctas || 0})`);
      console.log(`- Eliminando: ${idsABorrar.length} duplicados.`);

      // Borrar respuestas
      const { error: errResp } = await s.from('respuestas').delete().in('sesion_id', idsABorrar);
      if (errResp) {
        console.error(`  Error en respuestas:`, errResp);
        continue;
      }

      // Borrar sesiones
      const { error: errSess } = await s.from('sesiones').delete().in('id', idsABorrar);
      if (errSess) {
        console.error(`  Error en sesiones:`, errSess);
      } else {
        totalBorrados += idsABorrar.length;
        console.log(`  Limpieza exitosa.`);
      }
    }
  }

  console.log(`\nAuditoría finalizada. Total de sesiones duplicadas eliminadas: ${totalBorrados}`);
}

run();
