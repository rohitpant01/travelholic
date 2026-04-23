const User = require('../models/User');
const { Match } = require('../models/Match');
const { cloudinary, deleteImage } = require('../config/cloudinary');
const { compareFaces } = require('../utils/faceVerification');
const { updateDeviceToken } = require('../utils/deviceUtility');
const ProfileVisit = require('../models/ProfileVisit');
const { createNotification } = require('../utils/notificationService');

// @desc    Get own profile
// @route   GET /api/user/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -otp -otpExpiry');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Dynamically calculate accurate matches count
    const activeMatches = await Match.find({ users: req.user._id, isActive: true })
      .populate({ path: 'users', select: 'isDeleted blockedUsers' });

    let actualMatchesCount = 0;
    const myBlockedIds = user.blockedUsers || [];
    
    activeMatches.forEach(match => {
      const otherUser = match.users.find(u => u._id.toString() !== req.user._id.toString());
      if (otherUser && !otherUser.isDeleted) {
         const theyBlockedMe = otherUser.blockedUsers && otherUser.blockedUsers.includes(req.user._id);
         const iBlockedThem = myBlockedIds.includes(otherUser._id);
         if (!theyBlockedMe && !iBlockedThem) {
            actualMatchesCount++;
         }
      }
    });

    const viewsCount = await ProfileVisit.countDocuments({ profileOwnerId: req.user._id });
    
    const userObj = user.toObject();
    userObj.matchesCount = actualMatchesCount;

    // Persist to DB to avoid stale data on next load
    if (user.matchesCount !== actualMatchesCount) {
       user.matchesCount = actualMatchesCount;
       await user.save({ validateBeforeSave: false });
    }

    res.json({ user: { ...userObj, viewsCount } });
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
      .select('firstName lastName username age gender bio city country photos interests languages lookingFor isPhotoVerified countriesVisited dreamDestination completedTrips memberStatus location isOnline lastSeen origin destination travelDate followers following blockedUsers');

    if (!targetUser || targetUser.isDeleted) return res.status(404).json({ error: 'User not found' });

    // ⛔ Global Stealth: Block Check
    if (req.user?._id) {
      const currentUser = await User.findById(req.user._id).select('blockedUsers');
      const hasBlocked = currentUser?.blockedUsers?.includes(targetUser._id);
      const isBlockedBy = targetUser.blockedUsers?.includes(req.user._id);
      if (hasBlocked || isBlockedBy) {
        return res.status(403).json({ error: 'User unavailable' });
      }
    }

    const isFollowing = req.user?._id ? targetUser.followers?.includes(req.user._id) : false;
    
    // 🔥 Global Stealth: Exclude deleted users from follower/following counts
    const activeFollowers = await User.countDocuments({ _id: { $in: targetUser.followers || [] }, isDeleted: { $ne: true } });
    const activeFollowing = await User.countDocuments({ _id: { $in: targetUser.following || [] }, isDeleted: { $ne: true } });

    const followersCount = activeFollowers;
    const followingCount = activeFollowing;
    
    // Dynamically calculate matches count from Match collection
    const activeMatches = await Match.find({ users: targetUser._id, isActive: true })
      .populate({ path: 'users', select: 'isDeleted blockedUsers' });

    let actualMatchesCount = 0;
    const targetBlockedIds = targetUser.blockedUsers || [];
    
    activeMatches.forEach(match => {
      const otherUser = match.users.find(u => u._id.toString() !== targetUser._id.toString());
      if (otherUser && !otherUser.isDeleted) {
         const theyBlockedTarget = otherUser.blockedUsers && otherUser.blockedUsers.includes(targetUser._id);
         const targetBlockedThem = targetBlockedIds.includes(otherUser._id);
         if (!theyBlockedTarget && !targetBlockedThem) {
            actualMatchesCount++;
         }
      }
    });

    let distanceKm = null;
    if (req.user?._id) {
      const currentUser = await User.findById(req.user._id).select('location');
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
    }

    const userObj = targetUser.toObject();
    userObj.distanceKm = distanceKm;
    userObj.isFollowing = isFollowing;
    userObj.followersCount = followersCount;
    userObj.followingCount = followingCount;
    userObj.matchesCount = actualMatchesCount;
    userObj.tripsCompleted = targetUser.completedTrips?.length || 0;
    userObj.memberStatus = targetUser.memberStatus || 'Free';
    
    delete userObj.followers;
    delete userObj.following;

    // Persist for data health
    if (targetUser.matchesCount !== actualMatchesCount) {
      targetUser.matchesCount = actualMatchesCount;
      await targetUser.save({ validateBeforeSave: false });
    }

    // 👁️ Record Profile Visit (Custom logic requested)
    if (req.user?._id && req.user._id.toString() !== targetUser._id.toString()) {
       trackProfileVisit(req.user._id, targetUser._id);
    }

    res.json({ user: userObj });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * CORE LOGIC: Handle Profile Visit Tracking
 * - Validates viewer is not owner
 * - Checks for mutual blocks
 * - Skips already matched users
 * - Prevents duplicates within 24 hours
 */
const trackProfileVisit = async (viewerId, profileOwnerId) => {
  try {
    // 1. Skip if viewing self (should be caught by caller but safety first)
    if (viewerId.toString() === profileOwnerId.toString()) return;

    // 2. Fetch both users to check blocks and matches
    const [viewer, owner] = await Promise.all([
      User.findById(viewerId).select('blockedUsers firstName'),
      User.findById(profileOwnerId).select('blockedUsers')
    ]);

    // 3. Skip if target user doesn't exist
    if (!owner) return;

    // 4. Skip if mutual block exists
    const hasBlocked = viewer.blockedUsers?.includes(profileOwnerId);
    const isBlockedBy = owner.blockedUsers?.includes(viewerId);
    if (hasBlocked || isBlockedBy) return;

    // 5. Skip if users are already matched (CORE REQUIREMENT)
    const { Match } = require('../models/Match');
    const existingMatch = await Match.findOne({
      users: { $all: [viewerId, profileOwnerId] },
      isActive: true
    });
    if (existingMatch) return;

    // 6. Deduplication: One visit per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentVisit = await ProfileVisit.findOne({
      viewerId,
      profileOwnerId,
      createdAt: { $gte: twentyFourHoursAgo }
    });

    if (!recentVisit) {
      // 7. Save the visit
      await ProfileVisit.create({ viewerId, profileOwnerId });

      // 8. Notify the owner (Optional, but great for engagement)
      console.log(`[VISIT_TRACKER] Sending notification to ${profileOwnerId} from viewer ${viewerId}`);
      await createNotification({
        recipient: profileOwnerId,
        sender: viewerId,
        type: 'profile_view',
        title: 'New Profile Visitor',
        message: `${viewer.firstName || 'Someone'} viewed your profile.`,
        data: { viewerId }
      });
    } else {
      console.log(`[VISIT_TRACKER] Skipping visit record: Recent visit exists within 24h.`);
    }
  } catch (err) {
    console.warn('[VISIT_TRACKER] Failed to record visit:', err.message);
  }
};

// @desc    Get my profile visitors (non-matched only)
// @route   GET /api/user/visitors
// @access  Private
const getMyVisitors = async (req, res) => {
  try {
    // 1. Fetch latest visits for this user
    const visits = await ProfileVisit.find({ profileOwnerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('viewerId', 'firstName lastName username photos location.city');

    const currentUser = await User.findById(req.user._id).select('blockedUsers');
    const blockedIds = (currentUser.blockedUsers || []).map(id => id.toString());

    // 2. Filter out matches, blocked users, and deleted users
    const { Match } = require('../models/Match');
    const visitorsPromises = visits.map(async (visit) => {
      const visitor = visit.viewerId;
      if (!visitor || visitor.isDeleted || blockedIds.includes(visitor._id.toString())) return null;

      // Skip if already matched (CORE REQUIREMENT)
      const isMatched = await Match.findOne({
        users: { $all: [req.user._id, visitor._id] },
        isActive: true
      });
      if (isMatched) return null;

      const profilePic = visitor.photos?.find(p => p.isProfile)?.url || visitor.photos?.[0]?.url;

      return {
        userId: visitor._id,
        name: `${visitor.firstName} ${visitor.lastName || ''}`.trim(),
        username: visitor.username,
        profilePic,
        visitedAt: visit.createdAt,
        city: visitor.location?.city
      };
    });

    const visitors = (await Promise.all(visitorsPromises)).filter(v => v !== null);

    res.json({ visitors });
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
    const currentUser = await User.findById(req.user._id).select('likedBy matches blockedUsers skips likesReceived');
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

    // Fetch their profiles (only safe public fields, excluding deleted users)
    const likers = await User.find({ 
      _id: { $in: pendingLikerIds },
      isDeleted: { $ne: true }
    })
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

// @desc    Get profile viewers
// @route   GET /api/user/views
// @access  Private
const getProfileViews = async (req, res) => {
  try {
    const views = await ProfileVisit.find({ profileOwnerId: req.user._id })
      .populate('viewerId', 'firstName lastName photos age city country gender isPhotoVerified isOnline')
      .sort({ createdAt: -1 })
      .limit(50);

    const sanitized = views.filter(v => v.viewerId).map(v => ({
      _id: v.viewerId._id,
      firstName: v.viewerId.firstName,
      lastName: v.viewerId.lastName,
      age: v.viewerId.age,
      city: v.viewerId.city,
      country: v.viewerId.country,
      gender: v.viewerId.gender,
      isPhotoVerified: v.viewerId.isPhotoVerified,
      isOnline: v.viewerId.isOnline,
      profilePhoto: v.viewerId.photos?.find(p => p.isProfile)?.url || v.viewerId.photos?.[0]?.url,
      viewedAt: v.createdAt
    }));

    res.json({ views: sanitized, count: sanitized.length });
  } catch (error) {
    console.error('[getProfileViews] Error:', error);
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
      
      let coords = req.body.coordinates || user.location?.coordinates || [0, 0];

      // 📍 FALLBACK: If coordinates are [0,0] but we have City/Country, Geocode it!
      if ((!coords || coords[0] === 0) && (city || country)) {
        try {
          const { geocodeAddress } = require('../utils/geocodingService');
          const result = await geocodeAddress(`${city}, ${country}`);
          if (result) {
            coords = [result.lng, result.lat]; // GeoJSON format: [longitude, latitude]
          }
        } catch (e) {
          console.error('[AUTO-GEOCODE ERROR]', e.message);
        }
      }

      // Validation: only error if explicitly trying to set to empty string
      if (req.body.city === '' || req.body.country === '') {
        return res.status(400).json({ error: 'City and Country cannot be empty' });
      }

      updates.city = city;
      updates.country = country;
      updates.location = {
        type: 'Point',
        coordinates: coords,
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

    // Multi-device: Handle token update separately (to use the utility)
    if (req.body.pushToken) {
      updateDeviceToken(updatedUser, req.body.pushToken, req.body.platform, req.body.deviceId);
      await updatedUser.save({ validateBeforeSave: false });
    }

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

// @desc    Request account deletion (7-day recovery window)
// @route   DELETE /api/user/account
// @access  Private
const requestAccountDeletion = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password confirmation required for account deletion' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Deletion denied for security.' });
    }

    // Set deletion schedule (7 days from now)
    user.isDeleted = true;
    user.isActive = false;
    user.isOnline = false;
    await user.save({ validateBeforeSave: false });

    // 🚀 Global Stealth: Deactivate all trips created by this user
    try {
      const Trip = require('../models/Trip');
      await Trip.updateMany({ creator: user._id }, { isActive: false });
    } catch (tripErr) {
      console.error('[DELETION] Failed to deactivate trips:', tripErr.message);
    }

    // TODO: Send goodbye email/notification if possible

    res.json({
      success: true,
      message: 'Account scheduled for deletion. You will be logged out. You can restore your account within 7 days by logging in again.',
      deletionDate: user.deletionScheduledAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Cancel account deletion
// @route   POST /api/user/cancel-deletion
// @access  Private
const cancelAccountDeletion = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.isDeleted) {
      return res.status(400).json({ error: 'No deletion request pending for this account.' });
    }

    user.isDeleted = false;
    user.deletionScheduledAt = undefined;
    user.isActive = true;

    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Account restoration successful! Welcome back ✨',
      user: user.toPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Deactivate account (classic simple soft-disable)
// @route   POST /api/user/deactivate
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
    
    // Clean up connections
    const { Match } = require('../models/Match');
    const matchExists = await Match.findOneAndDelete({ users: { $all: [req.user._id, targetUserId] } });
    
    const userBeforeBlock = await User.findById(req.user._id).select('likedBy matches following');
    const wasLiker = userBeforeBlock.likedBy?.some(id => id.toString() === targetUserId.toString());
    const wasMatch = userBeforeBlock.matches?.some(id => id.toString() === targetUserId.toString());
    const wasFollowingTarget = userBeforeBlock.following?.some(id => id.toString() === targetUserId.toString());

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { 
        matches: targetUserId, 
        likes: targetUserId, 
        superLikes: targetUserId,
        likedBy: targetUserId,
        following: targetUserId,
        followers: targetUserId
      },
      ...(wasLiker ? { $inc: { likesReceived: -1 } } : {}),
      ...(wasMatch ? { $inc: { matchesCount: -1 } } : {})
    });
    
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { 
        matches: req.user._id, 
        likedBy: req.user._id,
        following: req.user._id,
        followers: req.user._id 
      },
      ...(wasMatch ? { $inc: { matchesCount: -1 } } : {})
    });

    // Fire Socket remove event to sync Frontend Match Counts instantly
    if (wasMatch || matchExists) {
      try {
        const { getIO } = require('../socket/socketHandler');
        const io = getIO();
        const fallbackMatchId = matchExists ? matchExists._id : targetUserId;
        io.to(req.user._id.toString()).emit('match_removed', { matchId: fallbackMatchId, targetUserId });
        io.to(targetUserId.toString()).emit('match_removed', { matchId: fallbackMatchId, targetUserId: req.user._id });
      } catch (socketErr) {
        console.warn('[BLOCK SOCKET ERROR]', socketErr.message);
      }
    }

    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Unblock a user
// @route   POST /api/user/unblock
// @access  Private
const unblockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: targetUserId }
    });
    res.json({ message: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get blocked users list
// @route   GET /api/user/blocked
// @access  Private
const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'blockedUsers', 
      'firstName lastName username photos location age'
    );
    // Sanitize photos
    const blockedList = (user?.blockedUsers || []).map(u => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      age: u.age,
      location: u.location,
      photo: u.photos?.find(p => p.isProfile)?.url || u.photos?.[0]?.url || null
    }));
    res.json({ blockedUsers: blockedList });
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

const Report = require('../models/Report');

// @desc    Report a user
// @route   POST /api/user/report
// @access  Private
const reportUser = async (req, res) => {
  try {
    const { targetUserId, reason, details, matchId } = req.body;
    if (!targetUserId || !reason) {
      return res.status(400).json({ error: 'Target user and reason are required' });
    }

    // 1. Smart Report via Moderation Engine
    const { processReport } = require('../utils/moderationEngine');
    const result = await processReport(req.user._id, targetUserId, 'user', reason, details || '');

    if (result.duplicate) {
      return res.status(200).json({ message: 'You have already reported this user.' });
    }
    if (result.rateLimited) {
      return res.status(429).json({ error: 'Too many reports. Please try again later.' });
    }

    console.log(`[REPORT] User ${req.user._id} reported ${targetUserId}. Reason: ${reason}. Score: ${result.weightedScore?.toFixed(2)}`);

    // 2. AUTO ACTION: Block the User
    // Reuse logic from blockUser controller safely
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: targetUserId }
    });

    // Delete matches from DB
    await Match.deleteMany({ users: { $all: [req.user._id, targetUserId] } });

    // Update user states
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

    // 3. Emit Socket removal to BOTH users
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      // Emit 'match_removed' so frontend can dispatch removeMatch instantly
      io.to(req.user._id.toString()).emit('match_removed', { matchId: matchId || targetUserId, targetUserId });
      io.to(targetUserId.toString()).emit('match_removed', { matchId: matchId || req.user._id.toString(), targetUserId: req.user._id });
    } catch (socketErr) {
      console.warn('[REPORT SOCKET ERROR]', socketErr.message);
    }

    res.json({ 
      success: true,
      message: 'Report submitted. For your safety, this user has been blocked and removed from your chats.' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get user's filed reports
// @route   GET /api/user/reports
// @access  Private
const getMyReports = async (req, res) => {
  try {
    const Report = require('../models/Report');
    const reports = await Report.find({ reportedBy: req.user._id })
      .sort({ createdAt: -1 })
      .select('type reason status createdAt resolvedAt resolution details targetSnapshot targetId');

    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get details of a specific report filed by the user
// @route   GET /api/user/reports/:reportId/details
// @access  Private
const getMyReportDetails = async (req, res) => {
  try {
    const Report = require('../models/Report');
    const report = await Report.findOne({
       _id: req.params.reportId,
       reportedBy: req.user._id 
    }).select('-reporterTrustScore -weight');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Save a destination to bucket list
// @route   POST /api/user/saved-destinations
// @access  Private
const saveDestination = async (req, res) => {
  try {
    const { id, title, image, location, description, rating, budget, bestTime, tags, whyLoveThis, nearestAirport, nearestCity, travelTip, lat, lng } = req.body;
    
    const cleanId = (id || '').toString().trim();
    const cleanTitle = (title || '').trim() || 'Untitled Destination';
    const finalImage = image || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1000&auto=format&fit=crop';
    
    if (!cleanTitle || !finalImage) {
      return res.status(400).json({ error: 'Title and image are required' });
    }

    const user = await User.findById(req.user._id);
    
    // Strict Case-Insensitive check for title or id
    const exists = user.savedDestinations.some(d => 
      (cleanId && d.id === cleanId) || 
      (d.title && d.title.toLowerCase() === cleanTitle.toLowerCase())
    );

    if (exists) {
      return res.status(200).json({ message: 'Destination already in bucket list', savedDestinations: user.savedDestinations });
    }

    user.savedDestinations.unshift({
      id: cleanId || `local-${Date.now()}`,
      title: cleanTitle,
      image,
      location,
      description,
      rating: rating || 0,
      budget: budget || 'Flexible',
      bestTime,
      tags,
      whyLoveThis,
      nearestAirport,
      nearestCity,
      travelTip,
      lat,
      lng,
      savedAt: new Date()
    });

    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Added to bucket list', savedDestinations: user.savedDestinations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Sync local bucket list to DB
// @route   POST /api/user/sync-saved-destinations
// @access  Private
const syncSavedDestinations = async (req, res) => {
  try {
    const { localItems } = req.body;
    if (!Array.isArray(localItems)) {
      return res.status(400).json({ error: 'localItems array required' });
    }

    const user = await User.findById(req.user._id);
    let addedCount = 0;

    localItems.forEach(item => {
      const exists = user.savedDestinations.some(d => 
        (item.id && d.id === item.id) || d.title === item.title
      );

      if (!exists) {
        user.savedDestinations.unshift({
          ...item,
          savedAt: item.savedAt || new Date()
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      await user.save({ validateBeforeSave: false });
    }

    res.json({ 
      message: `Synced ${addedCount} new items`, 
      savedDestinations: user.savedDestinations 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a saved destination
// @route   DELETE /api/user/saved-destinations/:destinationId
// @access  Private
const deleteSavedDestination = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    // Robust deletion: try by _id first (standard), then fallback to custom id or title
    user.savedDestinations = user.savedDestinations.filter(d => 
      (d._id && d._id.toString() !== req.params.destinationId) && 
      (d.id !== req.params.destinationId) &&
      (d.title !== req.params.destinationId)
    );

    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Destination removed', savedDestinations: user.savedDestinations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
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
  getMyReports,
  getMyReportDetails,
  getWhoLikedMe, 
  followUser,
  getMyVisitors, 
  getProfileViews,
  addCompletedTrip, 
  updateCompletedTrip, 
  deleteCompletedTrip, 
  getCompletedTrips,
  saveDestination, 
  deleteSavedDestination, 
  syncSavedDestinations,
  requestAccountDeletion, 
  cancelAccountDeletion,
  getMyReports, 
  getMyReportDetails,
};