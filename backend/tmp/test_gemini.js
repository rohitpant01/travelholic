const axios = require('axios');
require('dotenv').config({ path: './.env' });

const KEYS = [
  process.env.GOOGLE_GEMINI_API_KEY,
  process.env.GOOGLE_GEMINI_REC_API_KEY,
  process.env.GOOGLE_GEMINI_FALLBACK_KEY
].filter(Boolean);

async function testKey(key, name) {
  console.log(`\n--- Testing Key: ${name} (${key.substring(0, 10)}...) ---`);
  
  // 1. Try List Models
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  try {
    const listRes = await axios.get(listUrl);
    const modelNames = listRes.data.models.map(m => m.name.replace('models/', ''));
    console.log("🟢 Models Available:", modelNames.slice(0, 5).join(', ') + '...');
    
    // 2. Try simple generation if list worked
    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
    const genRes = await axios.post(genUrl, {
      contents: [{ parts: [{ text: "Hi" }] }]
    });
    console.log("✅ Generation Success!");
  } catch (err) {
    if (err.response) {
      console.log(`❌ Error ${err.response.status}:`, err.response.data.error?.message || "Unknown error");
    } else {
      console.log(`❌ Network Error:`, err.message);
    }
  }
}

async function runAll() {
  for (let i = 0; i < KEYS.length; i++) {
    await testKey(KEYS[i], `Key ${i+1}`);
  }
}

runAll();
