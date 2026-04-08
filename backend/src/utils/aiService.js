const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

/**
 * Get unique, high-intent keywords for a city and category
 * to make Google Places search more specific and offbeat.
 */
exports.getDiscoveryKeywords = async (city, category) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `As a local travel expert in ${city}, suggest 5 specific, high-intent, and OFFBEAT keywords or place types for the "${category}" category. 
    
    CRITICAL RULES:
    - Avoid generic terms like "park," "mall," or "cafe."
    - Focus on "Hidden Gems" and "Secret Spots" that regular tourists miss.
    - Prioritize variety: if this is a refresh, suggest a different vibe (e.g., if you suggested "trekking" before, try "caving" or "local craft village").
    - Return ONLY a comma-separated list of keywords. 
    
    Example for Kyoto/Culture: "tea ceremony house, bamboo craft workshop, hidden zen garden, samurai sword museum, geisha district teahouse"`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text;
  } catch (err) {
    console.error('[AI KEYWORDS ERROR]', err.message);
    return ""; // Fallback to generic
  }
};
