const express = require('express');
const router = express.Router();
const { searchPlaces } = require('../controllers/placeController');
const { getPlaceDetails } = require('../controllers/detailsController');
const { protect } = require('../middleware/auth');

router.get('/search', protect, searchPlaces);
router.get('/details', protect, getPlaceDetails);

module.exports = router;
