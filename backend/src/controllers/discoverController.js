const User = require('../models/User');
const { Match, Swipe } = require('../models/Match');
const { Trip } = require('../models/Trip');
const Notification = require('../models/Notification');

/**
 * Helper to handle match creation and notifications
 */
const handleMatch = async (userId1, userId2, isSuperLike = false) => {
  try {
    const existingMatch = await Match.findOne({
      users: { $all: [userId1, userId2] },
    });

  if (existingMatch) return existingMatch;

  const match = await Match.create({
    users: [userId1, userId2],
    isSuperLike,
  });

    // Update both users and fetch names
    const [user1, user2] = await Promise.all([
      User.findByIdAndUpdate(userId1, {
        $addToSet: { matches: userId2 },
        $pull: { likedBy: userId2 },
        $inc: { matchesCount: 1, likesReceived: -1 },
      }, { new: true }),
      User.findByIdAndUpdate(userId2, {
        $addToSet: { matches: userId1 },
        $pull: { likedBy: userId1 },
        $inc: { matchesCount: 1, likesReceived: -1 },
      }, { new: true })
    ]);

    // ✅ NEW: USE CENTRALIZED NOTIFICATION HUB
    const { createNotification } = require('../utils/notificationService');
    
    await Promise.all([
      createNotification({
        recipient: userId1,
        sender: userId2,
        type: 'match',
        title: "It's a Match! 🎉",
        message: `You and ${user2?.firstName || 'someone'} matched! Start chatting!`,
        data: { matchId: match._id, userId: userId2 }
      }),
      createNotification({
        recipient: userId2,
        sender: userId1,
        type: 'match',
        title: "It's a Match! 🎉",
        message: `You and ${user1?.firstName || 'someone'} matched! Start chatting!`,
        data: { matchId: match._id, userId: userId1 }
      })
    ]);

  } catch (err) {
    console.error('[SOCKET MATCH NOTIFY ERROR]', err);
  }

  return match;
};

/**
 * Helper: Calculate matching score based on priority
 */
const calculateMatchingScore = (user, currentUser) => {
  let score = 0;

  // Priority 1 & 2: Same Destination (+50)
  if (user.destination?.city && currentUser.destination?.city && 
      user.destination.city.toLowerCase() === currentUser.destination.city.toLowerCase()) {
    score += 50;

    // Priority 1: Same Travel Date (+30)
    if (user.travelDate && currentUser.travelDate) {
      const d1 = new Date(user.travelDate).toISOString().split('T')[0];
      const d2 = new Date(currentUser.travelDate).toISOString().split('T')[0];
      if (d1 === d2) score += 30;
    }
  } else if (user.destination?.location?.coordinates && currentUser.destination?.location?.coordinates) {
    // Priority 3: Nearby Destination (50-100km) (+20)
    const dist = calculateDistance(
      user.destination.location.coordinates[1],
      user.destination.location.coordinates[0],
      currentUser.destination.location.coordinates[1],
      currentUser.destination.location.coordinates[0]
    );
    if (dist <= 100) score += 20;
  }

  // Priority 4: Same Route (Origin + Destination) (+25)
  if (user.origin?.city && currentUser.origin?.city && 
      user.origin.city.toLowerCase() === currentUser.origin.city.toLowerCase()) {
    score += 25;
  }

  // Priority 5: Shared Interests (+10 each)
  const commonInterests = user.interests.filter(i => currentUser.interests.includes(i));
  score += commonInterests.length * 10;

  return score;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// @desc    Get discoverable users (location-based + filters)
// @route   GET /api/discover or /api/nearby-users
// @access  Private
const getDiscoverProfiles = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const maxDistance = currentUser.maxDiscoveryDistance || 200; // km
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let reqLat = parseFloat(req.query.lat);
    let reqLng = parseFloat(req.query.lng);
    const searchCity = req.query.searchCity; // String city search
    const isTravelBuddySearch = req.query.travelBuddy === 'true' || !!searchCity;

    const isMapMode = req.query.mode === 'map';
    const swipedUsers = await Swipe.find({ swiper: req.user._id }).select('swiped');
    const swipedIds = swipedUsers.map(s => s.swiped);

    const excludeIds = isMapMode ? [
      req.user._id,
      ...(currentUser.blockedUsers || []),
    ] : [
      req.user._id,
      ...swipedIds,
      ...(currentUser.blockedUsers || []),
      ...(currentUser.matches || []),
    ];

    // Determine center coordinates
    const validReqCoords = !isNaN(reqLat) && !isNaN(reqLng) && reqLat !== 0;
    
    // 📍 FALLBACK LOGIC: If no GPS, try user's saved location coordinates
    let activeLng = validReqCoords ? reqLng : currentUser.location?.coordinates?.[0];
    let activeLat = validReqCoords ? reqLat : currentUser.location?.coordinates?.[1];

    // If still no coordinates, we can't use $geoNear, we use $match
    const useGeo = !!(activeLng && activeLat && activeLng !== 0);

    const pipeline = [];

    // 1. Initial Match (Common across both branches)
    const baseMatch = {
      _id: { $nin: excludeIds },
      isActive: { $ne: false },
      isDeleted: { $ne: true },
      visibilityStatus: { $ne: 'ghost' },
      ...(isMapMode ? {} : { 'photos.0': { $exists: true } }),
    };

    // 2. Location/Search Core
    if (useGeo && !searchCity) {
      // PROXIMITY MODE
      const discoveryRadiusMet = (isMapMode ? Math.max(maxDistance, 100) : maxDistance) * 1000;
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [activeLng, activeLat] },
          distanceField: 'distanceMet',
          maxDistance: discoveryRadiusMet,
          query: baseMatch,
          spherical: true,
        },
      });
    } else {
      // SEARCH MODE (Travel Buddies) or FALLBACK
      const searchMatch = { ...baseMatch };
      
      if (searchCity) {
        // If searching for travel buddies, match destination city
        searchMatch.$or = [
            { 'destination.city': { $regex: searchCity, $options: 'i' } },
            { 'city': { $regex: searchCity, $options: 'i' } }
        ];
      } else if (currentUser.city) {
        // Fallback to hometown city if no GPS
        searchMatch.city = { $regex: currentUser.city, $options: 'i' };
      }

      pipeline.push({ $match: searchMatch });
      pipeline.push({ $addFields: { distanceMet: { $literal: 0 } } }); // Dummy for consistency
    }

    // 3. Sorting & Pagination
    pipeline.push(
      { $sort: { lastSeen: -1, _id: 1 } }, // Stable sort prevents duplicates in pagination
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          firstName: 1, lastName: 1, username: 1, age: 1, gender: 1,
          bio: 1, photos: 1, interests: 1, languages: 1, lookingFor: 1,
          isPhotoVerified: 1, location: 1, distanceMet: 1,
          isOnline: 1, lastSeen: 1, activityStatus: 1,
          origin: 1, destination: 1, travelDate: 1,
          city: 1, country: 1,
        },
      }
    );

    const profiles = await User.aggregate(pipeline);
    const totalCount = await User.countDocuments(pipeline[0]?.$geoNear ? pipeline[0].$geoNear.query : (pipeline[0]?.$match || {}));

    const enriched = profiles.map(p => {
      const matchScore = calculateMatchingScore(p, currentUser);
      const profilePhoto = p.photos?.find(photo => photo.isProfile)?.url || p.photos?.[0]?.url || null;
      return {
        ...p,
        profilePhoto,
        distanceKm: Math.round(p.distanceMet / 1000),
        matchScore
      };
    });

    // Sort by match score descending OR distance ascending
    if (req.query.sortBy === 'distance') {
      enriched.sort((a, b) => a.distanceMet - b.distanceMet);
    } else {
      enriched.sort((a, b) => b.matchScore - a.matchScore);
    }

    res.json({ 
        profiles: enriched, 
        count: enriched.length, 
        total: totalCount,
        page,
        hasMore: enriched.length === limit 
    });

    // 📍 NEARBY TRAVELERS NOTIFICATION (Engagement)
    // Only notify if we found a good number of users
    if (enriched.length >= 5) {
      try {
        // Find if we already sent a nearby notification recently (last 6 hours)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const recentNote = await Notification.findOne({
          recipient: req.user._id,
          type: 'nearby_travelers',
          createdAt: { $gte: sixHoursAgo }
        });

        if (!recentNote) {
          const newNote = await Notification.create({
            recipient: req.user._id,
            sender: req.user._id, // System/Self-triggered
            type: 'nearby_travelers',
            message: `🎒 ${enriched.length} new travelers are near you! Check them out in Discovery.`,
            title: 'New Travelers Nearby'
          });

          const populatedNote = await Notification.findById(newNote._id).populate('sender', 'firstName lastName photos');
          const { getIO } = require('../socket/socketHandler');
          const io = getIO();
          io.to(req.user._id.toString()).emit('new_notification', populatedNote);
        }

        // 📈 TRENDING TRIPS NOTIFICATION
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentTrending = await Notification.findOne({
          recipient: req.user._id,
          type: 'trending_trip',
          createdAt: { $gte: dayAgo }
        });

        if (!recentTrending) {
          const topTrips = await Trip.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: "$destination.city", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
          ]);

          if (topTrips.length > 0) {
            const city = topTrips[0]._id;
            const newTrending = await Notification.create({
              recipient: req.user._id,
              sender: req.user._id,
              type: 'trending_trip',
              message: `🔥 ${city} trips are trending right now! Plan your journey today.`,
              title: 'Trending Trips'
            });

            const populatedTrending = await Notification.findById(newTrending._id).populate('sender', 'firstName lastName photos');
            const { getIO } = require('../socket/socketHandler');
            const io = getIO();
            io.to(req.user._id.toString()).emit('new_notification', populatedTrending);
          }
        }
      } catch (err) {
        console.error('Engagement notification error:', err);
      }
    }

    // No second res.json here! It was already sent at line 238 after enriching profiles.
  } catch (error) {
    console.error('Discover error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
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

    // ✅ FIX 2: currentUser was never fetched here.
    // The socket emit below used currentUser.firstName and currentUser.photos,
    // which would throw "currentUser is not defined" and crash silently,
    // meaning like notifications and match events were never actually sent.
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Record or Update the swipe
    await Swipe.findOneAndUpdate(
      { swiper: currentUserId, swiped: targetUserId },
      { action: 'like' },
      { upsert: true, new: true }
    );

    // Update arrays
    await Promise.all([
      User.findByIdAndUpdate(currentUserId, { $addToSet: { likes: targetUserId }, $pull: { skips: targetUserId } }),
      User.findByIdAndUpdate(targetUserId, { $addToSet: { likedBy: currentUserId }, $inc: { likesReceived: 1 } })
    ]);

    // Check for mutual like (match!)
    const targetUser = await User.findById(targetUserId);
    const isMatchedByOther = targetUser.likes.some(id => id.toString() === currentUserId.toString()) ||
                             targetUser.superLikes.some(id => id.toString() === currentUserId.toString());

    if (isMatchedByOther) {
      const match = await handleMatch(currentUserId, targetUserId);
      return res.json({
        matched: true,
        matchId: match._id,
        message: "It's a match! 🎉",
        matchedUser: {
          _id: targetUser._id,
          firstName: targetUser.firstName,
          profilePhoto: targetUser.photos?.find(p => p.isProfile)?.url || targetUser.photos?.[0]?.url,
        },
      });
    }

    // ✅ NEW: USE CENTRALIZED NOTIFICATION HUB
    try {
      const { createNotification } = require('../utils/notificationService');
      await createNotification({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'like',
        title: 'New Like! 👍',
        message: `${currentUser.firstName} liked your profile!`,
        data: { fromUserId: currentUserId.toString() }
      });
    } catch (socketErr) {
      console.error('[LIKE NOTIFICATION HUB ERROR]', socketErr);
    }

    // ✅ ADDED: Send final response to client so app doesn't hang!
    res.json({ success: true, matched: false, message: 'Like sent!' });

  } catch (error) {

    if (error.code === 11000) {
      // Gracefully handle "Already liked/swiped" — return success for UX
      return res.json({ matched: false, message: 'Already liked!' });
    }
    console.error('[LIKE ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Skip a user
// @route   POST /api/discover/skip
// @access  Private
const skipUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user._id;

    // Record or update swipe
    await Swipe.findOneAndUpdate(
      { swiper: currentUserId, swiped: targetUserId },
      { action: 'skip' },
      { upsert: true }
    );

    // Check if they WERE in likedBy before pulling
    const userBeforeUpdate = await User.findById(currentUserId).select('likedBy');
    const wasLiker = userBeforeUpdate.likedBy.some(id => id.toString() === targetUserId);

    // Update user: remove from likedBy if present, add to skips
    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { skips: targetUserId },
      $pull: { likedBy: targetUserId },
      ...(wasLiker ? { $inc: { likesReceived: -1 } } : {})
    });

    res.json({ message: 'Skipped' });
  } catch (error) {
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

    // ✅ FETCH CURRENT USER for notifications
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Record swipe
    await Swipe.findOneAndUpdate(
      { swiper: currentUserId, swiped: targetUserId },
      { action: 'superlike' },
      { upsert: true }
    );

    await Promise.all([
      User.findByIdAndUpdate(currentUserId, {
        $addToSet: { superLikes: targetUserId, likes: targetUserId },
        $pull: { skips: targetUserId }
      }),
      User.findByIdAndUpdate(targetUserId, {
        $addToSet: { likedBy: currentUserId },
        $inc: { likesReceived: 1 },
      })
    ]);

    // Check for mutual
    const targetUser = await User.findById(targetUserId);
    const isMatchedByOther = targetUser.likes.some(id => id.toString() === currentUserId.toString()) ||
                             targetUser.superLikes.some(id => id.toString() === currentUserId.toString());

    if (isMatchedByOther) {
      const match = await handleMatch(currentUserId, targetUserId, true);
      return res.json({
        matched: true,
        matchId: match._id,
        message: "It's a match! ⭐",
        matchedUser: {
          _id: targetUser._id,
          firstName: targetUser.firstName,
          profilePhoto: targetUser.photos?.find(p => p.isProfile)?.url || targetUser.photos?.[0]?.url,
        },
      });
    }

    // ✅ NEW: USE CENTRALIZED NOTIFICATION HUB
    try {
      const { createNotification } = require('../utils/notificationService');
      await createNotification({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'superlike',
        title: 'New Super Like! ⭐',
        message: `${currentUser.firstName} super liked you!`,
        data: { matchId: null }
      });
    } catch (e) {
      console.error('[SUPERLIKE NOTIFICATION HUB ERROR]', e);
    }

    res.json({ success: true, message: 'Super Liked! ⭐' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update user location
// @route   POST /api/discover/location
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      location: { type: 'Point', coordinates: [lng, lat] }
    });
    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  getDiscoverProfiles, 
  likeUser, 
  skipUser, 
  superLikeUser,
  updateLocation
};