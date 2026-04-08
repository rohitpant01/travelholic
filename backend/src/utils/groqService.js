const Groq = require("groq-sdk");

// Instantiate two separate clients for high availability
const groqPrimary = new Groq({ apiKey: process.env.GROQ_API_KEY });
const groqFallback = new Groq({ apiKey: process.env.GROQ_API_KEY_FALLBACK });

const MODEL = "llama-3.3-70b-versatile";

/**
 * Executes a Groq completion with automatic failover support.
 */
const executeWithFailover = async (payload) => {
  try {
    // Attempt with Primary Key
    const completion = await groqPrimary.chat.completions.create(payload);
    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error('⚠️ [GROQ PRIMARY FAILOVER]', err.message);
    
    // Immediate fallback retry iff fallback key exists
    if (process.env.GROQ_API_KEY_FALLBACK) {
      try {
        const fallbackCompletion = await groqFallback.chat.completions.create(payload);
        return JSON.parse(fallbackCompletion.choices[0].message.content);
      } catch (fErr) {
        console.error('❌ [GROQ FALLBACK ERROR]', fErr.message);
        throw fErr;
      }
    }
    throw err;
  }
};

exports.executeWithFailover = executeWithFailover;

/**
 * Use Groq to intelligently sequence a day itinerary and write compelling story/whys.
 */
exports.generateSmartItinerary = async (places, moods) => {
  try {
    const moodsStr = moods.join(", ");
    const prompt = `As an expert travel planner, create a 3-stop day itinerary (Morning, Afternoon, Evening) for a user with these moods: ${moodsStr}.
    
    CANDIDATE PLACES:
    ${JSON.stringify(places.map(p => ({ id: p.id, name: p.name, rating: p.rating, types: p.types })))}

    TASK:
    1. Select the 3 best spots that match the moods.
    2. Write a short, exciting "why" (1 sentence) for each spot.
    3. Write a "Secret Story" (2 sentences) for each spot. This MUST be a bespoke, factual, and unique story specific to the literal place name.
    4. For each spot, generate:
       - "tags": ["Trending", "Insta-worthy", "Popular", "Scenic", "Authentic"] (select 2-3)
       - "info": { "bestTime": "...", "fee": "...", "difficulty": "..." } (e.g., "Free", "Moderate", "Morning")
    5. Write a 2-sentence "Summary Story" explaining why this overall plan is perfect for the selected moods.
    
    STRICT UNIQUENESS: Every "Secret Story" MUST be different and specific to the location.
    
    RETURN ONLY JSON in this format:
    {
      "selectedIds": ["id1", "id2", "id3"],
      "whys": { "id1": "...", "id2": "...", "id3": "..." },
      "secretStories": { "id1": "...", "id2": "...", "id3": "..." },
      "tags": { "id1": ["..."], "id2": ["..."], "id3": ["..."] },
      "info": { 
        "id1": { "bestTime": "...", "fee": "...", "difficulty": "..." },
        "id2": { "bestTime": "...", "fee": "...", "difficulty": "..." },
        "id3": { "bestTime": "...", "fee": "...", "difficulty": "..." }
      },
      "summary": "..."
    }`;

    return await executeWithFailover({
      messages: [{ role: "user", content: prompt }],
      model: MODEL,
      response_format: { type: "json_object" }
    });
  } catch (err) {
    console.error('[GROQ SERVICE TOTAL FAILURE]', err.message);
    return null; // Fallback to heuristic logic
  }
};
/**
 * Use Lyra (AI) to transform unstructured travel content into a structured smart itinerary.
 */
exports.generateLyraItinerary = async (caption, location, tags, realCandidates = [], userPrefs = {}) => {
  const realSpotsContext = realCandidates.length > 0 
    ? `REAL NEARBY SPOTS (Prioritize these if they match the context):
    ${JSON.stringify(realCandidates)}`
    : '';

  const personalizationContext = `USER PREFERENCES:
  - Preferred Budget: ${userPrefs.budget || 'Any'}
  - Interests: ${userPrefs.interests?.join(', ') || 'General travel'}
  - Language: Mixed/Hinglish support enabled.`;

  const prompt = `You are Lyra, an intelligent travel AI integrated inside a social travel app.
  Your task is to convert a user's travel post into a structured, smart itinerary with contextual stay suggestions.

  ${personalizationContext}

  INPUT:
  - Caption: "${caption}"
  - Location: "${location || 'Unknown'}"
  - Tags: "${tags ? tags.join(', ') : 'None'}"

  ${realSpotsContext}

  RULES:
  1. Extract/divide into logical days (Day 1, Day 2, etc.).
  2. Identify Places visited and Activities performed. 
  3. SMART LOCATION CHECK: Ensure the places mentioned actually belong to the provided location context. If the user mentions places (e.g. 'Qutub Minar') that clearly contradict the provided location hint (e.g. 'Mumbai'), ignore the wrong hint and map the itinerary to the correct real-world location of those places (e.g. 'Delhi').
  4. If "REAL NEARBY SPOTS" are provided, you MUST try to includes some of them in the itinerary. Pay attention to their 'price_level' if provided for cost estimations.
  4. Suggest 2-3 stay types (Budget, Mid-range, Luxury).
  5. For Stay Area, if you know the exact neighborhood from the location or real spots, use it.
  6. NO direct booking links or hallucinated hotel names.
  7. Infer travel type (solo, couple, group, family).
  8. Provide approximate cost breakdown and 2-3 nearby recommendations.
  9. Assign a 'confidence' score (0.0 to 1.0) based on input clarity.
  10. TONE: Match the user's interests (e.g., if they like 'Adventure', make the notes more exciting).
  11. MAP DATA: For EACH stop in the itinerary, you MUST provide 'latitude' and 'longitude'. If it's a real spot from the input, use its coordinates. If you're assuming a place, provide accurate real-world coordinates for that landmark.

  RETURN ONLY JSON in this exact format:
  {
    "travel_type": "",
    "confidence": 0.0,
    "itinerary": [
      {
        "day": 1,
        "places": [],
        "activities": [],
        "latitude": 0.0,
        "longitude": 0.0,
        "notes": ""
      }
    ],
    "stay_suggestions": [
      {
        "type": "Budget",
        "stay_type": "Hostel",
        "price_range": "₹500 - ₹1200",
        "area": "Old Manali",
        "deals_url": "https://www.booking.com/searchresults.html?ss=Hostel+in+Old+Manali"
      }
    ],
    "estimated_cost": {
      "stay": "...",
      "activities": "...",
      "food": "...",
      "total_estimate": "..."
    },
    "nearby_recommendations": []
  }`;

  return await executeWithFailover({
    messages: [{ role: "user", content: prompt }],
    model: MODEL,
    response_format: { type: "json_object" }
  });
};
