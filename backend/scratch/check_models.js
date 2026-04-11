require('dotenv').config({ path: './backend/.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkModels() {
    const keys = [
        process.env.GOOGLE_GEMINI_API_KEY,
        process.env.GOOGLE_GEMINI_REC_API_KEY,
        process.env.GOOGLE_GEMINI_FALLBACK_KEY,
    ].filter(Boolean);

    for (const [idx, key] of keys.entries()) {
        try {
            console.log(`\n--- Checking Key ${idx} ---`);
            const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
            const data = await res.json();
            if (data.models) {
                console.log(`Available models:`, data.models.map(m => m.name));
            } else {
                console.log(`Error listing models:`, JSON.stringify(data));
            }
        } catch (e) {
            console.error(`Key ${idx} failed to fetch: ${e.message}`);
        }
    }
}

checkModels();
