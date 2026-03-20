const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createTrip,
  getTrips,
  getMyTrips,
  getTripDetail,
  updateTrip,
  deleteTrip,
  joinTrip,
  handleMember,
  removeMember,
  getTripMessages,
  sendTripMessage,
  sendTripImage,
  sendTripVoice,
  editTripMessage,
  reactTripMessage,
  deleteTripMessage,
  updateGroupInfo,
  getPendingRequests,
  togglePinTrip,
  toggleMuteTrip
} = require('../controllers/tripController');
const { uploadPhoto, uploadVoice, uploadChatMedia } = require('../config/cloudinary');

// All routes require authentication
router.use(protect);

// Trip CRUD
router.post('/', createTrip);
router.get('/', getTrips);
router.get('/my', getMyTrips);
router.get('/:id', getTripDetail);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);

// Join & member management
router.post('/:id/join', joinTrip);
router.get('/:id/requests', getPendingRequests);
router.put('/:id/members/:userId', handleMember);
router.delete('/:id/members/:userId', removeMember);

// Group chat
router.put('/:id/messages/:messageId', protect, editTripMessage);
router.post('/:id/messages/:messageId/react', protect, reactTripMessage);
router.delete('/:id/messages/:messageId', protect, deleteTripMessage);
router.get('/:id/messages', getTripMessages);
router.post('/:id/messages', sendTripMessage);
router.post('/:id/send-media', uploadChatMedia.fields([{ name: 'file', maxCount: 1 }]), sendTripImage);
router.post('/:id/send-voice', uploadChatMedia.fields([{ name: 'audio', maxCount: 1 }]), sendTripVoice);

// Group Info (WhatsApp-like)
router.put('/:id/group-info', protect, uploadPhoto.single('icon'), updateGroupInfo);
router.post('/:id/pin', protect, togglePinTrip);
router.post('/:id/mute', protect, toggleMuteTrip);

module.exports = router;
