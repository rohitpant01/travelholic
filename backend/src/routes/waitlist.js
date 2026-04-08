const express = require('express');
const router = express.Router();
const { joinWaitlist, getWaitlistCount } = require('../controllers/waitlistController');

router.post('/join', joinWaitlist);
router.get('/count', getWaitlistCount);

module.exports = router;
