const express = require('express');
const router = express.Router();
console.log('📦 [ROUTE LOADED] /api/itinerary');
const rateLimit = require('express-rate-limit');
const { 
  generateItinerary, 
  getLyraItinerary, 
  saveLyraItinerary, 
  getLyraItineraryById,
  getMyLyraItineraries,
  shareItineraryToFeed,
  cloneItinerary,
  deleteLyraItinerary,
  locationAutocomplete,
  reverseGeocode,
  generatePremiumItinerary
} = require('../controllers/itineraryController');
const { protect } = require('../middleware/auth');

// 🔒 Rate Limiting for Lyra (10 requests / minute)
const lyraLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Lyra is a bit overwhelmed! 🌸 Please wait a minute before asking for another itinerary.' }
});

// 📍 Location Proxies
router.get('/location/autocomplete', protect, locationAutocomplete);
router.get('/location/geocode', protect, reverseGeocode);

// temporarily public for debugging
router.get('/generate', generateItinerary);

// 🌟 Premium EkalGo Planner
router.post('/premium', protect, generatePremiumItinerary);

// 🚀 Lyra AI Assistant
router.get('/lyra/:id', getLyraItineraryById); // 🔥 Public deep linking route
router.post('/lyra', protect, lyraLimiter, getLyraItinerary);
router.post('/lyra/save', protect, saveLyraItinerary);
router.get('/my', protect, getMyLyraItineraries);
router.post('/lyra/:id/share', protect, shareItineraryToFeed);
router.post('/lyra/:id/clone', protect, cloneItinerary);
router.delete('/lyra/:id', protect, deleteLyraItinerary);

module.exports = router;
