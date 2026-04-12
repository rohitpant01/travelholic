const axios = require('axios');
const PlaceCache = require('../models/PlaceCache');
const { getDiscoveryKeywords } = require('../utils/aiService');

const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const BLACKLIST_TYPES = ['atm', 'bank', 'finance', 'money_transfer', 'political', 'embassy', 'post_office'];

// Fisher-Yates Shuffle for freshness
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const CATEGORY_MAP = {
  nature: { type: 'park', keyword: 'nature|park|lake|waterfall', emoji: '🌿', insight: 'Escaping to nature' },
  romantic: { type: 'tourist_attraction', keyword: 'viewpoint|romantic|scenic', emoji: '❤️', insight: 'Perfect for connection' },
  family: { type: 'museum', keyword: 'family|zoo|aquarium|amusement', emoji: '👨‍👩‍👧‍👦', insight: 'Fun for all ages' },
  adventure: { type: 'tourist_attraction', keyword: 'adventure|hiking|trekking|rock_climbing|rafting', emoji: '⛰️', insight: 'Thrill & Adrenaline' },
  fun: { type: 'amusement_park', keyword: 'fun|bowling|arcade|cinema|casino', emoji: '🎡', insight: 'Activities & Laughs' },
  spiritual: { type: 'place_of_worship', keyword: 'temple|mosque|church|religious|shrine|monastery|gurudwara|ashram|yoga|meditation|spiritual|chapel|convent|abbey|synagogue', emoji: '🕍', insight: 'Soulful & Serene' },
  restaurants: { type: 'restaurant', keyword: 'food|dining', emoji: '🍽️', insight: 'Top local flavors' },
  cafes: { type: 'cafe', keyword: 'coffee|bakery', emoji: '☕', insight: 'Cozy break spot' },
  hotels: { type: 'lodging', keyword: 'hotel|resort', emoji: '🏨', insight: 'Highly rated stay' },
  others: { type: 'tourist_attraction', keyword: 'market|landmark|culture', emoji: '✨', insight: 'Must-see local spot' }
};

/**
 * Fetch road distances via Google Distance Matrix API
 */
const fetchRoadDistances = async (originLat, originLng, places, mapsKey) => {
  if (places.length === 0) return places;

  const destinations = places.map(p => `${p.location.lat},${p.location.lng}`).join('|');
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destinations}&key=${mapsKey}`;

  try {
    const res = await axios.get(url);
    if (res.data.status === 'OK' && res.data.rows?.[0]?.elements) {
      const elements = res.data.rows[0].elements;
      return places.map((p, idx) => {
        if (elements[idx]?.status === 'OK') {
          return {
            ...p,
            distanceText: elements[idx].distance.text,
            distanceKm: elements[idx].distance.value / 1000
          };
        }
        return p;
      });
    }
  } catch (err) {
    console.warn('[DISTANCE MATRIX ERROR]', err.message);
  }
  return places;
};

const SearchHistory = require('../models/SearchHistory');

exports.searchPlaces = async (req, res) => {
  try {
    const { query, lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Location required' });

    // User's Real GPS Location (for distance origin)
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const userId = req.user.id;

    // ── 1. SMART PROXIMITY & TIME GATE ──
    // Find the latest discovery cache in this area (within 20km)
    // We search broadly by query first
    const existingCache = await PlaceCache.findOne({
      query: query || '',
      // Basic bounding box check for performance before haversine
      lat: { $gte: userLat - 0.3, $lte: userLat + 0.3 },
      lng: { $gte: userLng - 0.3, $lte: userLng + 0.3 }
    }).sort({ createdAt: -1 });

    if (existingCache) {
      const dist = calculateHaversine(userLat, userLng, existingCache.lat, existingCache.lng);
      const age = Date.now() - new Date(existingCache.createdAt).getTime();
      const HOURS_24 = 24 * 60 * 60 * 1000;

      // If user is within 20km AND data is < 24h old → SERVE INSTANTLY
      if (dist < 20 && age < HOURS_24) {
        console.log(`📡 [EXPLORER] Cache Hit! (Dist: ${dist.toFixed(1)}km, Age: ${Math.round(age / 3600000)}h)`);
        return res.json({
          success: true,
          cached: true, // 📡 Explicitly set as cached
          locationName: existingCache.locationName,
          results: existingCache.results,
        });
      }
      console.log(`🔄 [SMART EXPLORER] Cache Expiry/Movement (Dist: ${dist.toFixed(1)}km). Purging...`);
      await PlaceCache.deleteOne({ _id: existingCache._id });
    }

    // ── 2. PREPARE FOR HARD REFRESH ──
    const searchHistory = await SearchHistory.findOne({ userId }) || new SearchHistory({ userId, placeIds: [] });
    const seenPlaceIds = new Set(searchHistory.placeIds);

    let searchCenterLat = userLat;
    let searchCenterLng = userLng;
    let locationName = '';
    let isCitySearch = false;

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    // 3. Geocoding Context for Location Shifting
    if (query && query.trim().length > 2) {
      try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${mapsKey}`;
        const geoRes = await axios.get(geoUrl);
        if (geoRes.data.status === 'OK' && geoRes.data.results.length > 0) {
          const loc = geoRes.data.results[0].geometry.location;
          const types = geoRes.data.results[0].types;
          const isLocality = types.some(t => ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'country'].includes(t));

          if (isLocality || calculateHaversine(userLat, userLng, loc.lat, loc.lng) > 15) {
            searchCenterLat = loc.lat;
            searchCenterLng = loc.lng;
            locationName = geoRes.data.results[0].address_components[0].long_name;
            isCitySearch = true;
          }
        }
      } catch (e) { }
    }

    const distRefLabel = isCitySearch ? `from your location` : 'away';

    const categorizedResults = {};
    let totalFound = 0;
    let masterPool = new Map();

    const fetchCategory = async (catKey) => {
      const config = CATEGORY_MAP[catKey];
      let finalKeyword = config.keyword;
      if (isCitySearch) {
        const aiKeywords = await getDiscoveryKeywords(locationName, catKey);
        if (aiKeywords) {
          finalKeyword = `${config.keyword}|${aiKeywords.replace(/, /g, '|')}`;
        }
      }

      const searchRadius = catKey === 'others' ? 25000 : 15000;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchCenterLat},${searchCenterLng}&radius=${searchRadius}&type=${config.type}&keyword=${encodeURIComponent(finalKeyword)}&key=${apiKey}`;

      try {
        const response = await axios.get(url);
        let spots = [];

        if (response.data.status === 'OK') {
          // 🔥 DEDUPLICATION FILTER: Remove places this user has already seen!
          const filtered = response.data.results.filter(p => !p.types.some(t => BLACKLIST_TYPES.includes(t)) && !seenPlaceIds.has(p.place_id));
          filtered.forEach(p => { if (!masterPool.has(p.place_id)) masterPool.set(p.place_id, p); });
          spots = filtered;
        }

        if (spots.length < 2) {
          const fbUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchCenterLat},${searchCenterLng}&radius=20000&type=tourist_attraction&key=${apiKey}`;
          const fbRes = await axios.get(fbUrl);
          if (fbRes.data.status === 'OK') {
            const extra = fbRes.data.results.filter(p =>
              !spots.some(s => s.place_id === p.place_id) &&
              !p.types.some(t => BLACKLIST_TYPES.includes(t)) &&
              !seenPlaceIds.has(p.place_id)
            ).slice(0, 5);
            spots = [...spots, ...extra];
          }
        }

        spots = shuffleArray([...spots]);
        const limit = catKey === 'others' ? 40 : 15;
        let processed = spots.slice(0, limit).map(p => {
          const ref = p.photos?.[0]?.photo_reference;
          const imgUrl = ref
            ? `${process.env.BACKEND_URL || 'https://travelholic-zsqn.onrender.com'}/api/images/google-photo?ref=${ref}`
            : `https://images.unsplash.com/photo-1488646953014-85cb44e25828`; // Fallback

          return {
            id: p.place_id,
            name: p.name,
            address: p.vicinity,
            rating: p.rating,
            totalRatings: p.user_ratings_total,
            location: p.geometry.location,
            photoReference: ref ? `${ref}&key=${apiKey || process.env.GOOGLE_PLACES_API_KEY}#` : null,
            image: imgUrl, // 🔥 NEW: Real image URL
            whyThisPlace: p.rating > 4.5 ? `Highly recommended spot! ★` : `${config.insight} ${config.emoji}`,
            types: p.types,
            distanceText: 'Nearby',
            distanceKm: 0
          };
        });

        if (processed.length > 0) {
          const roadData = await fetchRoadDistances(userLat, userLng, processed.slice(0, 12), mapsKey);
          processed = processed.map((p, idx) => {
            if (idx < 12 && roadData[idx]) {
              return { ...roadData[idx], distanceText: `${roadData[idx].distanceText} ${distRefLabel}` };
            } else {
              const hKm = calculateHaversine(userLat, userLng, p.location.lat, p.location.lng);
              return { ...p, distanceKm: parseFloat(hKm.toFixed(1)), distanceText: `${hKm.toFixed(1)} km ${distRefLabel}` };
            }
          });
        }
        categorizedResults[catKey] = processed;
        totalFound += processed.length;
      } catch (err) {
        console.error(`[FETCH CAT ERROR] ${catKey}:`, err.message);
      }
    };

    await Promise.all(Object.keys(CATEGORY_MAP).map(k => fetchCategory(k)));

    // Final Clean-up and Catch-all
    const categorizedIds = new Set(Object.values(categorizedResults).flat().map(p => p.id));
    const uncategorizedItems = Array.from(masterPool.values()).filter(p => !categorizedIds.has(p.place_id));

    if (uncategorizedItems.length > 0) {
      const catchAllFormatted = uncategorizedItems.map(p => {
        const ref = p.photos?.[0]?.photo_reference;
        const imgUrl = ref
          ? `${process.env.BACKEND_URL || 'https://travelholic-zsqn.onrender.com'}/api/images/google-photo?ref=${ref}`
          : `https://images.unsplash.com/photo-1488646953014-85cb44e25828`;

        return {
          id: p.place_id,
          name: p.name,
          address: p.vicinity,
          rating: p.rating,
          totalRatings: p.user_ratings_total,
          location: p.geometry.location,
          photoReference: ref ? `${ref}&key=${apiKey || process.env.GOOGLE_PLACES_API_KEY}#` : null,
          image: imgUrl,
          whyThisPlace: `Highly recommended spot! 🪄`,
          types: p.types,
          distanceText: 'Nearby',
          distanceKm: 0
        };
      });
      categorizedResults['others'] = [...(categorizedResults['others'] || []), ...catchAllFormatted];
      totalFound += catchAllFormatted.length;
    }

    if (totalFound === 0) return res.status(404).json({ error: 'No places found' });

    // ── 4. PERSIST CACHE & UPDATE HISTORY ──
    await new PlaceCache({
      query: query || '',
      lat: userLat,
      lng: userLng,
      radius: 15000,
      results: categorizedResults,
      locationName: locationName || 'Nearby'
    }).save();

    // Update the "Seen List" for deduplication across the next 7 days
    const newPlaceIds = Object.values(categorizedResults).flat().map(p => p.id);
    const updatedIds = Array.from(new Set([...searchHistory.placeIds, ...newPlaceIds])).slice(-500); // Record up to 500 places
    searchHistory.placeIds = updatedIds;
    searchHistory.lastSearchedAt = new Date();
    await searchHistory.save();

    res.json({
      success: true,
      cached: false, // 🚀 Fresh AI Fetch
      isCitySearch,
      locationName,
      results: categorizedResults,
    });

  } catch (err) {
    console.error('❌ [PLACE ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat/Lng required' });

    const { reverseGeocode } = require('../utils/geocodingService');
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));

    if (!result) return res.status(404).json({ error: 'No location found' });

    res.json({
      success: true,
      result
    });
  } catch (err) {
    console.error('[REVERSE GEOCODE ERROR]', err);
    res.status(500).json({ error: 'Failed to reverse geocode' });
  }
};
