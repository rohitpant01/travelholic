const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMatches, unmatch } = require('../controllers/chatController');

router.use(protect);
router.get('/', getMatches);
router.delete('/:matchId', unmatch);

module.exports = router;
