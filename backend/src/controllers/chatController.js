const { Match, Message } = require('../models/Match');
const User = require('../models/User');

// Helper to calculate distance in KM using Haversine formula
const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// ============================================================
// MATCH CONTROLLER
// ============================================================

// @desc    Get all matches
// @route   GET /api/matches
// @access  Private
const getMatches = async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user._id,
      isActive: true,
    })
      .populate('users', 'firstName lastName photos isPhotoVerified isOnline lastSeen location age city country')
      .sort({ 'lastMessage.sentAt': -1, matchedAt: -1 });

    const currentUser = await User.findById(req.user._id).select('location');
    const userCoords = currentUser?.location?.coordinates; // [lng, lat]

    const enrichedPromises = matches.map(async (match) => {
      const otherUser = match.users.find(u => u._id.toString() !== req.user._id.toString());
      const profilePhoto = otherUser?.photos?.find(p => p.isProfile)?.url || otherUser?.photos?.[0]?.url;
      
      const unreadCount = await Message.countDocuments({
        matchId: match._id,
        receiver: req.user._id,
        isRead: false
      });

      let distanceKm = null;
      if (userCoords && otherUser?.location?.coordinates) {
        distanceKm = getDistance(
          userCoords[1], userCoords[0],
          otherUser.location.coordinates[1], otherUser.location.coordinates[0]
        );
      }

      return {
        matchId: match._id,
        user: {
          _id: otherUser?._id,
          firstName: otherUser?.firstName,
          lastName: otherUser?.lastName,
          profilePhoto,
          isOnline: otherUser?.isOnline,
          lastSeen: otherUser?.lastSeen,
          age: otherUser?.age,
          city: otherUser?.city || otherUser?.location?.city || 'Unknown',
          country: otherUser?.country || otherUser?.location?.country || '',
          isPhotoVerified: otherUser?.isPhotoVerified,
        },
        lastMessage: match.lastMessage,
        unreadCount,
        distanceKm,
        matchedAt: match.matchedAt,
      };
    });

    const enriched = await Promise.all(enrichedPromises);

    res.json({ matches: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// CHAT CONTROLLER
// ============================================================

// @desc    Get messages for a match
// @route   GET /api/chat/:matchId/messages
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { matchId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 30;

    // Verify user is in this match
    const match = await Match.findOne({
      _id: matchId,
      users: req.user._id,
    });
    if (!match) return res.status(403).json({ error: 'Not authorized to view this chat' });

    const messages = await Message.find({ matchId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'firstName photos');

    // Mark messages as read
    await Message.updateMany(
      { matchId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ messages: messages.reverse(), page, hasMore: messages.length === limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/chat/:matchId/send
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { text } = req.body;

    const match = await Match.findOne({ _id: matchId, users: req.user._id });
    if (!match) return res.status(403).json({ error: 'Not authorized' });

    const receiverId = match.users.find(u => u.toString() !== req.user._id.toString());

    const messageData = {
      matchId,
      sender: req.user._id,
      receiver: receiverId,
      type: req.file ? 'image' : 'text',
    };

    if (req.file) {
      messageData.imageUrl = req.file.path;
      messageData.imagePublicId = req.file.filename;
    } else {
      messageData.text = text;
    }

    const message = await Message.create(messageData);
    await message.populate('sender', 'firstName photos');

    // Update match's last message
    await Match.findByIdAndUpdate(matchId, {
      lastMessage: {
        text: req.file ? '📷 Photo' : text,
        sentAt: new Date(),
        sentBy: req.user._id,
      },
    });

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Unmatch
// @route   DELETE /api/matches/:matchId
// @access  Private
const unmatch = async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    match.isActive = false;
    await match.save();

    // Remove from users' matches
    const otherUser = match.users.find(u => u.toString() !== req.user._id.toString());
    await User.findByIdAndUpdate(req.user._id, { $pull: { matches: otherUser } });
    await User.findByIdAndUpdate(otherUser, { $pull: { matches: req.user._id } });

    res.json({ message: 'Unmatched' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getMatches, getMessages, sendMessage, unmatch };
