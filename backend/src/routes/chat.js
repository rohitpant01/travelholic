const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadPhoto } = require('../config/cloudinary');
const { getMessages, sendMessage } = require('../controllers/chatController');

router.use(protect);
router.get('/:matchId/messages', getMessages);
router.post('/:matchId/send', uploadPhoto.single('image'), sendMessage);

module.exports = router;
