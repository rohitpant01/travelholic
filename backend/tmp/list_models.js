const axios = require('axios');
require('dotenv').config({ path: './.env' });

const KEY = process.env.GOOGLE_GEMINI_API_KEY;

async function listAll() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}`;
  try {
    const res = await axios.get(url);
    const all = res.data.models.map(m => m.name.replace('models/', ''));
    console.log("ALL MODELS:", all.join('\n'));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

listAll();
