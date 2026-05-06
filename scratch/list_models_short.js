const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.*)/)[1].trim();

async function list() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Available Models:');
    data.models.forEach(m => console.log(m.name));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
list();
