const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  getUnreadCount,
  togglePinMatch,
  toggleMuteMatch,
  resetUnreadCount,
} = require('../controllers/chatController');
const { uploadChatMedia } = require('../config/cloudinary');

router.use(protect);
router.get('/unread-count', getUnreadCount);
router.get('/:matchId/messages', getMessages);
router.post('/:matchId/send', uploadChatMedia.fields([
  { name: 'file', maxCount: 1 }, 
  { name: 'audio', maxCount: 1 }
]), sendMessage);
router.post('/:matchId/send-voice', uploadChatMedia.fields([
  { name: 'audio', maxCount: 1 }
]), sendMessage);
router.patch('/message/:messageId', editMessage);
router.delete('/message/:messageId', deleteMessage);
router.post('/message/:messageId/react', reactToMessage);
router.post('/:matchId/pin', togglePinMatch);
router.post('/:matchId/mute', toggleMuteMatch);
router.put('/:matchId/read', resetUnreadCount);  // Reset unread when opening chat

module.exports = router;
