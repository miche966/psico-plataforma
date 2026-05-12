
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMartina() {
    console.log(`--- INVESTIGANDO DATOS DE MARTINA TERRA OLIVETTO ---`);
    
    // 1. Buscar por nombre
    const { data: cand } = await supabase.from('candidatos')
        .select('*')
        .or('nombre.ilike.%Martina%,apellido.ilike.%Terra%');
    
    if (!cand || cand.length === 0) {
        console.log('No se encontró ningún candidato con ese nombre.');
        return;
    }

    console.log('\nCandidatos encontrados:', JSON.stringify(cand, null, 2));

    for (const c of cand) {
        console.log(`\n--- Analizando ID: ${c.id} (${c.nombre} ${c.apellido}) ---`);
        
        // 2. Buscar sesiones
        const { data: sess } = await supabase.from('sesiones')
            .select('*')
            .eq('candidato_id', c.id)
            .order('finalizada_en', { ascending: false });
            
        console.log(`Sesiones (Total: ${sess?.length || 0}):`);
        sess?.forEach((s, i) => {
            console.log(`\n[${i+1}] Test: ${s.test_id} | Finalizada: ${s.finalizada_en}`);
            console.log(`Puntaje Bruto:`, JSON.stringify(s.puntaje_bruto, null, 2));
        });
    }
}

checkMartina();
