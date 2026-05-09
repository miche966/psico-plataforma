const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAvril() {
  const id = '97ffa003-f931-42ab-8552-963d20bf1bc6';
  console.log("=== DIAGNÓSTICO AVRIL ARIAS ===");
  
  const { data: sess, error } = await supabase
    .from('sesiones')
    .select('*')
    .eq('candidato_id', id);

  if (error) {
    console.error("Error Supabase:", error);
    return;
  }

  console.log(`Sesiones encontradas: ${sess.length}`);
  
  sess.forEach((s, i) => {
    console.log(`\n--- Sesión ${i+1} (${s.test_id}) ---`);
    console.log("Estructura de puntaje_bruto:");
    console.dir(s.puntaje_bruto, { depth: null });
    
    // Test de tipos
    Object.entries(s.puntaje_bruto || {}).forEach(([k, v]) => {
      console.log(`Clave: ${k} | Tipo: ${typeof v} | Valor: ${v}`);
      if (typeof v === 'object' && v !== null) {
        Object.entries(v).forEach(([k2, v2]) => {
           console.log(`  > Clave: ${k2} | Tipo: ${typeof v2} | Valor: ${v2}`);
        });
      }
    });
  });
}

debugAvril();
