const { executeWithFailover } = require('../utils/groqService');

/**
 * Generate structured AI content for the back side of a place card.
 */
exports.getPlaceDetails = async (req, res) => {
  try {
    const { name, location, category, rating, distance } = req.query;

    if (!name || !location) {
      return res.status(400).json({ error: 'Name and location are required' });
    }

    const prompt = `You are an AI travel assistant inside the EkalGo app.
Generate structured, engaging, and user-converting content for the BACK SIDE of a place card.

STRICT UNIQUENESS RULES:
- Do NOT use generic filler hooks like "Hidden within these grounds...", "A tale of ancient origins...", or "Discover the magic...".
- EVERY "hook_line" must be specific to the place name and documented history/vibe.
- If you don't have a specific secret story, focus on a unique emotional "Why" people go there (e.g. "Feel the spiritual silence...") instead of boilerplate.

INPUT:
- place_name: ${name}
- location: ${location}
- category: ${category || 'general'}
- rating: ${rating || 'N/A'}
- distance_km: ${distance || 'nearby'}

OUTPUT format (STRICT JSON):
{
  "title": "${name}",
  "location": "${location}",
  "distance": "${distance ? distance + ' km away' : 'Nearby'}",
  "rating": "${rating ? '⭐ ' + rating : ''}",
  "category_tag": "Match category with a unique emoji (e.g. 🕍 Spiritual, ❤️ Romantic, ⛰️ Adventure)",
  "hook_line": "Bespoke, specific one-liner that attracts user",
  "quick_info": [
    "⏱️ Best time: ...",
    "🎟️ Entry: ...",
    "🚶 Difficulty: ..."
  ],
  "badges": [
    "🔥 Trending",
    "💎 Hidden Gem",
    "📸 Insta-Worthy",
    "👥 Popular Today"
  ],
  "actions": ["Go", "Save", "Add to Trip", "View on Map"]
}

Rules:
- Hook line must feel human, emotional, and exciting (not generic).
- Keep text short (mobile UI friendly).
- Match category with emoji automatically.
- Do NOT generate long paragraphs.
- Focus on conversion (make user want to click "Go").`;

    const details = await executeWithFailover({
      messages: [{ role: "system", content: "You are a helpful travel assistant that outputs only valid JSON." }, { role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    res.json({
      success: true,
      details
    });

  } catch (err) {
    console.error('❌ [DETAILS ERROR]', err);
    res.status(500).json({ error: 'Failed to generate place details' });
  }
};
