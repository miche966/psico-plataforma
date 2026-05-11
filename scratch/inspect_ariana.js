const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzAxMTIsImV4cCI6MjA5MjcwNjExMn0.bEG_R33vXSxvMnQlPrAUNLdIS-suWbpYsUgOzuSewUQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectCandidate() {
    console.log('--- Buscando candidata: Ariana Martinez Nuñez ---');
    
    // Buscar por nombre
    const { data: candidatos, error: candErr } = await supabase
        .from('candidatos')
        .select('*')
        .or('nombre.ilike.%Ariana%,apellido.ilike.%Ariana%');

    if (candErr) {
        console.error('Error buscando candidato:', candErr);
        return;
    }

    if (!candidatos || candidatos.length === 0) {
        console.log('No se encontró a la candidata.');
        return;
    }

    for (const cand of candidatos) {
        console.log(`\nCandidato ID: ${cand.id}`);
        console.log(`Nombre: ${cand.nombre} ${cand.apellido}`);
        console.log(`Email: ${cand.email}`);
        console.log(`Creado el: ${cand.created_at}`);

        // Buscar sesiones
        const { data: sesiones, error: sesErr } = await supabase
            .from('sesiones')
            .select('id, test_id, proceso_id, estado, created_at')
            .eq('candidato_id', cand.id);

        if (sesErr) {
            console.error('Error buscando sesiones:', sesErr);
            continue;
        }

        if (!sesiones || sesiones.length === 0) {
            console.log('No tiene sesiones de evaluación.');
        } else {
            console.log(`Sesiones encontradas (${sesiones.length}):`);
            sesiones.forEach(s => {
                console.log(` - ID: ${s.id}, Test: ${s.test_id}, Proceso: ${s.proceso_id || 'SIN ASIGNAR'}, Estado: ${s.estado}, Fecha: ${s.created_at}`);
            });
        }
    }
}

inspectCandidate();
