const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadPhoto, uploadSelfie } = require('../config/cloudinary');
const {
  getProfile, getUserById, updateProfile,
  uploadPhotos, deletePhoto, setProfilePhoto,
  verifySelfie, updateLocation, updateDistance,
  deactivateAccount, blockUser, reportUser
} = require('../controllers/userController');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

router.use(protect); // All user routes require auth

router.post('/test-upload', upload.array('photos', 6), (req, res) => {
  console.log('[TEST UPLOAD] Received files:', req.files?.length);
  res.json({ message: 'Test upload successful', count: req.files?.length });
});

router.get('/profile', getProfile);
router.get('/:userId', getUserById);
router.put('/update', updateProfile);
router.post('/photos', uploadPhoto.array('photos', 6), uploadPhotos);
router.delete('/photos/:photoId', deletePhoto);
router.put('/photos/:photoId/profile', setProfilePhoto);
router.post('/verify-selfie', uploadSelfie.single('selfie'), verifySelfie);
router.put('/location', updateLocation);
router.put('/distance', updateDistance);
router.post('/block', blockUser);
router.post('/report', reportUser);
router.delete('/account', deactivateAccount);

module.exports = router;
