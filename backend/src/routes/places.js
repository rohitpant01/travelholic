const express = require('express');
const router = express.Router();
const { searchPlaces, reverseGeocode } = require('../controllers/placeController');
const { getPlaceDetails } = require('../controllers/detailsController');
const { protect } = require('../middleware/auth');

router.get('/search', protect, searchPlaces);
router.get('/details', protect, getPlaceDetails);
router.get('/reverse-geocode', protect, reverseGeocode);

module.exports = router;
