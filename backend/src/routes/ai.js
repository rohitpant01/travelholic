const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  generateItinerary, generateQuote, generateDestinations, getPlaceInsights,
  generateTeaserItinerary, searchDestinationsTeaser, getPlaceProxy, getAutocompleteProxy, 
  getNearbyProxy, generateTopDestinations, saveAIItinerary, getMyAIItineraries, publishAIItinerary, deleteAIItinerary
} = require('../controllers/aiController');

router.post('/generate', protect, generateItinerary);
router.post('/itinerary/save', protect, saveAIItinerary);
router.get('/itinerary/my', protect, getMyAIItineraries);
router.delete('/itinerary/:id', protect, deleteAIItinerary);
router.post('/itinerary/:id/publish', protect, publishAIItinerary);
router.post('/place-insights', protect, getPlaceInsights);
router.get('/destinations', generateDestinations);
router.get('/top-destinations', generateTopDestinations);
router.post('/quote', generateQuote); // Public
router.post('/teaser/itinerary', generateTeaserItinerary); // Public Teaser
router.get('/teaser/search', searchDestinationsTeaser); // Public Search Teaser
router.post('/proxy/place-details', getPlaceProxy); // Public Proxy
router.get('/proxy/autocomplete', getAutocompleteProxy); // Public Proxy
router.get('/proxy/nearby', getNearbyProxy); // Public Proxy

module.exports = router;
