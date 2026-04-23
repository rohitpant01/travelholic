const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadPhoto, uploadSelfie } = require('../config/cloudinary');
const {
  getProfile,
  getUserById,
  updateProfile,
  uploadPhotos,
  deletePhoto,
  setProfilePhoto,
  verifySelfie,
  updateLocation,
  updateDistance,
  deactivateAccount,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
  getWhoLikedMe,
  followUser,
  addCompletedTrip,
  updateCompletedTrip,
  deleteCompletedTrip,
  getCompletedTrips,
  deleteSavedDestination,
  saveDestination,
  syncSavedDestinations,
  requestAccountDeletion,
  cancelAccountDeletion,
  getProfileViews,
} = require('../controllers/userController');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

// ── Debug ────────────────────────────────────────────────────
router.post('/test-upload', upload.array('photos', 6), (req, res) => {
  console.log('[TEST UPLOAD] Received files:', req.files?.length);
  res.json({ message: 'Test upload successful', count: req.files?.length });
});

// ── Own profile ───────────────────────────────────────────────
router.get('/profile', protect, getProfile);
router.put('/update', protect, updateProfile);

// ── ✅ NEW: Who liked me ──────────────────────────────────────
router.get('/who-liked-me', protect, getWhoLikedMe);
router.get('/views', protect, getProfileViews);
router.post('/follow/:userId', protect, followUser);

// ── Photos ───────────────────────────────────────────────────
router.post('/photos', protect, uploadPhoto.array('photos', 6), uploadPhotos);
router.delete('/photos/:photoId', protect, deletePhoto);
router.put('/photos/:photoId/profile', protect, setProfilePhoto);

// ── Verification ─────────────────────────────────────────────
router.post('/verify-selfie', protect, uploadSelfie.single('selfie'), verifySelfie);

// ── Location / Distance ───────────────────────────────────────
router.put('/location', protect, updateLocation);
router.put('/distance', protect, updateDistance);

// ── Account actions ───────────────────────────────────────────
router.post('/report', protect, reportUser);
router.delete('/account', protect, requestAccountDeletion);
router.post('/cancel-deletion', protect, cancelAccountDeletion);
router.post('/deactivate', protect, deactivateAccount);

// ── Interaction & Safety Data ────────────────────────────────
router.get('/blocked', protect, getBlockedUsers);
router.post('/block', protect, blockUser);
router.post('/unblock', protect, unblockUser);

// Completed Trips
router.post('/completed-trips', protect, addCompletedTrip);
router.put('/completed-trips/:tripId', protect, updateCompletedTrip);
router.delete('/completed-trips/:tripId', protect, deleteCompletedTrip);
router.get('/:userId/completed-trips', getCompletedTrips);

// Saved Destinations
router.post('/saved-destinations', protect, saveDestination);
router.delete('/saved-destinations/:destinationId', protect, deleteSavedDestination);
router.post('/sync-saved-destinations', protect, syncSavedDestinations);

// ── View another user (PUBLIC) ────────────────────────────────
// ⚠️ Keep this LAST. Matches any ID or string like "profile" if not matched above.
router.get('/:userId', getUserById);

module.exports = router;