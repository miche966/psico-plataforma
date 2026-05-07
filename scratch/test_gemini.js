const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.*)/)[1].trim();

const genAI = new GoogleGenerativeAI(key);

async function list() {
  try {
    console.log('--- TEST 1: gemini-1.5-flash ---');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('hola');
    console.log('EXITO con gemini-1.5-flash:', result.response.text().substring(0, 50));
  } catch (e) {
    console.log('FALLO con gemini-1.5-flash:', e.message);
  }
  
  try {
    console.log('\n--- TEST 2: gemini-pro ---');
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('hola');
    console.log('EXITO con gemini-pro:', result.response.text().substring(0, 50));
  } catch (e2) {
    console.log('FALLO con gemini-pro:', e2.message);
  }
}

list();
