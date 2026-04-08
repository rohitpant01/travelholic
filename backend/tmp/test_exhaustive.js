const axios = require('axios');
require('dotenv').config({ path: './.env' });

const KEY = process.env.GOOGLE_GEMINI_API_KEY;

async function test(model, version) {
  const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${KEY}`;
  try {
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: "Hi" }] }]
    });
    console.log(`✅ ${version} | ${model}: SUCCESS`);
    return true;
  } catch (err) {
    console.log(`❌ ${version} | ${model}: ${err.response ? err.response.status : err.message}`);
    return false;
  }
}

async function run() {
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-pro'];
  const versions = ['v1', 'v1beta'];
  
  for (const v of versions) {
    for (const m of models) {
      await test(m, v);
    }
  }
}

run();
