const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Usamos el cliente directamente para listar
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    console.log("--- MODELOS DISPONIBLES EN TU CUENTA ---");
    if (data.models) {
      data.models.forEach(m => {
        console.log(`- ID: ${m.name.replace('models/', '')} | Métodos: ${m.supportedGenerationMethods.join(', ')}`);
      });
    } else {
      console.log("No se recibieron modelos. Respuesta completa:", JSON.stringify(data));
    }
  } catch (error) {
    console.error("Error al listar modelos:", error.message);
  }
}

listModels();
