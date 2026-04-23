const axios = require('axios');
const { getMapping } = require('../utils/nlpMapping');
const { generateSmartItinerary, generateLyraItinerary } = require('../utils/groqService');
const LyraItinerary = require('../models/LyraItinerary');
const Post = require('../models/Post');
const User = require('../models/User');

const SmartBudgetAllocator = require('../utils/budgetAllocator');

// 🏎️ In-memory cache for Google Places (simple for now)
const placeCache = new Map();

// Haversine formula to calculate distance in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const BLACKLIST_TYPES = [
  'atm', 'bank', 'finance', 'money_transfer', 'political', 'embassy',
  'post_office', 'electronics_store', 'car_repair', 'car_dealer',
  'gas_station', 'hardware_store', 'laundry', 'locksmith', 'storage',
  'veterinary_care', 'doctor', 'hospital', 'dentist', 'pharmacy'
];

const MOOD_KEYWORDS = {
  nature: 'park|lake|waterfall|forest|scenic',
  romantic: 'viewpoint|romantic|scenic|quiet|sunset',
  adventure: 'hiking|climbing|trekking|rafting|thrill',
  fun: 'amusement|bowling|arcade|cinema|activities',
  spiritual: 'temple|mosque|church|religious|shrine|monastery|gurudwara|ashram|yoga|meditation|spiritual',
  foodie: 'restaurant|cafe|food|dining|street_food',
  family: 'zoo|aquarium|amusement|museum|park|temple|spiritual|religious|shrine|landmark|monument',
  culture: 'museum|art_gallery|landmark|monument|history'
};

/**
 * Helper to fetch and filter places from Google API (with caching)
 */
const fetchNearby = async (lat, lng, radius, keywords, apiKey) => {
  const cacheKey = `${Math.round(lat * 1000) / 1000}_${Math.round(lng * 1000) / 1000}_${keywords}`;
  if (placeCache.has(cacheKey)) {
    console.log('⚡ [CACHE HIT] Returning cached spots for Lyra...');
    return placeCache.get(cacheKey);
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(keywords)}&key=${apiKey}`;
  try {
    const response = await axios.get(url);
    if (response.data.status === 'OK') {
      const filtered = response.data.results.filter(p =>
        !p.types.some(t => BLACKLIST_TYPES.includes(t)) &&
        p.business_status !== 'CLOSED_PERMANENTLY' &&
        p.rating > 0
      );
      // Cache for 24 hours
      placeCache.set(cacheKey, filtered);
      setTimeout(() => placeCache.delete(cacheKey), 24 * 60 * 60 * 1000);
      return filtered;
    }
    return [];
  } catch (err) {
    console.error('⚠️ [PLACES FETCH ERROR]', err.message);
    return [];
  }
};

exports.generateItinerary = async (req, res) => {
  try {
    const { query, lat, lng, moods } = req.query;
    const selectedMoods = Array.isArray(moods) ? moods : (moods ? [moods] : []);

    if (!lat || !lng) return res.status(400).json({ error: 'Location is required' });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    // --- PHASE 1: TARGETED SEARCH ---
    let combinedKeywords = selectedMoods.map(m => MOOD_KEYWORDS[m]).filter(Boolean).join('|');
    if (!combinedKeywords) combinedKeywords = 'tourist_attraction|point_of_interest';

    let spots = await fetchNearby(userLat, userLng, 20000, combinedKeywords, apiKey);

    // --- PHASE 2: AUGMENTATION (If low results) ---
    if (spots.length < 5) {
      console.log('🔄 [AUGMENTING SEARCH] Low results for primary moods...');
      let fallbackKeywords = 'tourist_attraction|landmark|museum';

      // Special handle for family/landmark preference as requested
      if (selectedMoods.includes('family') || selectedMoods.includes('spiritual')) {
        fallbackKeywords += '|temple|shrine|park|religious';
      }

      const extraSpots = await fetchNearby(userLat, userLng, 20000, fallbackKeywords, apiKey);

      // Merge and deduplicate
      const existingIds = new Set(spots.map(s => s.place_id));
      extraSpots.forEach(s => {
        if (!existingIds.has(s.place_id)) {
          spots.push(s);
          existingIds.add(s.place_id);
        }
      });
    }

    // --- PHASE 3: FINAL BROADENING (If still insufficient) ---
    if (spots.length < 3) {
      console.log('🌐 [BROADENING RADIUS] Still low results, searching broadly...');
      const finalResort = await fetchNearby(userLat, userLng, 35000, 'point_of_interest|establishment', apiKey);

      const existingIds = new Set(spots.map(s => s.place_id));
      finalResort.forEach(s => {
        if (!existingIds.has(s.place_id)) {
          spots.push(s);
          existingIds.add(s.place_id);
        }
      });
    }

    // Final safety check: if NO spots found at all (highly unlikely in 35km)
    if (spots.length === 0) {
      return res.status(404).json({ error: 'Seriously, no interesting spots found nearby. Try another mood or location!' });
    }

    // Pre-process candidates for AI
    const candidates = spots
      .map(p => ({
        id: p.place_id,
        name: p.name,
        rating: p.rating,
        types: p.types,
        location: p.geometry.location,
        address: p.vicinity,
        photoReference: p.photos && p.photos.length > 0 ? p.photos[0].photo_reference : null
      }))
      .sort((a, b) => (b.photoReference ? 1 : 0) - (a.photoReference ? 1 : 0))
      .slice(0, 12); // Give AI a few more options than before

    // --- AI REASONING ---
    const aiResult = await generateSmartItinerary(candidates, selectedMoods);

    let finalSelection = [];
    let summaryStory = "";

    if (aiResult && aiResult.selectedIds?.length >= Math.min(3, candidates.length)) {
      finalSelection = aiResult.selectedIds.map((id, idx) => {
        const spot = candidates.find(c => c.id === id);
        if (!spot) return null;
        return {
          ...spot,
          time: ["Morning", "Afternoon", "Evening"][idx] || "Later",
          why: aiResult.whys[id] || "Handpicked for your itinerary.",
          secretStory: aiResult.secretStories?.[id] || `A hidden gem with local heritage, perfect for your ${selectedMoods[0] || 'trip'}.`,
          tags: aiResult.tags?.[id] || ["Trending", "Explore"],
          info: aiResult.info?.[id] || { bestTime: "Morning", fee: "Free", difficulty: "Easy" }
        };
      }).filter(Boolean);
      summaryStory = aiResult.summary;
    } else {
      // Robust Heuristic Fallback
      finalSelection = candidates.slice(0, Math.min(3, candidates.length)).map((p, idx) => ({
        ...p,
        time: ["Morning", "Afternoon", "Evening"][idx] || "Later",
        why: "One of the most popular local sites.",
        secretStory: `A place of great local significance in the ${query || 'nearby'} area. It offers a unique glimpse into the region's character.`,
        tags: ["Best Rated", "Must Visit"],
        info: { bestTime: "All day", fee: "Free", difficulty: "Easy" }
      }));
      summaryStory = "We've gathered these essential local landmarks based on popularity and reviews.";
    }

    // Distance Matrix Pass
    const dest = finalSelection.map(p => `${p.location.lat},${p.location.lng}`).join('|');
    const dmUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${userLat},${userLng}&destinations=${dest}&key=${mapsKey}`;

    let roadData = null;
    try {
      const dmRes = await axios.get(dmUrl);
      if (dmRes.data.status === 'OK' && dmRes.data.rows[0]) roadData = dmRes.data.rows[0].elements;
    } catch (e) {
      console.error('⚠️ [DM ERROR]', e.message);
    }

    const itinerary = finalSelection.map((p, idx) => {
      // 🛡️ [URL POISONING FIX] - Injecting backend key to bypass APK's broken key
      const poisonedRef = p.photoReference ? `${p.photoReference}&key=${apiKey || process.env.GOOGLE_PLACES_API_KEY}#` : null;

      return {
        time: p.time,
        placeName: p.name,
        address: p.address || 'Local area',
        distance: roadData?.[idx]?.status === 'OK' ? roadData[idx].distance.text : 'Nearby',
        why: p.why,
        secretStory: p.secretStory,
        tags: p.tags,
        info: p.info,
        coordinates: p.location,
        rating: p.rating,
        photoReference: poisonedRef,
        image: p.photoReference
          ? `${process.env.BACKEND_URL || 'https://travelholic-zsqn.onrender.com'}/api/images/google-photo?ref=${p.photoReference}`
          : `https://images.unsplash.com/photo-1488646953014-85cb44e25828`
      };
    });

    res.json({
      title: `EkalGo Magic - ${selectedMoods.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' & ')} Itinerary 🪄`,
      itinerary,
      whyThisPlan: summaryStory
    });

  } catch (err) {
    console.error('❌ [ITINERARY GENERATION ERROR]:', err);
    res.status(500).json({ error: 'Itinerary generation service reached a roadblock. Please try again later.' });
  }
};

/**
 * Validates the core structure of Lyra's AI response
 */
const validateLyraResponse = (data) => {
  return (
    data &&
    typeof data === 'object' &&
    data.travel_type &&
    Array.isArray(data.itinerary) &&
    Array.isArray(data.stay_suggestions)
  );
};

/**
 * POST /api/itinerary/lyra
 * Entry point for Lyra Assistant (Post to Itinerary)
 */
exports.getLyraItinerary = async (req, res) => {
  try {
    const { caption, location, tags, lat, lng } = req.body;
    console.log(`[LYRA] Incoming request — caption: "${(caption || '').substring(0, 50)}...", location: "${location}", lat: ${lat}, lng: ${lng}`);

    if (!caption) return res.status(400).json({ error: 'Caption is required for Lyra to work her magic! ✨' });

    // --- RATE LIMIT CHECK (2 generations per 12 hours) ---
    const user = await User.findById(req.user._id);
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    const now = new Date();

    // Clean up old timestamps and check limit
    const recentGenerations = (user.travelMemory?.lyraGenerationTimestamps || [])
      .filter(ts => (now - new Date(ts)) < TWELVE_HOURS);

    if (recentGenerations.length >= 2) {
      const oldestTs = new Date(recentGenerations[0]);
      const nextAvailableAt = new Date(oldestTs.getTime() + TWELVE_HOURS);
      return res.status(429).json({
        error: 'Generation limit reached',
        message: 'Lyra needs a break! You can generate 2 itineraries every 12 hours.',
        nextAvailableAt
      });
    }

    // 🌍 Phase 2: Real-world data augmentation (Hybrid Intelligence)
    let realCandidates = [];
    if (lat && lng) {
      try {
        console.log(`📍 [LYRA] Found coordinates (${lat}, ${lng}). Fetching real local spots...`);
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (apiKey) {
          const spots = await fetchNearby(lat, lng, 15000, 'tourist_attraction|point_of_interest', apiKey);
          realCandidates = spots.map(p => ({
            name: p.name,
            rating: p.rating,
            types: p.types,
            address: p.vicinity
          })).slice(0, 10);
          console.log(`📍 [LYRA] Got ${realCandidates.length} real spots for augmentation`);
        } else {
          console.warn('⚠️ [LYRA] No GOOGLE_PLACES_API_KEY — skipping real spots augmentation');
        }
      } catch (geoErr) {
        console.warn('⚠️ [LYRA] Google Places fetch failed (non-fatal):', geoErr.message);
        // Continue without real candidates — AI will still work
      }
    }

    // 🧠 Phase 3: Personalization Context
    const userPrefs = {
      budget: req.user?.budget || 'Any',
      interests: req.user?.interests || []
    };

    // 🚀 RETRY MECHANISM (AI Safety)
    for (let i = 0; i < 2; i++) {
      try {
        console.log(`[LYRA] Attempt ${i + 1} for: ${caption.substring(0, 30)}...`);

        const aiResponse = await generateLyraItinerary(caption, location, tags, realCandidates, userPrefs);

        if (validateLyraResponse(aiResponse)) {
          console.log(`✅ [LYRA] Success on attempt ${i + 1}! (Confidence: ${aiResponse.confidence})`);

          // 🗺️ Phase 4: Google Places Post-Processing Enrichment
          try {
            console.log(`📍 [LYRA-ENRICH] Starting Enrichment biased to (${lat || location})`);
            const apiKey = process.env.GOOGLE_PLACES_API_KEY;

            if (apiKey) {
              // 🧪 Enhanced Geocode with Spatial Biasing
              const geocodePlace = async (placeName) => {
                try {
                  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeName + ' in ' + location)}&key=${apiKey}`;

                  // 🔥 Spatial Biasing: Find exactly the Malaynath temple near THIS user
                  if (lat && lng) {
                    url += `&location=${lat},${lng}&radius=50000`; // 50km radius bias
                  }

                  const geoRes = await axios.get(url);
                  if (geoRes.data.results && geoRes.data.results.length > 0) {
                    // Bias towards exact name matches or top rated in the area
                    return geoRes.data.results[0];
                  }
                } catch (e) {
                  console.warn(`[ENRICH FAIL] ${placeName}:`, e.message);
                }
                return null;
              };

              // 🏛️ Enrich Itinerary Spots
              if (aiResponse.itinerary && Array.isArray(aiResponse.itinerary)) {
                for (const day of aiResponse.itinerary) {
                  if (day.places && Array.isArray(day.places)) {
                    await Promise.all(day.places.map(async (place, idx) => {
                      let nameToSearch = typeof place === 'object' ? (place.name || place.title) : place;
                      if (nameToSearch) {
                        const geo = await geocodePlace(nameToSearch);
                        if (geo) {
                          day.places[idx] = {
                            name: geo.name || nameToSearch,
                            latitude: geo.geometry.location.lat,
                            longitude: geo.geometry.location.lng,
                            rating: geo.rating,
                            user_ratings_total: geo.user_ratings_total,
                            address: geo.formatted_address
                          };
                        }
                      }
                    }));
                  }

                  // 🔥 Cache Day Level Coords for Quick UI Rendering
                  if (day.places && day.places[0] && day.places[0].latitude) {
                    day.latitude = day.places[0].latitude;
                    day.longitude = day.places[0].longitude;
                  }
                }
              }

              // 💎 Enrich Nearby Gems
              if (aiResponse.nearby_recommendations && Array.isArray(aiResponse.nearby_recommendations)) {
                await Promise.all(aiResponse.nearby_recommendations.map(async (rec, idx) => {
                  let nameToSearch = typeof rec === 'object' ? (rec.name || rec.title) : rec;
                  if (nameToSearch) {
                    const geo = await geocodePlace(nameToSearch);
                    if (geo) {
                      aiResponse.nearby_recommendations[idx] = {
                        name: geo.name || nameToSearch,
                        latitude: geo.geometry.location.lat,
                        longitude: geo.geometry.location.lng,
                        rating: geo.rating
                      };
                    }
                  }
                }));
              }

              // 🏨 Enrich Stay Suggestions (Higher Accuracy for Hotels)
              if (aiResponse.stay_suggestions && Array.isArray(aiResponse.stay_suggestions)) {
                await Promise.all(aiResponse.stay_suggestions.map(async (stay, idx) => {
                  // Map price level 0-4 OR stay.type to ₹ symbols
                  const mapPrice = (level, type) => {
                    if (level != null && level >= 0) {
                      const ranges = ['₹500 - ₹1,200', '₹1,500 - ₹3,000', '₹4,000 - ₹7,000', '₹8,000 - ₹15,000', '₹20,000+'];
                      return ranges[level] || '₹1,500 - ₹3,000';
                    }
                    // Fallback to Tiered Pricing based on AI stay.type
                    const lowerType = (type || '').toLowerCase();
                    if (lowerType.includes('budget') || lowerType.includes('hostel')) return '₹600 - ₹1,500';
                    if (lowerType.includes('luxury') || lowerType.includes('resort')) return '₹10,000 - ₹25,000';
                    if (lowerType.includes('mid') || lowerType.includes('boutique')) return '₹3,000 - ₹6,000';
                    return '₹1,500 - ₹4,000'; // Default Mid-range
                  };

                  const searchStr = `${stay.stay_type || 'Hotel'} in ${stay.area || location}`;
                  const geo = await geocodePlace(searchStr);
                  if (geo) {
                    aiResponse.stay_suggestions[idx] = {
                      ...stay,
                      name: geo.name,
                      latitude: geo.geometry.location.lat,
                      longitude: geo.geometry.location.lng,
                      address: geo.formatted_address,
                      rating: geo.rating,
                      price_range: mapPrice(geo.price_level, stay.type || stay.stay_type)
                    };
                  }
                }));
              }

              console.log('✅ [LYRA-ENRICH] Successfully mapped precise real-world coordinates');
            }
          } catch (enrichErr) {
            console.warn('⚠️ [LYRA-ENRICH] Enrichment bypassed:', enrichErr.message);
          }

          // --- TRACK SUCCESSFUL GENERATION ---
          await User.findByIdAndUpdate(req.user._id, {
            $push: { 'travelMemory.lyraGenerationTimestamps': new Date() }
          });

          return res.json(aiResponse);
        }

        console.warn(`⚠️ [LYRA] Invalid structure on attempt ${i + 1}. Raw:`, JSON.stringify(aiResponse).substring(0, 200));
      } catch (err) {
        console.error(`❌ [LYRA] Error on attempt ${i + 1}:`, err.message);
        if (i === 1) {
          return res.status(500).json({
            error: 'Lyra is feeling a bit shy right now. Please try again in a moment!',
            details: err.message
          });
        }
      }
    }

    // Final fallback if both attempts fail validation
    res.status(422).json({ error: 'Lyra could not structure the itinerary correctly. Try being more specific with your caption!' });
  } catch (outerErr) {
    console.error('❌ [LYRA] Unhandled outer error:', outerErr);
    res.status(500).json({ error: 'Something went wrong. Please try again!', details: outerErr.message });
  }
};

/**
 * POST /api/itinerary/lyra/save
 * Persists a Lyra-generated itinerary to the database AND Updates User Memory
 */
exports.saveLyraItinerary = async (req, res) => {
  try {
    const {
      sourcePostId,
      travel_type,
      itinerary,
      stay_suggestions,
      estimated_cost,
      nearby_recommendations,
      confidence,
      locationName,
      coordinates,
      visibility
    } = req.body;

    const isValidObjectId = require('mongoose').Types.ObjectId.isValid;
    const finalSourcePostId = isValidObjectId(sourcePostId) ? sourcePostId : undefined;

    const finalCoordinates = (coordinates && typeof coordinates.lng === 'number' && typeof coordinates.lat === 'number')
      ? { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] }
      : (itinerary && itinerary[0]?.latitude && itinerary[0]?.longitude)
        ? { type: 'Point', coordinates: [itinerary[0].longitude, itinerary[0].latitude] }
        : (itinerary && itinerary[0]?.places?.[0]?.longitude && itinerary[0]?.places?.[0]?.latitude)
          ? { type: 'Point', coordinates: [itinerary[0].places[0].longitude, itinerary[0].places[0].latitude] }
          : undefined;

    const newItinerary = new LyraItinerary({
      userId: req.user._id,
      sourcePostId: finalSourcePostId,
      travel_type,
      itinerary,
      stay_suggestions,
      estimated_cost,
      nearby_recommendations,
      confidence,
      visibility: visibility || 'public',
      location: {
        name: locationName,
        coordinates: finalCoordinates
      }
    });

    try {
      await newItinerary.save();
    } catch (saveError) {
      console.error('❌ [SAVE LYRA DETAILED ERROR]', JSON.stringify(saveError.errors, null, 2));
      throw saveError;
    }

    // Update User Memory
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'travelMemory.savedItineraryCount': 1 },
      $set: { 'travelMemory.lastAiPlaformUsed': new Date() }
    });

    // Return the full saved object so the frontend stays in sync
    res.status(201).json(newItinerary);
  } catch (err) {
    console.error('[SAVE LYRA ERROR]', err);
    res.status(500).json({ error: 'Failed to save itinerary' });
  }
};

/**
 * GET /api/itinerary/lyra/my
 * Fetches all saved Lyra itineraries for the user
 */
exports.getMyLyraItineraries = async (req, res) => {
  try {
    const itineraries = await LyraItinerary.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('sourcePostId', 'content images');

    res.json(itineraries);
  } catch (err) {
    console.error('[FETCH MY LYRA ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch your itineraries' });
  }
};

/**
 * POST /api/itinerary/lyra/:id/share
 * Shares a saved itinerary to the social feed
 */
exports.shareItineraryToFeed = async (req, res) => {
  try {
    const itinerary = await LyraItinerary.findOne({ _id: req.params.id, userId: req.user._id });
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    if (itinerary.isSharedToFeed) return res.status(400).json({ error: 'Itinerary already shared!' });

    // Create a Social Post
    const newPost = new Post({
      userId: req.user._id,
      content: `Just generated a ${itinerary.travel_type} itinerary for ${itinerary.location?.name || 'my trip'} using Lyra! ✨\n\nCheck out my plan!`,
      placeName: itinerary.location?.name || '',
      location: itinerary.location?.coordinates || { type: 'Point', coordinates: [0, 0] },
      visibility: 'global'
    });

    await newPost.save();

    // Link back
    itinerary.isSharedToFeed = true;
    itinerary.sharedPostId = newPost._id;
    await itinerary.save();

    res.json({ message: 'Itinerary shared to feed! 🌍', postId: newPost._id });
  } catch (err) {
    console.error('[SHARE ITINERARY ERROR]', err);
    res.status(500).json({ error: 'Failed to share itinerary' });
  }
};

/**
 * POST /api/itinerary/lyra/:id/clone
 * Allows a user to "Use this itinerary" (copy someone else's public plan)
 */
exports.cloneItinerary = async (req, res) => {
  try {
    const original = await LyraItinerary.findById(req.params.id);
    if (!original || (original.visibility === 'private' && original.userId.toString() !== req.user._id.toString())) {
      return res.status(404).json({ error: 'Itinerary not available for cloning' });
    }

    const copy = new LyraItinerary({
      userId: req.user._id,
      travel_type: original.travel_type,
      itinerary: original.itinerary,
      stay_suggestions: original.stay_suggestions,
      estimated_cost: original.estimated_cost,
      nearby_recommendations: original.nearby_recommendations,
      location: original.location,
      confidence: original.confidence,
      isCloned: true,
      clonedFrom: original._id,
      visibility: 'private' // Default clone to private
    });

    await copy.save();

    res.status(201).json({ message: 'Itinerary copied to your backpack! 🎒', id: copy._id });
  } catch (err) {
    console.error('[CLONE ITINERARY ERROR]', err);
    res.status(500).json({ error: 'Failed to copy itinerary' });
  }
};

/**
 * DELETE /api/itinerary/lyra/:id
 * Deletes a Lyra-generated itinerary
 */
exports.deleteLyraItinerary = async (req, res) => {
  try {
    const itinerary = await LyraItinerary.findOne({ _id: req.params.id, userId: req.user._id });

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found or unauthorized' });
    }

    await LyraItinerary.findByIdAndDelete(req.params.id);
    res.json({ message: 'Itinerary deleted successfully' });
  } catch (error) {
    console.error('[deleteLyraItinerary]', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/itinerary/location/autocomplete
 * Proxy for Google Places Autocomplete API
 */
exports.locationAutocomplete = async (req, res) => {
  try {
    const { input } = req.query;
    if (!input) return res.json({ predictions: [] });

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&components=country:in`;

    const response = await axios.get(url);
    res.json(response.data);
  } catch (err) {
    console.error('[AUTOCOMPLETE PROXY ERROR]', err.message);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
};

/**
 * GET /api/itinerary/location/geocode
 * Proxy for Google Geocoding API (Geocode & Reverse Geocode)
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng, address } = req.query;

    let url;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (lat && lng) {
      url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    } else if (address) {
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    } else {
      return res.status(400).json({ error: 'Coordinates or address required' });
    }

    const response = await axios.get(url);
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];

      // Attempt to extract a clean city or neighborhood name
      const getCity = (components) => {
        for (const type of ['locality', 'sublocality', 'administrative_area_level_3', 'administrative_area_level_2']) {
          const comp = components.find(c => c.types.includes(type));
          if (comp) return comp.long_name;
        }
        return null;
      };

      let bestName = getCity(result.address_components) || result.address_components[0].long_name;

      // If it's still a plus code, try to grab the next part of the formatted address
      if (bestName.includes('+')) {
        const parts = result.formatted_address.split(',');
        bestName = parts.length > 1 ? parts[1].trim() : bestName;
      }

      return res.json({
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        name: bestName,
        location: result.geometry.location // { lat, lng }
      });
    }
    res.json({ error: 'Location not found' });
  } catch (err) {
    console.error('[GEOCODE PROXY ERROR]', err.message);
    res.status(500).json({ error: 'Failed to geocode location' });
  }
};

/**
 * GET /api/itinerary/lyra/:id
 * Fetches a specific Lyra itinerary by ID (Publicly accessible for sharing)
 */
exports.getLyraItineraryById = async (req, res) => {
  try {
    const itinerary = await LyraItinerary.findById(req.params.id)
      .populate('userId', 'firstName lastName photos');
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    res.json(itinerary);
  } catch (err) {
    console.error('[FETCH LYRA BY ID ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch itinerary' });
  }
};

/**
 * POST /api/itinerary/premium
 * EkalGo Premium Plan Generator with Smart Budget Allocation
 */
exports.generatePremiumItinerary = async (req, res) => {
  try {
    const { totalBudget, days, location, lat, lng } = req.body;
    
    if (!totalBudget || !days || !location) {
      return res.status(400).json({ error: 'Budget, days, and location are required for a Premium Plan.' });
    }

    const allocator = new SmartBudgetAllocator(totalBudget, days);
    const limits = allocator.calculateBaseAllocations();
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    let rawHotels = [];
    let rawFood = [];
    
    // We reuse the existing fetchNearby from within the file (it's declared up top)
    if (lat && lng && apiKey) {
      // Fetch nearby places for realism
      // Note: fetchNearby is defined in this file, we can use it.
      // fetchNearby(lat, lng, radius, keywords, apiKey)
      rawHotels = await fetchNearby(lat, lng, 15000, 'hotel|resort|accommodation', apiKey);
      rawFood = await fetchNearby(lat, lng, 10000, 'restaurant|cafe|food', apiKey);
    }

    // 2. ENFORCE BUDGET: Filter strictly before sending to frontend
    const affordableHotels = allocator.filterHotelsWithinBudget(rawHotels);
    const affordableFood = allocator.filterFoodWithinBudget(rawFood);

    // Provide the exact payload structure required by the new React Native UI
    const premiumPayload = {
      tripId: `premium_${Date.now()}`,
      location,
      budgetBreakdown: allocator.generateBudgetState(),
      recommendations: {
        hotels: affordableHotels.slice(0, 5).map(h => ({
          id: h.place_id || `h_${Date.now()}_${Math.random()}`,
          name: h.name,
          pricePerNight: h.pricePerNight,
          totalStayCost: h.totalCost,
          distanceFromCenter: 'Central',
          rating: h.rating || 4.0,
          category: h.isBudgetFriendly ? 'Budget' : 'Standard'
        })),
        food: affordableFood.slice(0, 5).map(f => ({
          id: f.place_id || `f_${Date.now()}_${Math.random()}`,
          dishName: f.name, // Usually a restaurant name, but mocked for structure
          famousRestaurants: [f.name],
          averagePrice: f.averagePrice,
          distanceFromItinerary: 'Nearby',
          tags: f.isBudgetFriendly ? ['Budget Friendly'] : ['Local Cuisine']
        }))
      },
      dailyPlan: Array.from({ length: days }).map((_, i) => ({
        day: i + 1,
        date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        spots: [
          {
            timeOfDay: 'Morning',
            placeName: 'Explore ' + location,
            cost: 0,
            distanceFromPrevious: '0 km',
            travelTimeMins: 0
          }
        ]
      }))
    };

    res.json(premiumPayload);
  } catch (err) {
    console.error('[PREMIUM ITINERARY ERROR]', err);
    res.status(500).json({ error: 'Failed to generate Premium Itinerary' });
  }
};
