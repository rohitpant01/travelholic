// ============================================================
// DISCOVER ROUTES - src/routes/discover.js
// ============================================================
const express = require('express');
const discoverRouter = express.Router();
const { protect } = require('../middleware/auth');
const { getDiscoverProfiles, likeUser, skipUser, superLikeUser } = require('../controllers/discoverController');

discoverRouter.use(protect);
discoverRouter.get('/', getDiscoverProfiles);
discoverRouter.post('/like', likeUser);
discoverRouter.post('/skip', skipUser);
discoverRouter.post('/superlike', superLikeUser);

// ============================================================
// MATCHES ROUTES - src/routes/matches.js
// ============================================================
const matchRouter = express.Router();
const { getMatches, unmatch } = require('../controllers/chatController');

matchRouter.use(protect);
matchRouter.get('/', getMatches);
matchRouter.delete('/:matchId', unmatch);

// ============================================================
// CHAT ROUTES - src/routes/chat.js
// ============================================================
const chatRouter = express.Router();
const { uploadPhoto } = require('../config/cloudinary');
const { getMessages, sendMessage } = require('../controllers/chatController');

chatRouter.use(protect);
chatRouter.get('/:matchId/messages', getMessages);
chatRouter.post('/:matchId/send', uploadPhoto.single('image'), sendMessage);

module.exports = { discoverRouter, matchRouter, chatRouter };
