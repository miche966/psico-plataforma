
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan las llaves de Supabase en .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFranco() {
    const id = '34ccc7de-b9c7-45c1-b9ac-61cd0a1cced4';
    
    console.log(`--- INVESTIGANDO DATOS DE FRANCO RODRÍGUEZ ---`);
    
    // 1. Candidato
    const { data: cand } = await supabase.from('candidatos').select('*').eq('id', id).single();
    console.log('\nCandidato:', JSON.stringify(cand, null, 2));

    // 2. Sesiones
    const { data: sess } = await supabase.from('sesiones').select('*').eq('candidato_id', id).order('finalizada_en', { ascending: false });
    console.log('\nSesiones (Total: ' + (sess?.length || 0) + '):');
    sess?.forEach((s, i) => {
        console.log(`\n[${i+1}] Test: ${s.test_id}`);
        console.log(`Puntaje Bruto:`, JSON.stringify(s.puntaje_bruto, null, 2));
    });

    // 3. Proceso
    if (cand?.proceso_id) {
        const { data: proc } = await supabase.from('procesos').select('*').eq('id', cand.proceso_id).single();
        console.log('\nProceso Asignado:', JSON.stringify(proc, null, 2));
    }

    // 4. Informe guardado
    const { data: rep } = await supabase.from('informes_psicometricos').select('*').eq('candidato_id', id).single();
    console.log('\nInforme Guardado:', JSON.stringify(rep, null, 2));
}

checkFranco();
