const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  getDiscoverProfiles, 
  likeUser, 
  skipUser, 
  superLikeUser
} = require('../controllers/discoverController');

router.use(protect);
router.get('/', getDiscoverProfiles);
router.post('/like', likeUser);
router.post('/skip', skipUser);
router.post('/superlike', superLikeUser);
router.post('/location', updateLocation);

module.exports = router;
