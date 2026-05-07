const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.*)/)[1].trim();

async function test() {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${key}`;
  
  const body = {
    contents: [{ parts: [{ text: "hola" }] }]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
