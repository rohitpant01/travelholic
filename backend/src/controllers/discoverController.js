const User = require('../models/User');
const { Match, Swipe } = require('../models/Match');
const { Trip } = require('../models/Trip');
const Notification = require('../models/Notification');

/**
 * Helper to handle match creation and notifications
 */
const handleMatch = async (userId1, userId2, isSuperLike = false) => {
  const existingMatch = await Match.findOne({
    users: { $all: [userId1, userId2] },
  });

  if (existingMatch) return existingMatch;

  const match = await Match.create({
    users: [userId1, userId2],
    isSuperLike,
  });

  // Update both users
  await Promise.all([
    User.findByIdAndUpdate(userId1, {
      $addToSet: { matches: userId2 },
      $pull: { likedBy: userId2 },
      $inc: { matchesCount: 1, likesReceived: -1 },
    }),
    User.findByIdAndUpdate(userId2, {
      $addToSet: { matches: userId1 },
      $pull: { likedBy: userId1 },
      $inc: { matchesCount: 1, likesReceived: -1 },
    })
  ]);

  // Notify both users via socket
  try {
    const { getIO } = require('../socket/socketHandler');
    const io = getIO();
    const [user1, user2] = await Promise.all([
      User.findById(userId1).select('firstName photos'),
      User.findById(userId2).select('firstName photos')
    ]);

    const user1Photo = user1.photos?.find(p => p.isProfile)?.url || user1.photos?.[0]?.url;
    const user2Photo = user2.photos?.find(p => p.isProfile)?.url || user2.photos?.[0]?.url;

    io.to(userId1.toString()).emit('new_match', {
      matchId: match._id,
      matchedUser: { _id: user2._id, firstName: user2.firstName, profilePhoto: user2Photo },
    });

    io.to(userId2.toString()).emit('new_match', {
      matchId: match._id,
      matchedUser: { _id: user1._id, firstName: user1.firstName, profilePhoto: user1Photo },
    });
    // Check if the other user is online before sending push
    const otherUserSocketRooms = io.sockets.adapter.rooms.get(userId2.toString());
    const isOtherOnline = otherUserSocketRooms && otherUserSocketRooms.size > 0;

    if (!isOtherOnline && user2.pushToken) {
      const { sendPushNotification } = require('../utils/pushNotification');
      sendPushNotification(
        user2.pushToken,
        "It's a Match! 🎉",
        `You and ${user1.firstName} matched!`,
        { 
          type: 'match', 
          matchId: match._id,
          userId: userId1.toString(),
          fromUserName: user1.firstName,
          fromUserPhoto: user1Photo
        }
      );
    }

    // ✅ PERSISTENT NOTIFICATION: Create for both
    await Notification.insertMany([
      {
        recipient: userId1,
        sender: userId2,
        type: 'match',
        message: `It's a match! You and ${user2.firstName} matched! 🎉`,
        data: { matchId: match._id, userId: userId2 }
      },
      {
        recipient: userId2,
        sender: userId1,
        type: 'match',
        message: `It's a match! You and ${user1.firstName} matched! 🎉`,
        data: { matchId: match._id, userId: userId1 }
      }
    ]);

    // Emit live unread count update
    io.to(userId1.toString()).emit('new_notification', { unreadCount: await Notification.countDocuments({ recipient: userId1, isRead: false }) });
    io.to(userId2.toString()).emit('new_notification', { unreadCount: await Notification.countDocuments({ recipient: userId2, isRead: false }) });

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
    const maxDistance = currentUser.maxDiscoveryDistance || 50; // km
    let reqLat = parseFloat(req.query.lat);
    let reqLng = parseFloat(req.query.lng);

    const isMapMode = req.query.mode === 'map';
    const swipedUsers = await Swipe.find({ swiper: req.user._id }).select('swiped');
    const swipedIds = swipedUsers.map(s => s.swiped);

    // 📍 STRATEGY: In map mode, we want to see EVERYONE nearly, even matched/swiped users,
    // to make the community feel alive. We only exclude self and blocked.
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
    const validReqCoords = !isNaN(reqLat) && !isNaN(reqLng);
    const activeLng = validReqCoords ? reqLng : currentUser.location?.coordinates?.[0];
    const activeLat = validReqCoords ? reqLat : currentUser.location?.coordinates?.[1];

    if (!activeLng || !activeLat || activeLng === 0) {
      return res.json({ profiles: [], count: 0, message: 'Location required' });
    }

    // 📍 RADIUS: Relax for map mode to show more people (up to 100km)
    const discoveryRadiusMet = (isMapMode ? Math.max(maxDistance, 100) : maxDistance) * 1000;

    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [activeLng, activeLat] },
          distanceField: 'distanceMet',
          maxDistance: discoveryRadiusMet,
          query: {
            _id: { $nin: excludeIds },
            isActive: { $ne: false },
            isDeleted: { $ne: true },
            visibilityStatus: { $ne: 'ghost' },
            // In map mode, allow users with NO photos to appear (with placeholder)
            ...(isMapMode ? {} : { 'photos.0': { $exists: true } }),
          },
          spherical: true,
        },
      },
      { $limit: 100 },
      {
        $project: {
          firstName: 1, lastName: 1, username: 1, age: 1, gender: 1,
          bio: 1, photos: 1, interests: 1, languages: 1, lookingFor: 1,
          isPhotoVerified: 1, location: 1, distanceMet: 1,
          isOnline: 1, lastSeen: 1, activityStatus: 1,
          origin: 1, destination: 1, travelDate: 1,
          city: 1, country: 1,
        },
      },
    ];

    const profiles = await User.aggregate(pipeline);

    const enriched = profiles.map(p => {
      const matchScore = calculateMatchingScore(p, currentUser);
      return {
        ...p,
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

    // Not a match — notify target they received a like via socket
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      const profilePhoto = currentUser.photos?.find(p => p.isProfile)?.url || currentUser.photos?.[0]?.url;
      io.to(targetUserId.toString()).emit('like_received', {
        fromUserId: currentUserId.toString(),
        fromUserName: currentUser.firstName,
        fromUserPhoto: profilePhoto,
        message: `${currentUser.firstName} liked your profile! 👍`,
      });

      // Send Push Notification if target is offline
      const targetSocketRooms = io.sockets.adapter.rooms.get(targetUserId.toString());
      const isTargetOnline = targetSocketRooms && targetSocketRooms.size > 0;
      
      if (!isTargetOnline && targetUser && targetUser.pushToken) {
        const { sendPushNotification } = require('../utils/pushNotification');
        sendPushNotification(
          targetUser.pushToken,
          "New Like! 👍",
          `${currentUser.firstName} liked your profile!`,
          { 
            type: 'like', 
            fromUserId: currentUserId.toString(),
            fromUserName: currentUser.firstName,
            fromUserPhoto: profilePhoto
          }
        );
      }

      // ✅ PERSISTENT NOTIFICATION: Create in DB
      await Notification.create({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'like',
        message: `${currentUser.firstName} liked your profile! 👍`
      });

      // Emit live unread count update
      const unreadCount = await Notification.countDocuments({ recipient: targetUserId, isRead: false });
      io.to(targetUserId.toString()).emit('new_notification', { unreadCount });

    } catch (socketErr) {
      // Socket may not be active, non-fatal
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

    // Not a match — notify target via socket
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      const profilePhoto = currentUser.photos?.find(p => p.isProfile)?.url || currentUser.photos?.[0]?.url;
      
      io.to(targetUserId.toString()).emit('superlike_received', {
        fromUserId: currentUserId.toString(),
        fromUserName: currentUser.firstName,
        fromUserPhoto: profilePhoto,
        message: `⭐ ${currentUser.firstName} SUPER LIKED you!`,
      });

      // Persistent Notification
      await Notification.create({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'superlike', 
        title: 'New Super Like! ⭐',
        message: `${currentUser.firstName} super liked you!`,
        data: { matchId: null }
      });

      // Push Notification
      if (targetUser && targetUser.pushToken) {
        const { sendPushNotification } = require('../utils/pushNotification');
        sendPushNotification(
          targetUser.pushToken,
          "New Super Like! ⭐",
          `${currentUser.firstName} super liked you!`,
          { type: 'superlike', fromUserId: currentUserId.toString() }
        );
      }
    } catch (e) {
      console.error('[SUPERLIKE NOTIFICATION ERROR]', e);
    }

    res.json({ success: true, message: 'Super Liked! ⭐' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  getDiscoverProfiles, 
  likeUser, 
  skipUser, 
  superLikeUser
};