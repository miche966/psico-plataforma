
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env.local') });

async function listAllModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('--- MODELOS DISPONIBLES EN TU CUENTA ---');
    if (data.models) {
      data.models.forEach(m => {
        if (m.supportedGenerationMethods.includes('generateContent')) {
          console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
        }
      });
    } else {
      console.log('No se encontraron modelos. Respuesta:', data);
    }
  } catch (error) {
    console.error('Error consultando a Google:', error.message);
  }
}

listAllModels();
