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
  reportUser,
  getWhoLikedMe,
  followUser,
  addCompletedTrip,
  updateCompletedTrip,
  deleteCompletedTrip,
  getCompletedTrips,
} = require('../controllers/userController');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

router.use(protect); // All user routes require auth

// ── Debug ────────────────────────────────────────────────────
router.post('/test-upload', upload.array('photos', 6), (req, res) => {
  console.log('[TEST UPLOAD] Received files:', req.files?.length);
  res.json({ message: 'Test upload successful', count: req.files?.length });
});

// ── Own profile ───────────────────────────────────────────────
router.get('/profile', getProfile);
router.put('/update', updateProfile);

// ── ✅ NEW: Who liked me ──────────────────────────────────────
// IMPORTANT: must be declared BEFORE router.get('/:userId')
// Express matches routes top-to-bottom; if /:userId came first,
// a request to GET /who-liked-me would treat "who-liked-me" as a userId.
router.get('/who-liked-me', protect, getWhoLikedMe);
router.post('/follow/:userId', protect, followUser);
router.post('/block', protect, blockUser);

// ── Photos ───────────────────────────────────────────────────
router.post('/photos', uploadPhoto.array('photos', 6), uploadPhotos);
router.delete('/photos/:photoId', deletePhoto);
router.put('/photos/:photoId/profile', setProfilePhoto);

// ── Verification ─────────────────────────────────────────────
router.post('/verify-selfie', uploadSelfie.single('selfie'), verifySelfie);

// ── Location / Distance ───────────────────────────────────────
router.put('/location', updateLocation);
router.put('/distance', updateDistance);

// ── Account actions ───────────────────────────────────────────
router.post('/block', blockUser);
router.post('/report', reportUser);
router.delete('/account', deactivateAccount);

// Completed Trips
router.post('/completed-trips', addCompletedTrip);
router.put('/completed-trips/:tripId', updateCompletedTrip);
router.delete('/completed-trips/:tripId', deleteCompletedTrip);
router.get('/:userId/completed-trips', getCompletedTrips);

// ── View another user ─────────────────────────────────────────
// ⚠️  Keep this LAST among GET routes — the wildcard /:userId
//     will match ANY unrecognised path segment if placed higher up.
router.get('/:userId', getUserById);

module.exports = router;