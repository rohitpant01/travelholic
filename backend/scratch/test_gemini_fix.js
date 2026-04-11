require('dotenv').config({ path: './backend/.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");
// No need to require aiController if we are just testing the keys and model here

async function testHiddenPlaces() {
    console.log("Starting Hidden Places test...");
    
    // We want to test the generateDestinations handler or ideally fetchFromGemini directly.
    // Since fetchFromGemini is internal to the module, we might need to export it for testing 
    // or call the exported generateDestinations.
    
    // For simplicity, let's just check if we can call Gemini with the current config.
    const GEMINI_MODEL = "gemini-2.0-flash";
    const GEMINI_KEYS = [
        process.env.GOOGLE_GEMINI_API_KEY,
        process.env.GOOGLE_GEMINI_REC_API_KEY,
        process.env.GOOGLE_GEMINI_FALLBACK_KEY,
    ].filter(Boolean);

    console.log(`Testing with ${GEMINI_KEYS.length} keys...`);

    for (const [idx, key] of GEMINI_KEYS.entries()) {
        try {
            console.log(`Testing Key index ${idx}: ${key.substring(0, 8)}...`);
            const genAI = new GoogleGenerativeAI(key);
            // Try to list models to see what is available
            const modelsResult = await (await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`)).json();
            if (modelsResult.models) {
                console.log(`Available models for Key ${idx}:`, modelsResult.models.map(m => m.name).slice(0, 5));
            } else {
                console.log(`Could not list models for Key ${idx}:`, JSON.stringify(modelsResult));
            }

            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL }, { apiVersion: 'v1' });
            const result = await model.generateContent("Say hello.");
            console.log(`Key ${idx} SUCCESS: ${result.response.text().trim()}`);
        } catch (e) {
            console.error(`Key ${idx} FAILED: ${e.message}`);
        }
    }

    console.log("\nDone.");
}

testHiddenPlaces();
