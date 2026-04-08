/**
 * Lightweight NLP Mapping for EkalGo
 * Refactored for shared use between search and itinerary generation.
 */
const getMapping = (query) => {
  const q = (query || '').toLowerCase();
  
  if (q.includes('romantic')) {
    return {
      mood: 'romantic',
      keywords: 'viewpoint,romantic,lake',
      type: 'park', // Google types: cafe, park, restaurant
      insight: 'Popular for couples and dates ❤️',
      itineraryMood: 'romantic'
    };
  }
  if (q.includes('nature') || q.includes('green') || q.includes('hills') || q.includes('adventure') || q.includes('scenic')) {
    return {
      mood: 'nature',
      keywords: 'nature,viewpoint,hiking,lake,waterfall',
      type: 'natural_feature', 
      insight: 'Beautiful natural landscape 🌿',
      itineraryMood: 'nature'
    };
  }
  if (q.includes('cafe') || q.includes('coffee') || q.includes('bakery')) {
    return {
      mood: 'cafe',
      keywords: 'bakery,coffee,breakfast',
      type: 'cafe',
      insight: 'Perfect for a cozy break ☕',
      itineraryMood: 'romantic'
    };
  }
  if (q.includes('food') || q.includes('eat') || q.includes('restaurant') || q.includes('dinner')) {
    return {
      mood: 'food',
      keywords: 'food,dining,cuisine',
      type: 'restaurant',
      insight: 'Delicious local flavors 🍽️',
      itineraryMood: 'romantic'
    };
  }
  if (q.includes('peaceful') || q.includes('quiet') || q.includes('calm') || q.includes('spirit')) {
    return {
      mood: 'peaceful',
      keywords: 'temple,garden,church,monument',
      type: 'place_of_worship',
      insight: 'Quiet and less crowded 🕊️',
      itineraryMood: 'peaceful'
    };
  }
  if (q.includes('hidden') || q.includes('gem') || q.includes('rare') || q.includes('local')) {
    return {
      mood: 'hidden',
      keywords: 'gallery,landmark,hidden',
      type: 'museum',
      insight: 'A unique find, away from crowds ✨',
      itineraryMood: 'peaceful'
    };
  }
  if (q.includes('family') || q.includes('kids') || q.includes('fun')) {
    return {
      mood: 'family',
      keywords: 'zoo,playground',
      type: 'amusement_park',
      insight: 'Great for family outings and kids 👨‍👩‍👧‍👦',
      itineraryMood: 'family'
    };
  }
  
  // Default fallback
  return {
    mood: 'general',
    keywords: query,
    type: 'tourist_attraction|point_of_interest',
    insight: 'Worth exploring today 📍',
    itineraryMood: 'peaceful'
  };
};

module.exports = { getMapping };
