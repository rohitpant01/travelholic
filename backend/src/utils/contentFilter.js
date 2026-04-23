/**
 * Content Filter
 * 
 * Lightweight keyword/regex-based content filtering engine.
 * Replaces the broken `bad-words` package with a custom, maintainable solution.
 * 
 * Runs at content creation (posts, comments) to:
 * 1. Detect spam, abuse, scam, and contact-sharing patterns
 * 2. Return a flag score (0–1) and matched categories
 * 3. Optionally auto-reject content above a threshold
 */

// ── Pattern Definitions ─────────────────────────────────────
const PATTERNS = {
  spam: [
    /\bbuy\s*now\b/i,
    /\bclick\s*here\b/i,
    /\bfree\s+money\b/i,
    /\bearn\s*\$?\d+/i,
    /\blimited\s+time\s+offer\b/i,
    /\bact\s+now\b/i,
    /\b100%\s*free\b/i,
    /\bwin\s+(a\s+)?prize\b/i,
    /\bdouble\s+your\s+money\b/i,
    /\bno\s+risk\b/i,
  ],
  abuse: [
    /\bkill\s+yourself\b/i,
    /\bgo\s+die\b/i,
    /\bkys\b/i,
    /\byou'?re?\s+worthless\b/i,
    /\bnobody\s+loves\s+you\b/i,
    /\bshoot\s+(up|you)\b/i,
  ],
  scam: [
    /\bsend\s+(me\s+)?money\b/i,
    /\bwhatsapp\s*(me|number)?\b/i,
    /\btelegram\s*(group|channel)?\b/i,
    /\bjoin\s+my\s+(group|channel)\b/i,
    /\bcrypto\s+investment\b/i,
    /\bdm\s+for\s+(deals|price|info)\b/i,
    /\bget\s+rich\s+quick\b/i,
    /\bbitcoin\s+giveaway\b/i,
  ],
  contact_sharing: [
    /\b\d{10,13}\b/g,                        // Phone numbers (10-13 digits)
    /[\w.+-]+@[\w-]+\.[\w.-]+/g,              // Email addresses
    /\b(snapchat|snap|insta|ig)\s*:\s*\S+/i,  // Social handles being shared
  ],
  hate_speech: [
    /\bterrorist\b/i,
    /\bgo\s+back\s+to\s+your\s+country\b/i,
    /\billegal\s+immigrant\b/i,
  ]
};

// Category weights for scoring
const CATEGORY_WEIGHTS = {
  spam: 0.3,
  abuse: 0.8,
  scam: 0.5,
  contact_sharing: 0.2,
  hate_speech: 0.9
};

/**
 * Analyze content for policy violations
 * @param {string} text - Content to analyze
 * @returns {{ flagged: boolean, score: number, categories: string[], matches: object }}
 */
const analyzeContent = (text) => {
  if (!text || typeof text !== 'string') {
    return { flagged: false, score: 0, categories: [], matches: {} };
  }

  const normalizedText = text.trim();
  if (normalizedText.length === 0) {
    return { flagged: false, score: 0, categories: [], matches: {} };
  }

  const matchedCategories = [];
  const matches = {};
  let maxCategoryScore = 0;

  for (const [category, patterns] of Object.entries(PATTERNS)) {
    const categoryMatches = [];
    
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const match = normalizedText.match(regex);
      if (match) {
        categoryMatches.push(match[0]);
      }
    }

    if (categoryMatches.length > 0) {
      matchedCategories.push(category);
      matches[category] = categoryMatches;
      const weight = CATEGORY_WEIGHTS[category] || 0.3;
      maxCategoryScore = Math.max(maxCategoryScore, weight);
    }
  }

  // Score is the max category weight (not additive — prevents over-flagging)
  // Boost slightly if multiple categories matched
  let score = maxCategoryScore;
  if (matchedCategories.length > 1) {
    score = Math.min(1.0, score + 0.1 * (matchedCategories.length - 1));
  }

  return {
    flagged: score > 0,
    score: Math.round(score * 100) / 100,
    categories: matchedCategories,
    matches
  };
};

/**
 * Check if content should be auto-rejected (score > threshold)
 * @param {string} text
 * @param {number} threshold - Default 0.8
 * @returns {{ rejected: boolean, reason: string, analysis: object }}
 */
const shouldRejectContent = (text, threshold = 0.8) => {
  const analysis = analyzeContent(text);
  
  if (analysis.score >= threshold) {
    return {
      rejected: true,
      reason: `Content flagged for: ${analysis.categories.join(', ')}`,
      analysis
    };
  }

  return { rejected: false, reason: '', analysis };
};

/**
 * Check if content is profane (replacement for bad-words filter.isProfane)
 * @param {string} text
 * @returns {boolean}
 */
const isProfane = (text) => {
  const analysis = analyzeContent(text);
  return analysis.categories.includes('abuse') || analysis.categories.includes('hate_speech');
};

module.exports = {
  analyzeContent,
  shouldRejectContent,
  isProfane,
  PATTERNS,
  CATEGORY_WEIGHTS
};
