const User = require('../models/User');
const { Match, Swipe } = require('../models/Match');
const { getIO } = require('../socket/socketHandler');

// @desc    Get discoverable users (location-based + filters, including lat/lng proximity checks)
// @route   GET /api/discover or /api/nearby-users
// @access  Private
const getDiscoverProfiles = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const maxDistance = currentUser.maxDiscoveryDistance || 50; // km
    let reqLat = parseFloat(req.query.lat);
    let reqLng = parseFloat(req.query.lng);

    // Get already swiped users
    const swipedUsers = await Swipe.find({ swiper: req.user._id }).select('swiped');
    const swipedIds = swipedUsers.map(s => s.swiped);

    // Build exclusion list: self, swiped, blocked, matches
    const excludeIds = [
      req.user._id,
      ...swipedIds,
      ...(currentUser.blockedUsers || []),
      ...(currentUser.matches || [])
    ];

    const query = {
      _id: { $nin: excludeIds },
      isActive: true,
      // Show any active user who has at least 1 photo (not just profileComplete ones)
      'photos.0': { $exists: true },
    };

    // Use geospatial query if query has lat/lng or user has location setup
    const validReqCoords = !isNaN(reqLat) && !isNaN(reqLng);
    const validUserCoords = currentUser.location && currentUser.location.coordinates && currentUser.location.coordinates[0] !== 0;
    
    if (validReqCoords || validUserCoords) {
      const activeLng = validReqCoords ? reqLng : currentUser.location.coordinates[0];
      const activeLat = validReqCoords ? reqLat : currentUser.location.coordinates[1];
      query.location = {
        $near: { // Request requires $near explicitly
          $geometry: {
            type: "Point",
            coordinates: [activeLng, activeLat]
          },
          $maxDistance: maxDistance * 1000 // meters to km
        }
      };
    }

    let profiles = await User.find(query)
      .select('firstName lastName username age gender bio photos interests languages lookingFor isPhotoVerified location countriesVisited dreamDestination')
      .limit(100); // the ones near will be automatically sorted by MongoDB $near

    // Add distance in km for display
    const enriched = profiles.map(p => {
      let distanceKm = null;
      let activeLng = !isNaN(reqLng) ? reqLng : currentUser.location?.coordinates?.[0];
      let activeLat = !isNaN(reqLat) ? reqLat : currentUser.location?.coordinates?.[1];

      if (activeLng && p.location?.coordinates?.[0]) {
        // haversine formula approximation since $near doesn't project distance in find
        const lat1 = activeLat;
        const lon1 = activeLng;
        const lat2 = p.location.coordinates[1];
        const lon2 = p.location.coordinates[0];
        
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        distanceKm = Math.round(R * c);
      }
      return { ...p.toObject(), distanceKm };
    });

    res.json({ profiles: enriched, count: enriched.length });
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Like a user
// @route   POST /api/discover/like
// @access  Private
const likeUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }

    // Record the swipe
    await Swipe.create({ swiper: currentUserId, swiped: targetUserId, action: 'like' });

    // Update likes arrays
    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { likes: targetUserId },
    });
    await User.findByIdAndUpdate(targetUserId, {
      $addToSet: { likedBy: currentUserId },
      $inc: { likesReceived: 1 },
    });

    // Check for mutual like (match!)
    const targetUser = await User.findById(targetUserId);
    const isMatch = targetUser.likes.some(id => id.toString() === currentUserId.toString());

    if (isMatch) {
      // Create match
      const existingMatch = await Match.findOne({
        users: { $all: [currentUserId, targetUserId] },
      });

      if (!existingMatch) {
        const match = await Match.create({
          users: [currentUserId, targetUserId],
        });

        // Update both users' matches
        await User.findByIdAndUpdate(currentUserId, {
          $addToSet: { matches: targetUserId },
          $inc: { matchesCount: 1 },
        });
        await User.findByIdAndUpdate(targetUserId, {
          $addToSet: { matches: currentUserId },
          $inc: { matchesCount: 1 },
        });

        // Notify BOTH users of the new match via socket
        try {
          const io = getIO();
          const currentUserPhoto = currentUser.photos?.find(p => p.isProfile)?.url || currentUser.photos?.[0]?.url;
          const targetUserPhoto  = targetUser.photos?.find(p => p.isProfile)?.url  || targetUser.photos?.[0]?.url;

          // Tell the current user about the match
          io.to(currentUserId.toString()).emit('new_match', {
            matchId: match._id,
            matchedUser: {
              _id: targetUser._id,
              firstName: targetUser.firstName,
              profilePhoto: targetUserPhoto,
            },
          });

          // Tell the OTHER user about the match
          io.to(targetUserId.toString()).emit('new_match', {
            matchId: match._id,
            matchedUser: {
              _id: currentUser._id,
              firstName: currentUser.firstName,
              profilePhoto: currentUserPhoto,
            },
          });
        } catch (socketErr) {
          // Socket may not be active, non-fatal
        }

        return res.json({
          matched: true,
          matchId: match._id,
          message: "It's a match! 🎉",
          matchedUser: {
            _id: targetUser._id,
            firstName: targetUser.firstName,
            profilePhoto: targetUser.photos.find(p => p.isProfile)?.url || targetUser.photos[0]?.url,
          },
        });
      }
    }

    // Notify target user via socket that they received a like
    try {
      const io = getIO();
      const profilePhoto = currentUser.photos?.find(p => p.isProfile)?.url || currentUser.photos?.[0]?.url;
      io.to(targetUserId.toString()).emit('like_received', {
        fromUserId: currentUserId.toString(),
        fromUserName: currentUser.firstName,
        fromUserPhoto: profilePhoto,
        message: `${currentUser.firstName} liked your profile! 👍`,
      });
    } catch (socketErr) {
      // Socket may not be active, non-fatal
    }

    res.json({ matched: false, message: 'Liked!' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Already swiped on this user' });
    }
    res.status(500).json({ error: error.message });
  }
};

// @desc    Skip a user
// @route   POST /api/discover/skip
// @access  Private
const skipUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    await Swipe.create({ swiper: req.user._id, swiped: targetUserId, action: 'skip' });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { skips: targetUserId } });
    res.json({ message: 'Skipped' });
  } catch (error) {
    if (error.code === 11000) return res.json({ message: 'Already swiped' });
    res.status(500).json({ error: error.message });
  }
};

// @desc    Super Like a user
// @route   POST /api/discover/superlike
// @access  Private
const superLikeUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    await Swipe.create({ swiper: currentUserId, swiped: targetUserId, action: 'superlike' });

    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { superLikes: targetUserId, likes: targetUserId },
    });
    await User.findByIdAndUpdate(targetUserId, {
      $addToSet: { likedBy: currentUserId },
      $inc: { likesReceived: 1 },
    });

    res.json({ message: 'Super Liked! ⭐' });
  } catch (error) {
    if (error.code === 11000) return res.json({ message: 'Already swiped' });
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getDiscoverProfiles, likeUser, skipUser, superLikeUser };
