const { Trip, TripMember, TripMessage } = require('../models/Trip');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const LyraItinerary = require('../models/LyraItinerary');
const AIItinerary = require('../models/AIItinerary');

// ============================================================
// CREATE TRIP
// ============================================================
const createTrip = async (req, res) => {
  try {
    const {
      source, destination, date, endDate, mode,
      budget, travelType, tags, maxTravelers,
      description, genderPreference, name
    } = req.body;

    if (!source?.city || !destination?.city || !date || !endDate) {
      return res.status(400).json({ error: 'Source, destination, start date, and return date are all required' });
    }

    const trip = await Trip.create({
      creator: req.user._id,
      name: name || `${source.city} → ${destination.city}`,
      source: {
        city: source.city,
        location: source.location || { type: 'Point', coordinates: [0, 0] },
      },
      destination: {
        city: destination.city,
        location: destination.location || { type: 'Point', coordinates: [0, 0] },
      },
      date,
      endDate,
      mode: mode || 'other',
      budget: budget || 'Budget',
      travelType: travelType || 'Group',
      tags: tags || [],
      maxTravelers: maxTravelers || 10,
      description: description || '',
      genderPreference: genderPreference || 'Any',
    });

    // Creator auto-joins as admin
    await TripMember.create({
      trip: trip._id,
      user: req.user._id,
      role: 'admin',
      status: 'accepted',
    });

    const populated = await Trip.findById(trip._id).populate('creator', 'firstName lastName photos');

    res.status(201).json({ trip: populated });
  } catch (error) {
    console.error('[createTrip]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET ALL TRIPS (with filters)
// ============================================================
const getTrips = async (req, res) => {
  try {
    const { budget, travelType, tags, gender, mode, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const deletedUsers = await User.find({ isDeleted: true }).select('_id');
    const deletedUserIds = deletedUsers.map(u => u._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = { 
      isActive: true, 
      date: { $gte: today },
      creator: { $nin: deletedUserIds }
    };

    if (budget) filter.budget = budget;
    if (travelType) filter.travelType = travelType;
    if (mode) filter.mode = mode;
    if (gender && gender !== 'Any') filter.genderPreference = { $in: [gender, 'Any'] };
    if (tags) {
      const tagArr = Array.isArray(tags) ? tags : tags.split(',');
      filter.tags = { $in: tagArr };
    }

    const trips = await Trip.find(filter)
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit)
      .populate('creator', 'firstName lastName photos profilePhoto');

    // Attach member counts & user's membership status
    const userId = req.user._id;
    const tripsWithMeta = await Promise.all(trips.map(async (trip) => {
      const memberCount = await TripMember.countDocuments({ trip: trip._id, status: 'accepted' });
      const userMembership = await TripMember.findOne({ trip: trip._id, user: userId });

      return {
        ...trip.toObject(),
        membersCount: memberCount,
        userStatus: userMembership?.status || null,
        userRole: userMembership?.role || null,
      };
    }));

    const total = await Trip.countDocuments(filter);

    res.json({
      trips: tripsWithMeta,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    console.error('[getTrips]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET MY TRIPS (created + joined)
// ============================================================
const getMyTrips = async (req, res) => {
  try {
    const userId = req.user._id;

    const memberships = await TripMember.find({
      user: userId,
      status: 'accepted',
    }).select('trip role unreadCount isPinned isMuted');

    const tripIds = memberships.map(m => m.trip);

    const trips = await Trip.find({ _id: { $in: tripIds } })
      .sort({ date: 1 })
      .populate('creator', 'firstName lastName photos');

    const tripsWithMeta = await Promise.all(trips.map(async (trip) => {
      const membership = memberships.find(m => m.trip.toString() === trip._id.toString());
      const [memberCount, lastMsg] = await Promise.all([
        TripMember.countDocuments({ trip: trip._id, status: 'accepted' }),
        TripMessage.findOne({ trip: trip._id, isDeleted: false })
          .sort({ createdAt: -1 })
          .select('text createdAt sender type')
          .populate('sender', 'firstName profilePhoto')
      ]);

      return {
        ...trip.toObject(),
        tripType: 'social',
        membersCount: memberCount,
        unreadCount: membership?.unreadCount || 0,
        isPinned: membership?.isPinned || false,
        isMuted: membership?.isMuted || false,
        lastMessage: lastMsg ? {
          text: lastMsg.text,
          sentAt: lastMsg.createdAt,
          type: lastMsg.type,
          senderName: lastMsg.sender?.firstName
        } : null,
        userRole: membership?.role || 'member',
        userStatus: 'accepted',
      };
    }));

    // Return only social trips in this endpoint to prevent confusion with itineraries
    const combined = [...tripsWithMeta].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    res.json({ trips: combined });
  } catch (error) {
    console.error('[getMyTrips]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET SAVED PLANS (AI & LYRA ITINERARIES)
// ============================================================
const getSavedPlans = async (req, res) => {
  try {
    const userId = req.user._id;

    // [LYRA] Fetch user's saved AI itineraries
    const lyraPlans = await LyraItinerary.find({ userId: userId, isSaved: true })
      .sort({ createdAt: -1 });

    const lyraFormatted = lyraPlans.map(plan => {
      const pObj = plan.toObject();
      return {
        ...pObj,
        tripType: 'lyra',
        displayDestination: pObj.location?.name || 'Unknown Location',
        date: pObj.createdAt,
        budget: pObj.estimated_cost?.stay || 'Budget',
        travelType: pObj.travel_type,
        creator: { firstName: 'Lyra AI' },
        membersCount: 1,
        maxTravelers: 1
      };
    });

    // [AI] Fetch user's saved standard AI itineraries
    const aiPlans = await AIItinerary.find({ userId: userId, isSaved: true })
      .sort({ createdAt: -1 });

    const aiFormatted = aiPlans.map(plan => {
      const pObj = plan.toObject();
      return {
        ...pObj,
        tripType: 'ai_itinerary',
        displayDestination: pObj.destination || 'Unknown Location',
        date: pObj.createdAt,
        budget: pObj.budget || 'Budget',
        travelType: pObj.travelType,
        creator: { firstName: 'EkalGo AI' },
        membersCount: 1,
        maxTravelers: 1
      };
    });

    const combined = [...lyraFormatted, ...aiFormatted].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    res.json({ savedPlans: combined });
  } catch (error) {
    console.error('[getSavedPlans]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET TRIP DETAIL
// ============================================================
const getTripDetail = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('creator', 'firstName lastName photos profilePhoto');

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const members = await TripMember.find({ trip: trip._id })
      .populate('user', 'firstName lastName photos profilePhoto age gender');

    const userId = req.user._id;
    const acceptedMembers = members.filter(m => m.status === 'accepted' && m.user && !m.user.isDeleted);
    const userMembership = members.find(m => m.user._id.toString() === userId.toString());

    res.json({
      trip: trip.toObject(),
      members: members
        .filter(m => m.user && !m.user.isDeleted)
        .map(m => ({
          ...m.toObject(),
          user: m.user,
        })),
      acceptedMembers: acceptedMembers.map(m => ({
        ...m.toObject(),
        user: m.user,
      })),
      memberCount: acceptedMembers.length,
      userStatus: userMembership?.status || null,
      userRole: (userMembership?.role === 'admin' || String(trip.creator) === String(userId)) ? 'admin' : (userMembership?.role || null),
    });
  } catch (error) {
    console.error('[getTripDetail]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// UPDATE TRIP (admin only)
// ============================================================
const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the trip creator can edit' });
    }

    const allowed = ['name', 'source', 'destination', 'date', 'endDate', 'mode', 'budget',
      'travelType', 'tags', 'maxTravelers', 'description', 'genderPreference'];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) trip[field] = req.body[field];
    });

    await trip.save();
    const populated = await Trip.findById(trip._id).populate('creator', 'firstName lastName photos');
    res.json({ trip: populated });
  } catch (error) {
    console.error('[updateTrip]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// DELETE TRIP (admin only)
// ============================================================
const deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (trip.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the trip creator can delete' });
    }

    await TripMember.deleteMany({ trip: trip._id });
    await TripMessage.deleteMany({ trip: trip._id });
    await Trip.findByIdAndDelete(trip._id);

    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('[deleteTrip]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// JOIN TRIP (request)
// ============================================================
const joinTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    if (!trip.isActive) return res.status(400).json({ error: 'Trip is no longer active' });

    const existing = await TripMember.findOne({ trip: trip._id, user: req.user._id });
    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ error: 'Already a member' });
      if (existing.status === 'pending') return res.status(400).json({ error: 'Request already pending' });
      if (existing.status === 'rejected') {
        // Allow re-request
        existing.status = 'pending';
        existing.message = req.body.message || '';
        await existing.save();
        return res.json({ member: existing, message: 'Join request re-sent' });
      }
    }

    const acceptedCount = await TripMember.countDocuments({ trip: trip._id, status: 'accepted' });
    if (acceptedCount >= trip.maxTravelers) {
      return res.status(400).json({ error: 'Trip is full' });
    }

    const member = await TripMember.create({
      trip: trip._id,
      user: req.user._id,
      role: 'member',
      status: 'pending',
      message: req.body.message || '',
    });

    // Notify trip creator via socket
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      const requester = await User.findById(req.user._id).select('firstName photos');
      io.to(trip.creator.toString()).emit('trip_join_request', {
        tripId: trip._id,
        tripTitle: `${trip.source.city} → ${trip.destination.city}`,
        user: requester,
        message: req.body.message || '',
      });

      // ✅ PERSISTENT NOTIFICATION: Create in DB for Creator
      await Notification.create({
        recipient: trip.creator,
        sender: req.user._id,
        type: 'trip_join_request',
        title: 'New Trip Request',
        message: `${requester.firstName} wants to join your trip: ${trip.source.city} → ${trip.destination.city}`,
        data: { tripId: trip._id }
      });

      // Emit live unread count update
      io.to(trip.creator.toString()).emit('new_notification', { unreadCount: await Notification.countDocuments({ recipient: trip.creator, isRead: false }) });

    } catch (e) {
      console.warn('[joinTrip] Socket notification failed:', e.message);
    }

    res.status(201).json({ member, message: 'Join request sent' });
  } catch (error) {
    console.error('[joinTrip]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// HANDLE MEMBER (accept/reject — admin only)
// ============================================================
const handleMember = async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or reject' });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Check if requester is admin
    const adminMember = await TripMember.findOne({
      trip: trip._id,
      user: req.user._id,
      role: 'admin',
      status: 'accepted',
    });
    if (!adminMember) return res.status(403).json({ error: 'Only admin can manage members' });

    const member = await TripMember.findOne({
      trip: trip._id,
      user: req.params.userId,
    });
    if (!member) return res.status(404).json({ error: 'Member request not found' });

    if (action === 'accept') {
      const acceptedCount = await TripMember.countDocuments({ trip: trip._id, status: 'accepted' });
      if (acceptedCount >= trip.maxTravelers) {
        return res.status(400).json({ error: 'Trip is full' });
      }
      member.status = 'accepted';
      await member.save();

      // Update members count
      trip.membersCount = acceptedCount + 1;
      await trip.save();

      // Send system message in trip chat
      const joiner = await User.findById(req.params.userId).select('firstName');
      const sysMsg = await TripMessage.create({
        trip: trip._id,
        sender: req.user._id,
        text: `${joiner.firstName} joined the trip! 🎉`,
        type: 'system',
      });
      try {
        const { getIO } = require('../socket/socketHandler');
        const io = getIO();
        if (io) io.to(`trip_${trip._id}`).emit('receive_message', { ...sysMsg.toObject(), chatId: trip._id });
      } catch (e) {}

      // Notify the user
      try {
        const { getIO } = require('../socket/socketHandler');
        const io = getIO();
        io.to(req.params.userId).emit('trip_request_accepted', {
          tripId: trip._id,
          tripTitle: `${trip.source.city} → ${trip.destination.city}`,
        });

        // ✅ PERSISTENT NOTIFICATION: Create for Joiner
        await Notification.create({
          recipient: req.params.userId,
          sender: req.user._id,
          type: 'trip_accepted',
          title: 'Trip Request Accepted',
          message: `Your request to join "${trip.source.city} → ${trip.destination.city}" was accepted! 🎉`,
          data: { tripId: trip._id }
        });

        // 🏘️ NOTIFY ALL OTHER MEMBERS
        const otherMembers = await TripMember.find({ 
          trip: trip._id, 
          status: 'accepted',
        });

        for (const m of otherMembers) {
          // Notify every existing member (including admin for history)
          const memberNotification = await Notification.create({
            recipient: m.user,
            sender: req.params.userId,
            type: 'trip_member_joined',
            title: 'New Member Joined',
            message: `${joiner.firstName} joined your trip to ${trip.destination.city}! 🎒`,
            data: { tripId: trip._id }
          });

          // Populate sender for display
          const populatedMemberNote = await Notification.findById(memberNotification._id).populate('sender', 'firstName lastName photos');

          // Emit real-time notification to this member
          console.log(`[NOTIFY] Sending trip_member_joined to ${m.user}`);
          io.to(m.user.toString()).emit('new_notification', populatedMemberNote);
        }

        // Emit live unread count update for joiner
        const joinerUnread = await Notification.countDocuments({ recipient: req.params.userId, isRead: false });
        io.to(req.params.userId).emit('new_notification', { unreadCount: joinerUnread });

        // Join the user's socket to the trip room if they are online
        const targetSocket = [...io.sockets.sockets.values()].find(s => s.userId === req.params.userId);
        if (targetSocket) {
          targetSocket.join(`trip_${trip._id}`);
          console.log(`[TRIP] Online user ${req.params.userId} auto-joined trip_${trip._id}`);
        }
      } catch (e) {}
    } else {
      member.status = 'rejected';
      await member.save();
    }

    res.json({ member, message: `Member ${action}ed` });
  } catch (error) {
    console.error('[handleMember]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// REMOVE MEMBER / LEAVE TRIP
// ============================================================
const removeMember = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const targetUserId = req.params.userId;
    const requesterId = req.user._id.toString();
    const isSelf = targetUserId === requesterId;

    if (!isSelf) {
      // Only admin can remove others
      const adminMember = await TripMember.findOne({
        trip: trip._id,
        user: req.user._id,
        role: 'admin',
        status: 'accepted',
      });
      if (!adminMember) return res.status(403).json({ error: 'Only admin can remove members' });
    }

    // Cannot remove the creator
    if (targetUserId === trip.creator.toString() && !isSelf) {
      return res.status(400).json({ error: 'Cannot remove the trip creator' });
    }

    await TripMember.findOneAndDelete({ trip: trip._id, user: targetUserId });

    // Update count
    const count = await TripMember.countDocuments({ trip: trip._id, status: 'accepted' });
    trip.membersCount = count;
    await trip.save();

    // System message
    const removed = await User.findById(targetUserId).select('firstName');
    const sysMsg = await TripMessage.create({
      trip: trip._id,
      sender: req.user._id,
      text: isSelf ? `${removed.firstName} left the trip` : `${removed.firstName} was removed from the trip`,
      type: 'system',
    });
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) {
        io.to(`trip_${trip._id}`).emit('receive_message', { ...sysMsg.toObject(), chatId: trip._id });
        io.to(`trip_${trip._id}`).emit('member_removed', { userId: targetUserId, tripId: trip._id });
      }
    } catch (e) {}

    res.json({ message: isSelf ? 'Left trip' : 'Member removed' });
  } catch (error) {
    console.error('[removeMember]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET TRIP MESSAGES (group chat)
// ============================================================
const getTripMessages = async (req, res) => {
  try {
    const tripId = req.params.id;

    // Verify user is accepted member
    const member = await TripMember.findOne({
      trip: tripId,
      user: req.user._id,
      status: 'accepted',
    });
    if (!member) return res.status(403).json({ error: 'Only trip members can view chat' });

    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const messages = await TripMessage.find({ trip: tripId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'firstName lastName profilePhotos photos')
      .populate({ path: 'replyTo', select: 'text type imageUrl voiceUrl sender edited isDeleted', populate: { path: 'sender', select: 'firstName' }});

    /* 
    // Mark as read only on scroll-based seen event
    await TripMessage.updateMany(
      { trip: tripId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    await TripMember.updateOne({ trip: tripId, user: req.user._id }, { unreadCount: 0 });
    */

    const total = await TripMessage.countDocuments({ trip: tripId, isDeleted: false });

    const formattedMessages = messages.reverse().map(msg => {
      const obj = msg.toObject();
      obj.chatId = obj.trip;
      return obj;
    });

    res.json({
      messages: formattedMessages,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    console.error('[getTripMessages]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// SEND TRIP MESSAGE
// ============================================================
const sendTripMessage = async (req, res) => {
  try {
    const tripId = req.params.id;

    // Verify user is accepted member
    const member = await TripMember.findOne({
      trip: tripId,
      user: req.user._id,
      status: 'accepted',
    });

    if (!member) return res.status(403).json({ error: 'Only trip members can send messages' });

    const { text, tempId, replyTo } = req.body;

    const messageData = {
      trip: tripId,
      sender: req.user._id,
      text,
      tempId,
      type: 'text',
      replyTo: replyTo || null,
    };

    const message = await TripMessage.create(messageData);
    await message.populate('sender', 'firstName lastName profilePhotos photos');
    if (message.replyTo) {
      await message.populate({ path: 'replyTo', select: 'text type imageUrl voiceUrl sender edited isDeleted', populate: { path: 'sender', select: 'firstName' }});
    }

    const formattedMessage = { ...message.toObject(), chatId: message.trip };

    // Increment unread counts for all members except sender
    await TripMember.updateMany(
      { trip: tripId, user: { $ne: req.user._id }, status: 'accepted' },
      { $inc: { unreadCount: 1 } }
    );

    // Broadcast to trip room via socket
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) {
        // Emit to trip room
        io.to(`trip_${tripId}`).emit('receive_message', formattedMessage);
      }
    } catch (e) {
      console.warn('[sendTripMessage] Socket broadcast failed:', e.message);
    }

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error('[sendTripMessage]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// SEND TRIP IMAGE
// ============================================================
const sendTripImage = async (req, res) => {
  try {
    const tripId = req.params.id;

    const member = await TripMember.findOne({ trip: tripId, user: req.user._id, status: 'accepted' });
    if (!member) return res.status(403).json({ error: 'Only trip members can send messages' });

    const uploadedFile = req.files?.file?.[0] || req.file;
    if (!uploadedFile) return res.status(400).json({ error: 'No image file uploaded' });
    
    const { tempId, replyTo } = req.body;
    const messageData = {
      trip: tripId,
      sender: req.user._id,
      imageUrl: uploadedFile.path,
      imagePublicId: uploadedFile.filename,
      tempId,
      type: 'image',
      replyTo: replyTo || null,
    };

    const message = await TripMessage.create(messageData);
    await message.populate('sender', 'firstName lastName profilePhotos photos');
    if (message.replyTo) {
      await message.populate({ path: 'replyTo', select: 'text type imageUrl voiceUrl sender edited isDeleted', populate: { path: 'sender', select: 'firstName' }});
    }

    const formattedMessage = { ...message.toObject(), chatId: message.trip };

    await TripMember.updateMany(
      { trip: tripId, user: { $ne: req.user._id }, status: 'accepted' },
      { $inc: { unreadCount: 1 } }
    );

    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) io.to(`trip_${tripId}`).emit('receive_message', formattedMessage);
    } catch (e) {
      console.warn('[sendTripImage] Socket broadcast failed:', e.message);
    }

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error('[sendTripImage]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// SEND TRIP VOICE
// ============================================================
const sendTripVoice = async (req, res) => {
  try {
    const tripId = req.params.id;

    const member = await TripMember.findOne({ trip: tripId, user: req.user._id, status: 'accepted' });
    if (!member) return res.status(403).json({ error: 'Only trip members can send messages' });

    const uploadedAudio = req.files?.audio?.[0] || req.file;
    if (!uploadedAudio) return res.status(400).json({ error: 'No voice file uploaded' });
    
    const { tempId, replyTo } = req.body;
    const messageData = {
      trip: tripId,
      sender: req.user._id,
      voiceUrl: uploadedAudio.path,
      voicePublicId: uploadedAudio.filename,
      tempId,
      type: 'voice',
      replyTo: replyTo || null,
    };

    const message = await TripMessage.create(messageData);
    await message.populate('sender', 'firstName lastName profilePhotos photos');
    if (message.replyTo) {
      await message.populate({ path: 'replyTo', select: 'text type imageUrl voiceUrl sender edited isDeleted', populate: { path: 'sender', select: 'firstName' }});
    }

    const formattedMessage = { ...message.toObject(), chatId: message.trip };

    await TripMember.updateMany(
      { trip: tripId, user: { $ne: req.user._id }, status: 'accepted' },
      { $inc: { unreadCount: 1 } }
    );

    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) io.to(`trip_${tripId}`).emit('receive_message', formattedMessage);
    } catch (e) {
      console.warn('[sendTripVoice] Socket broadcast failed:', e.message);
    }

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    console.error('[sendTripVoice]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// EDIT TRIP MESSAGE
// ============================================================
const editTripMessage = async (req, res) => {
  try {
    const { id: tripId, messageId } = req.params;
    const { text } = req.body;

    const message = await TripMessage.findOne({ _id: messageId, trip: tripId, sender: req.user._id });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.isDeleted) return res.status(400).json({ error: 'Cannot edit deleted message' });
    if (message.type !== 'text') return res.status(400).json({ error: 'Only text messages can be edited' });

    message.text = text;
    message.edited = true;
    await message.save();

    await message.populate('sender', 'firstName lastName profilePhotos photos');
    if (message.replyTo) {
      await message.populate({ path: 'replyTo', select: 'text type imageUrl voiceUrl sender edited isDeleted', populate: { path: 'sender', select: 'firstName' }});
    }

    const formattedMessage = { ...message.toObject(), chatId: message.trip };

    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) io.to(`trip_${tripId}`).emit('message_edited', formattedMessage);
    } catch (e) {
      console.warn('[editTripMessage] Socket broadcast failed:', e.message);
    }

    res.json({ message: formattedMessage });
  } catch (error) {
    console.error('[editTripMessage]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// REACT TRIP MESSAGE
// ============================================================
const reactTripMessage = async (req, res) => {
  try {
    const { id: tripId, messageId } = req.params;
    const { emoji } = req.body;
    
    // Check if member
    const member = await TripMember.findOne({ trip: tripId, user: req.user._id, status: 'accepted' });
    if (!member) return res.status(403).json({ error: 'Only trip members can react' });

    const message = await TripMessage.findOne({ _id: messageId, trip: tripId });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    
    const existingIndex = message.reactions.findIndex(
      (r) => String(r.user) === String(req.user._id) && r.emoji === emoji
    );

    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      const userIndex = message.reactions.findIndex(r => String(r.user) === String(req.user._id));
      if (userIndex > -1) {
        message.reactions[userIndex].emoji = emoji;
      } else {
        message.reactions.push({ user: req.user._id, emoji });
      }
    }

    await message.save();

    const formattedMessage = { ...message.toObject(), chatId: message.trip };

    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) io.to(`trip_${tripId}`).emit('message_reacted', {
        messageId: message._id,
        reactions: message.reactions,
        chatId: tripId,
        chatType: 'group'
      });
    } catch (e) {}

    res.json({ message: formattedMessage });
  } catch (error) {
    console.error('[reactTripMessage]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// DELETE TRIP MESSAGE (Soft Delete)
// ============================================================
const deleteTripMessage = async (req, res) => {
  try {
    const { id: tripId, messageId } = req.params;

    const message = await TripMessage.findOne({ _id: messageId, trip: tripId, sender: req.user._id });
    if (!message) return res.status(404).json({ error: 'Message not found or not authorized' });

    message.isDeleted = true;
    message.text = 'This message was deleted';
    message.imageUrl = null;
    message.voiceUrl = null;
    await message.save();

    const formattedMessage = { ...message.toObject(), chatId: message.trip };

    // Broadcast delete
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) io.to(`trip_${tripId}`).emit('message_deleted', { 
        messageId: message._id, 
        chatId: tripId,
        chatType: 'group'
      });
    } catch (e) {
      console.warn('[deleteTripMessage] Socket broadcast failed:', e.message);
    }

    res.json({ message: formattedMessage });
  } catch (error) {
    console.error('[deleteTripMessage]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET PENDING REQUESTS (for trip admin)
// ============================================================
const getPendingRequests = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (trip.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only trip creator can view requests' });
    }

    const pending = await TripMember.find({ trip: trip._id, status: 'pending' })
      .populate('user', 'firstName lastName photos age gender bio');

    res.json({ requests: pending });
  } catch (error) {
    console.error('[getPendingRequests]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// UPDATE GROUP INFO (NAME / ICON)
// ============================================================
const updateGroupInfo = async (req, res) => {
  try {
    const tripId = req.params.id;
    const { groupName } = req.body;
    let groupIconUrl = null;

    if (req.file) {
      groupIconUrl = req.file.path;
    }

    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Ensure user is admin
    const adminMember = await TripMember.findOne({
      trip: tripId,
      user: req.user._id,
      role: 'admin',
      status: 'accepted',
    });
    if (!adminMember) {
      return res.status(403).json({ error: 'Only admin can update group info' });
    }

    const updates = [];
    if (groupName !== undefined && groupName !== trip.groupName) {
      trip.groupName = groupName;
      updates.push(`Admin changed the group name to "${groupName}"`);
    }
    
    if (groupIconUrl) {
      trip.groupIcon = groupIconUrl;
      updates.push(`Admin updated the group icon`);
    }

    await trip.save();

    // Broadcast system messages
    if (updates.length > 0) {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      for (const text of updates) {
        const sysMsg = await TripMessage.create({
          trip: tripId,
          sender: req.user._id,
          text,
          type: 'system',
        });
        if (io) io.to(`trip_${tripId}`).emit('receive_message', { ...sysMsg.toObject(), chatId: tripId });
      }

      // Broadcast an event dedicated to updating the header info cleanly
      if (io) io.to(`trip_${tripId}`).emit('group_info_updated', {
        chatId: tripId,
        groupName: trip.groupName,
        groupIcon: trip.groupIcon
      });
    }

    res.json({ message: 'Group info updated', trip });
  } catch (error) {
    console.error('[updateGroupInfo]', error);
    res.status(500).json({ error: error.message });
  }
};

const togglePinTrip = async (req, res) => {
  try {
    const tripId = req.params.id;
    const userId = req.user._id;
    const member = await TripMember.findOne({ trip: tripId, user: userId });
    if (!member) return res.status(404).json({ error: 'Trip member not found' });

    member.isPinned = !member.isPinned;
    await member.save();
    res.json({ pinned: member.isPinned });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const toggleMuteTrip = async (req, res) => {
  try {
    const tripId = req.params.id;
    const userId = req.user._id;
    const member = await TripMember.findOne({ trip: tripId, user: userId });
    if (!member) return res.status(404).json({ error: 'Trip member not found' });

    member.isMuted = !member.isMuted;
    await member.save();
    res.json({ muted: member.isMuted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reportTrip = async (req, res) => {
  try {
    const tripId = req.params.id;
    const { reason, details } = req.body;
    const userId = req.user._id;

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    // 1. Save Report
    await Report.create({
      reportedBy: userId,
      targetId: tripId,
      type: 'group',
      reason,
      details: details || ''
    });

    // 2. AUTO ACTION: Remove from Group
    const trip = await Trip.findById(tripId);
    if (trip) {
      await TripMember.findOneAndDelete({ trip: tripId, user: userId });
      
      // Update counts
      const count = await TripMember.countDocuments({ trip: tripId, status: 'accepted' });
      trip.membersCount = count;
      await trip.save();

      // System message
      try {
        const reporter = await User.findById(userId).select('firstName');
        const sysMsg = await TripMessage.create({
          trip: tripId,
          sender: userId,
          text: `${reporter.firstName} reported and left the group`,
          type: 'system',
        });
        const { getIO } = require('../socket/socketHandler');
        const io = getIO();
        if (io) {
          io.to(`trip_${tripId}`).emit('receive_message', { ...sysMsg.toObject(), chatId: tripId });
          io.to(`trip_${tripId}`).emit('member_removed', { userId, tripId });
          
          // Emit match_removed to the reporter so the UI clears immediately
          io.to(userId.toString()).emit('match_removed', { matchId: tripId, type: 'group' });
        }
      } catch (e) {}
    }

    res.json({ 
      success: true,
      message: 'Report submitted. You have been removed from this group for your safety.' 
    });
  } catch (error) {
    console.error('[reportTrip]', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET SAVED PLANS (AI & Lyra)
// ============================================================
const getSavedPlans = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user._id);

    console.log(`[getSavedPlans] Fetching plans for user: ${userId}`);

    const [aiPlans, lyraPlans] = await Promise.all([
      AIItinerary.find({ userId }).sort({ createdAt: -1 }),
      LyraItinerary.find({ userId }).sort({ createdAt: -1 })
    ]);

    console.log(`[getSavedPlans] Found ${aiPlans.length} AI plans and ${lyraPlans.length} Lyra plans`);

    const combined = [
      ...(aiPlans || []).map(p => {
        try {
          return { ...p.toObject(), type: 'ai_itinerary' };
        } catch (e) {
          return { ...p, type: 'ai_itinerary' };
        }
      }),
      ...(lyraPlans || []).map(p => {
        try {
          return { ...p.toObject(), type: 'lyra' };
        } catch (e) {
          return { ...p, type: 'lyra' };
        }
      })
    ].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ savedPlans: combined });
  } catch (error) {
    console.error('[getSavedPlans] ERROR:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};

module.exports = {
  createTrip,
  getTrips,
  getMyTrips,
  getTripDetail,
  updateTrip,
  deleteTrip,
  joinTrip,
  handleMember,
  removeMember,
  getTripMessages,
  sendTripMessage,
  sendTripImage,
  sendTripVoice,
  editTripMessage,
  reactTripMessage,
  deleteTripMessage,
  updateGroupInfo,
  getPendingRequests,
  togglePinTrip,
  toggleMuteTrip,
  reportTrip,
  getSavedPlans
};
