const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

// All routes are prefixed with /api/images
router.get('/random', imageController.getRandomImage);
router.get('/place/:query', imageController.getPlaceImage);
router.get('/google-photo', imageController.getGooglePhoto);

module.exports = router;
