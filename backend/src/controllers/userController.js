const User = require('../models/User');
const { cloudinary, deleteImage } = require('../config/cloudinary');
const { compareFaces } = require('../utils/faceVerification');

// @desc    Get own profile
// @route   GET /api/user/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -otp -otpExpiry');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get user profile by ID (for viewing matches)
// @route   GET /api/user/:userId
// @access  Private
const getUserById = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId)
      .select('firstName lastName username age gender bio city country photos interests languages lookingFor isPhotoVerified countriesVisited dreamDestination tripsCompleted location');
    
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Calculate distance if current user has location
    const currentUser = await User.findById(req.user._id).select('location');
    let distanceKm = null;

    if (currentUser?.location?.coordinates && targetUser.location?.coordinates) {
      const { Match, Message } = require('../models/Match'); // Not needed here but for reference
      // I'll copy the getDistance logic or just use a simple version here.
      // Better to move getDistance to a utility if I use it in multiple places.
      // For now, I'll just calculate it.
      const lat1 = currentUser.location.coordinates[1];
      const lon1 = currentUser.location.coordinates[0];
      const lat2 = targetUser.location.coordinates[1];
      const lon2 = targetUser.location.coordinates[0];
      
      const R = 6371; 
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceKm = Math.round(R * c);
    }

    const userObj = targetUser.toObject();
    userObj.distanceKm = distanceKm;

    res.json({ user: userObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update user profile (multi-step registration steps 3-7)
// @route   PUT /api/user/update
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const allowedFields = [
      'dob', 'gender', 'pronouns', 'bio',
      'hometown', 'lastVisitedPlace', 'countriesVisited', 'dreamDestination',
      'interests', 'languages',
      'lookingFor', 'preferredGender', 'preferredAgeMin', 'preferredAgeMax',
      'budget', 'tripDuration', 'registrationStep', 'maxDiscoveryDistance',
      'firstName', 'lastName', 'username', 'city', 'country',
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Handle location update
    if (req.body.city || req.body.country || req.body.coordinates) {
      if (req.body.city) updates.city = req.body.city;
      if (req.body.country) updates.country = req.body.country;
      updates.location = {
        type: 'Point',
        coordinates: req.body.coordinates || [0, 0],
        city: req.body.city || '',
        country: req.body.country || '',
        formattedAddress: req.body.formattedAddress || '',
      };
    }

    // Check profile completeness
    const user = await User.findById(req.user._id);
    const merged = { ...user.toObject(), ...updates };
    
    // A profile is complete if it has:
    // 1. Core details (dob, gender, bio)
    // 2. Photos (at least 3)
    // 3. Interests (at least 1)
    // 4. Registration step is 8 (finished all 7 steps)
    if (
      merged.dob && 
      merged.gender && 
      merged.bio && 
      merged.bio.length >= 10 &&
      merged.photos?.length >= 3 && 
      merged.interests?.length > 0 &&
      (merged.registrationStep >= 8 || req.body.profileComplete === true)
    ) {
      updates.profileComplete = true;
    } else {
      updates.profileComplete = false;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry');

    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Upload photos
// @route   POST /api/user/photos
// @access  Private
const uploadPhotos = async (req, res) => {
  try {
    console.log(`[USER] Uploading photos for user: ${req.user?._id || 'unknown'}`);
    console.log('[HEADERS]', req.headers['content-type']);
    console.log(`[FILES] Received count: ${req.files?.length || 0}`);
    
    const user = await User.findById(req.user._id);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded', 
        debug: {
          headers: req.headers['content-type'],
          filesCount: req.files?.length || 0,
          bodyKeys: Object.keys(req.body || {})
        }
      });
    }

    if (user.photos.length + req.files.length > 6) {
      return res.status(400).json({ error: 'Maximum 6 photos allowed' });
    }

    const newPhotos = req.files.map((file, index) => ({
      url: file.path,
      publicId: file.filename,
      isProfile: user.photos.length === 0 && index === 0,
    }));

    user.photos.push(...newPhotos);
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Photos uploaded', photos: user.photos });
  } catch (error) {
    console.error('[CONTROLLER ERROR]', error);
    res.status(500).json({ 
      error: error.message,
      debug: {
        headers: req.headers['content-type'],
        filesCount: req.files?.length || 0,
        bodyKeys: Object.keys(req.body || {})
      }
    });
  }
};

// @desc    Delete a photo
// @route   DELETE /api/user/photos/:photoId
// @access  Private
const deletePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const photo = user.photos.id(req.params.photoId);

    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (user.photos.length <= 1) return res.status(400).json({ error: 'Cannot delete last photo' });

    await deleteImage(photo.publicId);
    user.photos.pull(req.params.photoId);

    // Ensure first photo is always profile photo
    if (user.photos.length > 0 && !user.photos.some(p => p.isProfile)) {
      user.photos[0].isProfile = true;
    }

    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Photo deleted', photos: user.photos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Set profile photo
// @route   PUT /api/user/photos/:photoId/profile
// @access  Private
const setProfilePhoto = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.photos.forEach(p => { p.isProfile = p._id.toString() === req.params.photoId; });
    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Profile photo updated', photos: user.photos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Upload verification selfie and compare with profile photo
// @route   POST /api/user/verify-selfie
// @access  Private
const verifySelfie = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Selfie file required' });

    const user = await User.findById(req.user._id);
    const profilePhoto = user.photos.find(p => p.isProfile) || user.photos[0];

    if (!profilePhoto) return res.status(400).json({ error: 'Upload profile photo first' });

    const selfieUrl = req.file.path;
    const result = await compareFaces(selfieUrl, profilePhoto.url);

    user.verificationSelfieUrl = selfieUrl;
    user.isPhotoVerified = result.verified;
    await user.save({ validateBeforeSave: false });

    res.json({
      verified: result.verified,
      similarity: result.similarity,
      message: result.verified
        ? '✅ Identity verified successfully!'
        : `Verification failed (${result.similarity}% similarity). Please try again with a clearer selfie.`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update location
// @route   PUT /api/user/location
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, city, country, formattedAddress } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      city,
      country,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
        city,
        country,
        formattedAddress,
      },
    });

    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update discovery distance
// @route   PUT /api/user/distance
// @access  Private
const updateDistance = async (req, res) => {
  try {
    const { maxDiscoveryDistance } = req.body;
    if (maxDiscoveryDistance < 10 || maxDiscoveryDistance > 100) {
      return res.status(400).json({ error: 'Distance must be between 10 and 100 km' });
    }

    await User.findByIdAndUpdate(req.user._id, { maxDiscoveryDistance });
    res.json({ message: 'Discovery distance updated', maxDiscoveryDistance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Deactivate account
// @route   DELETE /api/user/account
// @access  Private
const deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false, isOnline: false });
    res.json({ message: 'Account deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Block a user
// @route   POST /api/user/block
// @access  Private
const blockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: targetUserId }
    });
    // Remove from matches if they were matched
    const { Match } = require('../models/Match');
    await Match.deleteMany({
      users: { $all: [req.user._id, targetUserId] }
    });
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { matches: targetUserId, likes: targetUserId, superLikes: targetUserId }
    });
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { matches: req.user._id, likedBy: req.user._id }
    });
    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Report a user
// @route   POST /api/user/report
// @access  Private
const reportUser = async (req, res) => {
  try {
    const { targetUserId, reason } = req.body;
    console.log(`User ${req.user._id} reported user ${targetUserId} for: ${reason}`);
    res.json({ message: 'Report submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getProfile, getUserById, updateProfile,
  uploadPhotos, deletePhoto, setProfilePhoto,
  verifySelfie, updateLocation, updateDistance,
  deactivateAccount, blockUser, reportUser,
};
