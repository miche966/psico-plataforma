const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.*)/)[1].trim();

async function list() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Status:', res.status);
    const geminis = data.models.filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'));
    console.log('Gemini Models found:', JSON.stringify(geminis, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

list();
