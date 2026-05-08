
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, './.env.local') });

async function listModels() {
  try {
    if (!process.env.GEMINI_API_KEY) {
        console.error('No se encontró la GEMINI_API_KEY en .env.local');
        return;
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Nota: El SDK de Node no tiene un método directo expuesto fácilmente para listar 
    // sin usar la API de administración, pero podemos probar los nombres comunes
    // o intentar una llamada de prueba.
    
    console.log('Probando modelos comunes...');
    const modelosATestear = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'];
    
    for (const m of modelosATestear) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            await model.generateContent('hola');
            console.log(`✅ Modelo DISPONIBLE: ${m}`);
        } catch (e) {
            console.log(`❌ Modelo NO disponible: ${m}. Error: ${e.message}`);
        }
    }
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

listModels();
