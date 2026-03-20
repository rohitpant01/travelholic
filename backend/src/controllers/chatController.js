const { Match, Message } = require('../models/Match');
const { TripMember } = require('../models/Trip');
const User = require('../models/User');
const { getIO } = require('../socket/socketHandler');

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
      .populate('users', 'firstName lastName photos isPhotoVerified isOnline activityStatus lastSeen location age city country origin destination travelDate')
      .sort({ 'lastMessage.sentAt': -1, matchedAt: -1 });

    const currentUser = await User.findById(req.user._id).select('location');
    const userCoords = currentUser?.location?.coordinates; // [lng, lat]

    const enrichedPromises = matches.map(async (match) => {
      const otherUser = match.users.find(u => u._id.toString() !== req.user._id.toString());
      const profilePhoto = otherUser?.photos?.find(p => p.isProfile)?.url || otherUser?.photos?.[0]?.url;
      
      // Use persisted unreadCounts Map — O(1) vs expensive message count query
      const myUserId = req.user._id.toString();
      const unreadCount = match.unreadCounts?.get
        ? (match.unreadCounts.get(myUserId) || 0)
        : (match.unreadCounts?.[myUserId] || 0);

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
          activityStatus: otherUser?.activityStatus,
          lastSeen: otherUser?.lastSeen,
          age: otherUser?.age,
          city: otherUser?.city || otherUser?.location?.city || 'Unknown',
          country: otherUser?.country || otherUser?.location?.country || '',
          isPhotoVerified: otherUser?.isPhotoVerified,
          origin: otherUser?.origin,
          destination: otherUser?.destination,
          travelDate: otherUser?.travelDate,
        },
        lastMessage: match.lastMessage,
        unreadCount,
        distanceKm,
        matchedAt: match.matchedAt,
        pinned: match.pinnedBy?.some(id => id.toString() === req.user._id.toString()) || false,
        muted: match.mutedBy?.some(id => id.toString() === req.user._id.toString()) || false,
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

    // Mark messages as read BEFORE fetching to ensure correct status in response
    await Message.updateMany(
      { matchId, receiver: req.user._id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    const messages = await Message.find({ matchId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'firstName photos')
      .populate({ path: 'replyTo', select: 'text imageUrl type sender' });

    const formattedMessages = messages.reverse().map(msg => {
      const obj = msg.toObject();
      obj.chatId = obj.matchId;
      return obj;
    });

    res.json({ messages: formattedMessages, page, hasMore: messages.length === limit });
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
    const { text, replyTo, type } = req.body;

    const match = await Match.findOne({ _id: matchId, users: req.user._id });
    if (!match) return res.status(403).json({ error: 'Not authorized' });

    const receiverId = match.users.find(u => u.toString() !== req.user._id.toString());
    if (!receiverId) {
      console.error('❌ [SEND_MESSAGE] Receiver not found in match users:', match.users);
      return res.status(400).json({ error: 'Receiver not found' });
    }

    const isVoiceRoute = req.url.includes('send-voice');
    const messageData = {
      matchId,
      sender: req.user._id,
      receiver: receiverId,
      type: type || 'text',
    };

    const uploadedFile = req.files?.file?.[0] || req.file;
    const uploadedAudio = req.files?.audio?.[0];

    if (uploadedAudio) {
      messageData.type = 'voice';
      messageData.voiceUrl = uploadedAudio.path;
      messageData.voicePublicId = uploadedAudio.filename;
    } else if (uploadedFile) {
      messageData.type = 'image';
      messageData.imageUrl = uploadedFile.path;
      messageData.imagePublicId = uploadedFile.filename;
    } else {
      messageData.text = text;
    }

    if (replyTo) messageData.replyTo = replyTo;

    const message = await Message.create(messageData);
    await message.populate([
      { path: 'sender', select: 'firstName photos' },
      { path: 'replyTo', select: 'text imageUrl type sender' }
    ]);

    const formattedMessage = { ...message.toObject(), chatId: message.matchId };

    // Update match's last message
    let lastMsgText = text;
    if (messageData.type === 'image') lastMsgText = '📷 Photo';
    if (messageData.type === 'voice') lastMsgText = '🎤 Voice message';

    await Match.findByIdAndUpdate(matchId, {
      lastMessage: {
        text: lastMsgText,
        sentAt: new Date(),
        sentBy: req.user._id,
      },
    });

    // --- REAL-TIME BROADCAST ---
    try {
      const io = getIO();
      // Wait, unified socket!
      io.to(`match_${matchId}`).emit('receive_message', formattedMessage);

      // 2. Notify BOTH participants personally for global list sync / background updates
      const participants = [req.user._id.toString(), receiverId.toString()];
      const senderProfilePhoto = req.user.photos?.find(p => p.isProfile)?.url || req.user.photos?.[0]?.url;

      for (const pid of participants) {
        const isReceiver = pid === receiverId.toString();
        const unreadCount = isReceiver ? await Message.countDocuments({
          matchId,
          receiver: receiverId,
          readBy: { $ne: receiverId }
        }) : 0;

        io.to(pid).emit('receive_message', {
          ...formattedMessage,
          senderName: req.user.firstName,
          senderPhoto: senderProfilePhoto,
          unreadCount,
        });
      }
    } catch (socketErr) {
      console.warn('⚠️ [SOCKET ERROR] Broadcast failed:', socketErr.message);
    }

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error('❌ [SEND_MESSAGE ERROR]:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Edit a message
// @route   PATCH /api/chat/message/:messageId
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    const message = await Message.findOne({ _id: messageId, sender: req.user._id });
    if (!message) return res.status(404).json({ error: 'Message not found or not authorized' });

    message.text = text;
    message.edited = true;
    await message.save();
    
    await message.populate('sender', 'firstName photos');

    const formattedMessage = { ...message.toObject(), chatId: message.matchId };

    // Broadcast update
    try {
      const io = getIO();
      io.to(`match_${message.matchId}`).emit('message_edited', formattedMessage);
    } catch (e) {}

    res.json({ message: formattedMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a message (Soft Delete)
// @route   DELETE /api/chat/message/:messageId
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOne({ _id: messageId, sender: req.user._id });
    if (!message) return res.status(404).json({ error: 'Message not found or not authorized' });

    message.isDeleted = true;
    message.text = 'This message was deleted';
    message.imageUrl = null;
    message.voiceUrl = null;
    await message.save();

    // Broadcast delete
    try {
      const io = getIO();
      io.to(`match_${message.matchId}`).emit('message_deleted', { 
        messageId: message._id, 
        matchId: message.matchId 
      });
    } catch (e) {}

    res.json({ message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    React to a message
// @route   POST /api/chat/message/:messageId/react
const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body; // emoji string or null to remove

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Remove existing reaction by this user
    message.reactions = message.reactions.filter(r => r.user.toString() !== req.user._id.toString());

    // Add new reaction if emoji provided
    if (emoji) {
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();
    
    // Broadcast reaction
    try {
      const io = getIO();
      io.to(`match_${message.matchId}`).emit('message_reacted', { 
        messageId: message._id, 
        reactions: message.reactions,
        matchId: message.matchId 
      });
    } catch (e) {}

    res.json({ reactions: message.reactions });
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

// @desc    Get total unread count for user
// @route   GET /api/chat/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const [privateCount, groupCountData] = await Promise.all([
      Message.countDocuments({
        receiver: req.user._id,
        readBy: { $ne: req.user._id }
      }),
      TripMember.aggregate([
        { $match: { user: req.user._id, status: 'accepted' } },
        { $group: { _id: null, total: { $sum: '$unreadCount' } } }
      ])
    ]);
    
    const total = privateCount + (groupCountData[0]?.total || 0);
    res.json({ count: total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Toggle pin match
// @route   POST /api/chat/:matchId/pin
const togglePinMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id;
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const isPinned = match.pinnedBy.includes(userId);
    if (isPinned) {
      match.pinnedBy = match.pinnedBy.filter(id => id.toString() !== userId.toString());
    } else {
      match.pinnedBy.push(userId);
    }
    await match.save();
    res.json({ pinned: !isPinned });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Toggle mute match
// @route   POST /api/chat/:matchId/mute
const toggleMuteMatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id;
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const isMuted = match.mutedBy.includes(userId);
    if (isMuted) {
      match.mutedBy = match.mutedBy.filter(id => id.toString() !== userId.toString());
    } else {
      match.mutedBy.push(userId);
    }
    await match.save();
    res.json({ muted: !isMuted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Reset unread count for a match (call when user opens chat)
// @route   PUT /api/chat/:matchId/read
// @access  Private
const resetUnreadCount = async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id.toString();
    
    await Match.findByIdAndUpdate(matchId, {
      $set: { [`unreadCounts.${userId}`]: 0 },
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getMatches,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  unmatch,
  getUnreadCount,
  togglePinMatch,
  toggleMuteMatch,
  resetUnreadCount,
};
