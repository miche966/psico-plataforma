const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hgoumdjvusixbjkiexjd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhnb3VtZGp2dXNpeGJqa2lleGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEzMDExMiwiZXhwIjoyMDkyNzA2MTEyfQ.7-Kw_70zKO3rwRVOd6hPJ8fxTEjusQSXgKhbNpw33k8';
const supabase = createClient(supabaseUrl, supabaseKey);

const DASS21_TEST_ID = '7a8b9c0d-e1f2-4356-abcd-999999999999';

async function setupDASS21() {
  console.log('--- Creando Test DASS-21 ---');
  
  const { error: testError } = await supabase.from('tests').insert({
    id: DASS21_TEST_ID,
    nombre: 'Screening de Salud Mental (DASS-21)',
    descripcion: 'Escala de Depresión, Ansiedad y Estrés (DASS-21). Evalúa estados emocionales negativos de las últimas semanas.',
    tipo: 'clinico',
    tiempo_limite: 10,
    activo: true
  });

  if (testError && !testError.message.includes('duplicate key')) {
    console.error('Error creando test:', testError);
    return;
  }

  console.log('--- Insertando Items ---');
  
  const items = [
    { orden: 1, factor: 'estres', contenido: 'Me costó mucho descargar la tensión.' },
    { orden: 2, factor: 'ansiedad', contenido: 'Me di cuenta que tenía la boca seca.' },
    { orden: 3, factor: 'depresion', contenido: 'No podía sentir nada positivo.' },
    { orden: 4, factor: 'ansiedad', contenido: 'Se me hizo difícil respirar.' },
    { orden: 5, factor: 'depresion', contenido: 'Me resultó difícil tomar la iniciativa para hacer cosas.' },
    { orden: 6, factor: 'estres', contenido: 'Reaccioné exageradamente en ciertas situaciones.' },
    { orden: 7, factor: 'ansiedad', contenido: 'Sentí que mis manos temblaban.' },
    { orden: 8, factor: 'estres', contenido: 'Sentí que tenía mucha energía nerviosa.' },
    { orden: 9, factor: 'ansiedad', contenido: 'Estaba preocupado por situaciones en las cuales podría tener pánico o podría hacer el ridículo.' },
    { orden: 10, factor: 'depresion', contenido: 'Sentí que no tenía nada por qué vivir.' },
    { orden: 11, factor: 'estres', contenido: 'Noté que me agitaba.' },
    { orden: 12, factor: 'estres', contenido: 'Se me hizo difícil relajarme.' },
    { orden: 13, factor: 'depresion', contenido: 'Me sentí triste y deprimido.' },
    { orden: 14, factor: 'estres', contenido: 'No toleré nada que me impidiera continuar con lo que estaba haciendo.' },
    { orden: 15, factor: 'ansiedad', contenido: 'Sentí que estaba al punto de tener pánico.' },
    { orden: 16, factor: 'depresion', contenido: 'No me pude entusiasmar por nada.' },
    { orden: 17, factor: 'depresion', contenido: 'Sentí que valía muy poco como persona.' },
    { orden: 18, factor: 'estres', contenido: 'Sentí que estaba muy susceptible.' },
    { orden: 19, factor: 'ansiedad', contenido: 'Sentí los latidos de mi corazón a pesar de no haber hecho ningún esfuerzo físico.' },
    { orden: 20, factor: 'ansiedad', contenido: 'Sentí miedo sin saber por qué.' },
    { orden: 21, factor: 'depresion', contenido: 'Sentí que la vida no tenía sentido.' }
  ];

  const itemsToInsert = items.map(item => ({
    test_id: DASS21_TEST_ID,
    orden: item.orden,
    tipo: 'escala',
    contenido: item.contenido,
    opciones: ['No me ha ocurrido', 'Me ha ocurrido un poco', 'Me ha ocurrido bastante', 'Me ha ocurrido mucho'],
    escala: 4,
    factor: item.factor,
    inverso: false
  }));

  const { error: itemsError } = await supabase.from('items').insert(itemsToInsert);

  if (itemsError) {
    console.error('Error insertando items:', itemsError);
  } else {
    console.log('DASS-21 configurado con éxito.');
  }
}

setupDASS21();
