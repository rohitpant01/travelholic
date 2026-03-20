const User = require('../models/User');
const { Match } = require('../models/Match');
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
      .select('firstName lastName username age gender bio city country photos interests languages lookingFor isPhotoVerified countriesVisited dreamDestination completedTrips memberStatus location isOnline lastSeen origin destination travelDate followers following');

    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const isFollowing = targetUser.followers?.includes(req.user._id);
    const followersCount = targetUser.followers?.length || 0;
    const followingCount = targetUser.following?.length || 0;
    
    // Dynamically calculate matches count from Match collection
    const actualMatchesCount = await Match.countDocuments({
      users: targetUser._id,
      isActive: true
    });

    const currentUser = await User.findById(req.user._id).select('location');
    let distanceKm = null;

    if (currentUser?.location?.coordinates && targetUser.location?.coordinates) {
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
    userObj.isFollowing = isFollowing;
    userObj.followersCount = followersCount;
    userObj.followingCount = followingCount;
    userObj.matchesCount = actualMatchesCount;
    userObj.tripsCompleted = targetUser.completedTrips?.length || 0;
    userObj.memberStatus = targetUser.memberStatus || 'Free';
    
    // Cleanup internal arrays
    delete userObj.followers;
    delete userObj.following;

    res.json({ user: userObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// ✅ NEW: Who liked me
// @desc    Get list of users who liked the current user (pending, not yet matched)
// @route   GET /api/user/who-liked-me
// @access  Private
// ============================================================
const getWhoLikedMe = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).select('likedBy matches blockedUsers');
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Convert to string arrays for easy comparison
    const matchedIds = (currentUser.matches || []).map(id => id.toString());
    const blockedIds = (currentUser.blockedUsers || []).map(id => id.toString());

    // likedBy = people who liked me
    // Filter out: people we already matched with, blocked users, and SKIPPED users
    const skippedIds = (currentUser.skips || []).map(id => id.toString());
    
    const pendingLikerIds = (currentUser.likedBy || [])
      .map(id => id.toString())
      .filter(id => !matchedIds.includes(id) && !blockedIds.includes(id) && !skippedIds.includes(id));

    // Fetch their profiles (only safe public fields)
    const likers = await User.find({ _id: { $in: pendingLikerIds } })
      .select('firstName lastName age gender city country photos bio interests isPhotoVerified origin destination travelDate')
      .lean();

    // Map: only expose first photo (blurred on client), hide nothing needed for like-back
    const sanitized = likers.map(u => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      age: u.age,
      gender: u.gender,
      city: u.city,
      country: u.country,
      bio: u.bio,
      interests: u.interests || [],
      isPhotoVerified: u.isPhotoVerified || false,
      // Only send first photo — client decides whether to blur it
      photo: u.photos?.[0]?.url || null,
      origin: u.origin,
      destination: u.destination,
      travelDate: u.travelDate
    }));

    // Sync the counter if it's drift (Self-healing)
    if (currentUser.likesReceived !== sanitized.length) {
      currentUser.likesReceived = sanitized.length;
      await currentUser.save({ validateBeforeSave: false });
    }

    res.json({ likedBy: sanitized, totalCount: sanitized.length });
  } catch (error) {
    console.error('[getWhoLikedMe] Error:', error);
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
      'origin', 'destination', 'travelDate', 'pushToken',
    ];

    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.body.city || req.body.country || req.body.coordinates) {
      const city = req.body.city !== undefined ? req.body.city : (user.city || user.location?.city || '');
      const country = req.body.country !== undefined ? req.body.country : (user.country || user.location?.country || '');
      
      // Validation: only error if explicitly trying to set to empty string
      if (req.body.city === '' || req.body.country === '') {
        return res.status(400).json({ error: 'City and Country cannot be empty' });
      }

      updates.city = city;
      updates.country = country;
      updates.location = {
        type: 'Point',
        coordinates: req.body.coordinates || user.location?.coordinates || [0, 0],
        city: city,
        country: country,
        formattedAddress: req.body.formattedAddress || `${city}, ${country}` || user.location?.formattedAddress || '',
      };
    }

    const merged = { ...user.toObject(), ...updates };

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
    const user = await User.findById(req.user._id);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
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
    res.status(500).json({ error: error.message });
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
      message: result.message || (result.verified
        ? '✅ Identity verified successfully!'
        : `Verification failed (${result.similarity}% similarity). Please try again with a clearer selfie.`),
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
    const { Match } = require('../models/Match');
    await Match.deleteMany({ users: { $all: [req.user._id, targetUserId] } });
    const userBeforeBlock = await User.findById(req.user._id).select('likedBy');
    const wasLiker = userBeforeBlock.likedBy?.some(id => id.toString() === targetUserId);

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { 
        matches: targetUserId, 
        likes: targetUserId, 
        superLikes: targetUserId,
        likedBy: targetUserId 
      },
      ...(wasLiker ? { $inc: { likesReceived: -1 } } : {})
    });
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { matches: req.user._id, likedBy: req.user._id }
    });
    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Follow/Unfollow a user
// @route   POST /api/user/follow/:userId
// @access  Private
const followUser = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const currentUser = await User.findById(currentUserId);
    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(currentUserId, { $pull: { following: targetUserId } });
      await User.findByIdAndUpdate(targetUserId, { $pull: { followers: currentUserId } });
      res.json({ message: 'Unfollowed successfully', isFollowing: false });
    } else {
      // Follow
      await User.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetUserId } });
      await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: currentUserId } });
      res.json({ message: 'Followed successfully', isFollowing: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Add a completed trip
// @route   POST /api/user/completed-trips
// @access  Private
const addCompletedTrip = async (req, res) => {
  try {
    const { origin, destination, startDate, endDate, details } = req.body;
    
    if (!origin?.city || !destination?.city || !startDate || !endDate) {
      return res.status(400).json({ error: 'Origin, Destination, Start Date, and End Date are all required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid dates provided.' });
    }

    if (end < start) {
      return res.status(400).json({ error: 'End Date cannot be before Start Date.' });
    }

    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.completedTrips.unshift({
      origin,
      destination,
      startDate: start,
      endDate: end,
      duration,
      details: details || ''
    });

    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Trip added successfully', trips: user.completedTrips });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update a completed trip
// @route   PUT /api/user/completed-trips/:tripId
// @access  Private
const updateCompletedTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { origin, destination, startDate, endDate, details } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const tripIndex = user.completedTrips.findIndex(t => t._id.toString() === tripId);
    if (tripIndex === -1) return res.status(404).json({ error: 'Trip not found' });

    if (origin) user.completedTrips[tripIndex].origin = origin;
    if (destination) user.completedTrips[tripIndex].destination = destination;
    if (startDate) user.completedTrips[tripIndex].startDate = new Date(startDate);
    if (endDate) user.completedTrips[tripIndex].endDate = new Date(endDate);
    if (details !== undefined) user.completedTrips[tripIndex].details = details;

    // Recalculate duration if dates changed
    if (startDate || endDate) {
      const s = user.completedTrips[tripIndex].startDate;
      const e = user.completedTrips[tripIndex].endDate;
      user.completedTrips[tripIndex].duration = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
    }

    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Trip updated successfully', trips: user.completedTrips });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a completed trip
// @route   DELETE /api/user/completed-trips/:tripId
// @access  Private
const deleteCompletedTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.completedTrips = user.completedTrips.filter(t => t._id.toString() !== tripId);
    await user.save({ validateBeforeSave: false });
    
    res.json({ message: 'Trip deleted successfully', trips: user.completedTrips });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get completed trips for a user
// @route   GET /api/user/:userId/completed-trips
// @access  Private
const getCompletedTrips = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('completedTrips');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ trips: user.completedTrips || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Report a user
// @route   POST /api/user/report
// @access  Private
const reportUser = async (req, res) => {
  try {
    const { targetUserId, reason, details } = req.body;
    if (!targetUserId || !reason) {
      return res.status(400).json({ error: 'Target user and reason are required' });
    }
    // For now, we log it and return success. 
    // In production, this would save to a Reports collection.
    console.log(`[REPORT] User ${req.user._id} reported ${targetUserId}. Reason: ${reason}. Details: ${details}`);
    res.json({ message: 'User reported. Our safety team will investigate.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getProfile, getUserById, updateProfile,
  uploadPhotos, deletePhoto, setProfilePhoto,
  verifySelfie, updateLocation, updateDistance,
  deactivateAccount, blockUser, reportUser,
  getWhoLikedMe, followUser,
  addCompletedTrip, updateCompletedTrip, deleteCompletedTrip, getCompletedTrips,
};