const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Message, Match, Swipe } = require('../models/Match');
const { TripMember, TripMessage } = require('../models/Trip');
const Notification = require('../models/Notification');
const { encrypt, decrypt } = require('../utils/cryptoUtility');

let io;

const joinUserToTripRooms = async (socket) => {
  try {
    const memberships = await TripMember.find({
      user: socket.userId,
      status: 'accepted'
    }).select('trip');
    
    memberships.forEach(m => {
      socket.join(`trip_${m.trip.toString()}`);
      console.log(`[TRIP JOIN] User ${socket.userId} joined room trip_${m.trip}`);
    });
  } catch (error) {
    console.error('[TRIP JOIN] Error for user', socket.userId, ':', error);
  }
};

const disconnectHolders = new Map();

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    connectTimeout: 45000,
    allowEIO3: true,
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`🔌 User connected: ${socket.userId}`);

    // User joins personal room (explicit join as requested)
    socket.on('join', async (userId) => {
      socket.userId = userId.toString();
      socket.join(userId.toString());
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
      
      // Notify matches
      const user = await User.findById(userId).select('matches');
      user?.matches?.forEach(mid => {
        io.to(mid.toString()).emit('user_online', { userId, isOnline: true });
      });
    });

    // Notify online status (automatic on connection if userId exists)
    if (socket.userId) {
      if (disconnectHolders.has(socket.userId)) {
        console.log(`🔄 User ${socket.userId} reconnected during grace period. Cancelling offline timer.`);
        clearTimeout(disconnectHolders.get(socket.userId));
        disconnectHolders.delete(socket.userId);
      }

      await User.findByIdAndUpdate(socket.userId, { isOnline: true, lastSeen: new Date() });
      socket.join(socket.userId);
      await joinUserToTripRooms(socket);
      const user = await User.findById(socket.userId).select('matches');
      user?.matches?.forEach(mid => {
        io.to(mid.toString()).emit('user_online', { userId: socket.userId, isOnline: true });
      });
    }

    // ---- JOIN MATCH ROOM ----
    socket.on('join_chat', ({ chatId, matchId, chatType }) => {
      const id = chatId || matchId;
      const type = chatType || (matchId ? 'individual' : 'group');
      const room = type === 'group' ? `trip_${id}` : `match_${id}`;
      socket.join(room);
    });

    socket.on('leave_chat', ({ chatId, matchId, chatType }) => {
      const id = chatId || matchId;
      const type = chatType || (matchId ? 'individual' : 'group');
      const room = type === 'group' ? `trip_${id}` : `match_${id}`;
      socket.leave(room);
    });

    // ---- UNIFIED SEND MESSAGE ----
    socket.on('send_message', async (data) => {
      try {
        console.log(`[SOCKET] Received send_message from ${socket.userId}:`, data);
        const chatId = data.chatId || data.matchId;
        const chatType = data.chatType || (data.matchId ? 'individual' : 'group');
        const receiverId = data.receiverId;
        const text = data.text;
        const imageUrl = data.imageUrl;
        const voiceUrl = data.voiceUrl;
        const replyTo = data.replyTo;
        const tempId = data.tempId;
        const latitude = data.latitude;
        const longitude = data.longitude;

        let lastMsgText = text;
        if (imageUrl) lastMsgText = '📷 Photo';
        if (voiceUrl) lastMsgText = '🎤 Voice message';
        if (latitude && longitude) lastMsgText = '📍 Location';
        
        // De-duplication check using tempId
        if (tempId) {
          if (chatType === 'group') {
             const { TripMessage } = require('../models/Trip');
             const existing = await TripMessage.findOne({ trip: chatId, tempId, sender: socket.userId });
             if (existing) {
               console.log(`[SOCKET DEBUG] DUPLICATE Group Message rejected (tempId: ${tempId})`);
               return;
             }
          } else {
             const existing = await Message.findOne({ matchId: chatId, tempId, sender: socket.userId });
             if (existing) {
               console.log(`[SOCKET DEBUG] DUPLICATE Individual Message rejected (tempId: ${tempId})`);
               return;
             }
          }
        }

        console.log(`[SOCKET DEBUG] Sender ID: ${socket.userId}, Chat ID: ${chatId}, Receiver: ${receiverId}`);

        if (chatType === 'group' || !receiverId) {
          // 4. Persistence First (Group)
          const member = await TripMember.findOne({ trip: chatId, user: socket.userId, status: 'accepted' });
          if (!member) return socket.emit('error', { message: 'Not a trip member' });

          const message = await TripMessage.create({
            trip: chatId,
            sender: socket.userId,
            tempId,
            text: text ? encrypt(text) : '',
            imageUrl: imageUrl || null,
            voiceUrl: voiceUrl || null,
            latitude: latitude ? encrypt(latitude.toString()) : null,
            longitude: longitude ? encrypt(longitude.toString()) : null,
            type: (latitude && longitude) ? 'location' : (voiceUrl ? 'voice' : (imageUrl ? 'image' : 'text')),
            replyTo: replyTo || null,
          });

          await message.populate('sender', 'firstName lastName photos');
          if (message.replyTo) {
            await message.populate({ path: 'replyTo', select: 'text type imageUrl voiceUrl sender edited isDeleted', populate: { path: 'sender', select: 'firstName' }});
          }

          const formattedMessage = { ...message.toObject(), chatId: message.trip, text: text || '' };

          await TripMember.updateMany(
            { trip: chatId, user: { $ne: socket.userId }, status: 'accepted' },
            { $inc: { unreadCount: 1 } }
          );

          io.to(`trip_${chatId}`).emit('receive_message', formattedMessage);
          
          // 5. Create & Enqueue Notification
          try {
            const { createNotification } = require('../utils/notificationService');
            await createNotification({
                recipient: null, // notificationService handles trip-wide broadcasting
                tripId: chatId,
                sender: socket.userId,
                type: 'trip_message',
                title: `New trip message 🎒`,
                message: text || (imageUrl ? '📷 Photo' : 'New message'),
                data: { type: 'trip_message', tripId: chatId },
                priority: 'normal'
            });
          } catch (err) {
            console.error('[SOCKET] Group notification failed (non-fatal):', err.message);
          }

        } else {
          console.log('[SOCKET DEBUG] Processing individual message');
          console.log('[SOCKET DEBUG] Creating individual message in DB');
          const message = await Message.create({
            matchId: chatId,
            tempId, // Save tempId for future deduplication
            sender: socket.userId,
            receiver: receiverId,
            text: text || '',
            imageUrl: imageUrl || null,
            voiceUrl: voiceUrl || null,
            latitude: latitude || null,
            longitude: longitude || null,
            type: (latitude && longitude) ? 'location' : (voiceUrl ? 'voice' : (imageUrl ? 'image' : 'text')),
            replyTo: replyTo || null,
          });
          console.log('[SOCKET DEBUG] Individual Message saved:', message._id);

          await message.populate([
            { path: 'sender', select: 'firstName photos' },
            { path: 'replyTo', select: 'text imageUrl type sender' }
          ]);

          const formattedMessage = { ...message.toObject(), chatId: message.matchId };

          console.log('[SOCKET DEBUG] Updating match last message and unread counts for receiver:', receiverId);
          // Update last message and atomically increment receiver's unread count
          await Match.findByIdAndUpdate(chatId, {
            $set: {
              lastMessage: {
                text: lastMsgText,
                sentAt: new Date(),
                sentBy: socket.userId,
              },
            },
            $inc: { [`unreadCounts.${receiverId}`]: 1 },
          });
          console.log('[SOCKET DEBUG] Match last message and unread counts updated');

          // 3. Emit via Socket (Instant)
          let deliveredToReceiver = false;
          const senderName = socket.user?.firstName || 'Someone';
          const senderPhoto = socket.user?.photos?.find(p => p.isProfile)?.url || socket.user?.photos?.[0]?.url;

          const receiverSocketRoom = io.sockets.adapter.rooms.get(receiverId);
          if (receiverSocketRoom && receiverSocketRoom.size > 0) {
             io.to(receiverId).emit('receive_message', {
               ...formattedMessage,
               matchId: chatId,
               senderName,
               senderPhoto,
               status: 'delivered'
             });
             deliveredToReceiver = true;
          }

          // Also emit to sender (for multi-device sync and confirmation)
          io.to(socket.userId).emit('receive_message', {
             ...formattedMessage,
             matchId: chatId,
             senderName,
             senderPhoto,
             status: deliveredToReceiver ? 'delivered' : 'sent'
          });

          // 4. Update DB status based on socket delivery
          if (deliveredToReceiver) {
            await Message.findByIdAndUpdate(message._id, { 
              status: 'delivered', 
              deliveredAt: new Date(),
              $addToSet: { deliveredTo: receiverId } 
            });
          } else {
            // Keep status as 'sent' (already set via default if not pending)
            await Message.findByIdAndUpdate(message._id, { status: 'sent' });
          }

          // 5. Create & Enqueue Notification
          try {
            const { createNotification } = require('../utils/notificationService');
            await createNotification({
                recipient: receiverId,
                sender: socket.userId,
                type: 'message',
                title: `${senderName} sent you a message 👀`,
                message: text || (imageUrl ? '📷 Photo' : (voiceUrl ? '🎤 Voice message' : 'New message')),
                data: { 
                    type: 'message', 
                    messageId: message._id.toString(),
                    chatId: chatId
                },
                priority: 'high'
            });
          } catch (err) {
            console.error('[SOCKET] Notification failed (non-fatal):', err.message);
          }
        }
      } catch (error) {
        console.error('[SOCKET ERROR] Failed to process send_message:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // ---- EDIT MESSAGE ----
    socket.on('edit_message', async ({ messageId, text, chatId, chatType }) => {
      try {
        const finalChatId = chatId;
        const finalChatType = chatType || 'individual';
        
        if (finalChatType === 'group') {
          const { TripMessage } = require('../models/Trip');
          const message = await TripMessage.findOneAndUpdate(
            { _id: messageId, trip: finalChatId, sender: socket.userId },
            { text, edited: true },
            { new: true }
          ).populate('sender', 'firstName lastName profilePhotos photos');
          if (message) {
             const formattedMessage = { ...message.toObject(), chatId: message.trip };
             io.to(`trip_${finalChatId}`).emit('message_edited', formattedMessage);
          }
        } else {
          const message = await Message.findOneAndUpdate(
            { _id: messageId, sender: socket.userId },
            { text, edited: true },
            { new: true }
          ).populate('sender', 'firstName photos');
          if (message) {
             const formattedMessage = { ...message.toObject(), chatId: message.matchId };
             io.to(`match_${finalChatId}`).emit('message_edited', formattedMessage);
          }
        }
      } catch (error) {
        console.error('Edit message socket error:', error);
      }
    });

    // ---- DELETE MESSAGE ----
    socket.on('delete_message', async ({ messageId, chatId, chatType }) => {
      try {
        const finalChatId = chatId;
        const finalChatType = chatType || 'individual';

        if (finalChatType === 'group') {
          const { TripMessage } = require('../models/Trip');
          const message = await TripMessage.findOneAndUpdate(
            { _id: messageId, trip: finalChatId, sender: socket.userId },
            { isDeleted: true, text: 'This message was deleted', imageUrl: null, voiceUrl: null },
            { new: true }
          );
          if (message) {
             io.to(`trip_${finalChatId}`).emit('message_deleted', { messageId, chatId: finalChatId });
          }
        } else {
          const message = await Message.findOneAndUpdate(
            { _id: messageId, sender: socket.userId },
            { isDeleted: true, text: 'This message was deleted', imageUrl: null, voiceUrl: null },
            { new: true }
          );
          if (message) {
            io.to(`match_${finalChatId}`).emit('message_deleted', { messageId, chatId: finalChatId });
          }
        }
      } catch (error) {
        console.error('Delete message socket error:', error);
      }
    });

    // ---- MESSAGE REACTION ----
    socket.on('message_reaction', async ({ messageId, emoji, chatId, chatType }) => {
      try {
        const finalChatId = chatId;
        const finalChatType = chatType || 'individual';

        if (finalChatType === 'group') {
          const { TripMessage } = require('../models/Trip');
          const message = await TripMessage.findById(messageId);
          if (!message) return;

          message.reactions = message.reactions.filter(r => r.user.toString() !== socket.userId);
          if (emoji) {
            message.reactions.push({ user: socket.userId, emoji });
          }
          await message.save();

          io.to(`trip_${finalChatId}`).emit('message_reacted', { 
            messageId, 
            reactions: message.reactions,
            chatId: finalChatId,
            chatType: 'group'
          });
        } else {
          const message = await Message.findById(messageId);
          if (!message) return;

          message.reactions = message.reactions.filter(r => r.user.toString() !== socket.userId);
          if (emoji) {
            message.reactions.push({ user: socket.userId, emoji });
          }
          await message.save();

          io.to(`match_${finalChatId}`).emit('message_reacted', { 
            messageId, 
            reactions: message.reactions,
            chatId: finalChatId,
            chatType: 'individual'
          });
        }
      } catch (error) {
        console.error('Reaction socket error:', error);
      }
    });

    // ---- TYPING INDICATOR ----
    socket.on('typing', ({ from, to, isTyping, chatId, chatType }) => {
      const finalChatId = chatId;
      const finalChatType = chatType || 'individual';
      const senderName = socket.user?.firstName || 'Someone';

      if (finalChatType === 'group') {
        socket.to(`trip_${finalChatId}`).emit('typing', { from, isTyping, senderName, chatId: finalChatId, chatType: 'group' });
      } else {
        if (finalChatId) {
          socket.to(`match_${finalChatId}`).emit('typing', { from, isTyping, senderName, chatId: finalChatId, chatType: 'individual' });
        } else if (to) {
          io.to(to).emit('typing', { from, isTyping, senderName, chatId: finalChatId, chatType: 'individual' });
        }
      }
    });

    // ---- MESSAGE STATUS UPDATES (delivered/seen) ----
    socket.on('message_delivered', async ({ messageId, chatId, chatType }) => {
      try {
        const finalChatId = chatId;
        const finalChatType = chatType || 'individual';

        if (finalChatType === 'group') {
          const { TripMessage } = require('../models/Trip');
          if (messageId) {
            await TripMessage.findByIdAndUpdate(
              messageId,
              { $addToSet: { deliveredTo: socket.userId }, status: 'delivered' }
            );
          }
        } else {
          if (messageId) {
            const message = await Message.findByIdAndUpdate(
              messageId,
              { $addToSet: { deliveredTo: socket.userId }, status: 'delivered', deliveredAt: new Date() },
              { new: true }
            );
            if (message) {
              io.to(message.sender.toString()).emit('message_status_update', { 
                messageId, 
                chatId: finalChatId,
                status: 'delivered',
                deliveredTo: message.deliveredTo
              });
            }
          }
        }
      } catch (error) {
        console.error('Delivery status error:', error);
      }
    });

    socket.on('message_seen', async ({ messageId, chatId, chatType }) => {
      try {
        const finalChatId = chatId;
        const finalChatType = chatType || 'individual';

        if (finalChatType === 'group') {
          const { TripMessage, TripMember } = require('../models/Trip');
          if (messageId) {
             const wasAlreadyRead = await TripMessage.findOne({ _id: messageId, readBy: socket.userId });
             const message = await TripMessage.findByIdAndUpdate(
               messageId,
               { 
                 $addToSet: { readBy: socket.userId },
                 status: 'read',
                 readAt: new Date()
               },
               { new: true }
             );
            if (message && !wasAlreadyRead) {
              // Decrement unread count for this user in this trip
              await TripMember.updateOne(
                { trip: finalChatId, user: socket.userId },
                { $inc: { unreadCount: -1 } }
              );
              
              // Ensure it doesn't go below 0
              await TripMember.updateOne(
                { trip: finalChatId, user: socket.userId, unreadCount: { $lt: 0 } },
                { $set: { unreadCount: 0 } }
              );

              io.to(`trip_${finalChatId}`).emit('message_status_update', { 
                messageId: finalChatId, // Backend uses tripId for broadcasting status updates usually, but let's stick to consistent field
                chatId: finalChatId, 
                chatType: 'group',
                messageIdActual: messageId,
                readBy: message.readBy
              });
            }
          } else if (finalChatId) {
            await TripMessage.updateMany(
              { trip: finalChatId, readBy: { $ne: socket.userId } },
              { $addToSet: { readBy: socket.userId } }
            );
            socket.to(`trip_${finalChatId}`).emit('messages_read_ack', {
              chatId: finalChatId,
              chatType: 'group',
              readBy: socket.userId,
            });
          }
        } else {
          if (messageId) {
            const message = await Message.findOneAndUpdate(
              { _id: messageId, receiver: socket.userId },
              { $addToSet: { readBy: socket.userId }, status: 'read', readAt: new Date() },
              { new: true }
            );
            if (message) {
              io.to(message.sender.toString()).emit('message_status_update', { 
                messageId, 
                chatId: finalChatId, 
                chatType: 'individual',
                status: 'read',
                readBy: message.readBy,
                readAt: message.readAt
              });
            }
          } else if (finalChatId) {
            const now = new Date();
            await Message.updateMany(
              { matchId: finalChatId, receiver: socket.userId, readBy: { $ne: socket.userId } },
              { $addToSet: { readBy: socket.userId }, status: 'read', readAt: now }
            );
            
            const match = await Match.findById(finalChatId).populate('users');
            if (match) {
              const currentUserId = socket.userId.toString();
              const otherUser = match.users.find(u => u._id.toString() !== currentUserId);
              if (otherUser) {
                const otherUserId = otherUser._id.toString();
                io.to(otherUserId).emit('message_status_update', { 
                  chatId: finalChatId, 
                  chatType: 'individual',
                  status: 'read',
                  readAt: now
                });
              }
            }
            
            socket.to(`match_${finalChatId}`).emit('messages_read_ack', {
              chatId: finalChatId,
              chatType: 'individual',
              readBy: socket.userId,
            });
          }
        }
      } catch (error) {
        console.error('Read receipt error:', error);
      }
    });

    // ---- NOTIFICATION SYNC ----
    socket.on('mark_notifications_read', async () => {
      try {
        const userId = socket.userId;
        if (!userId) return;

        // Update database
        await Notification.updateMany(
          { recipient: userId, isRead: false },
          { isRead: true }
        );

        // Notify all devices of the same user
        io.to(userId).emit('notifications_read_sync');
        
        // Also emit count 0 to be sure
        io.to(userId).emit('new_notification', { unreadCount: 0 });
        
        console.log(`[SOCKET] Notifications marked read for user ${userId} and synced across devices`);
      } catch (error) {
        console.error('[SOCKET] mark_notifications_read error:', error);
      }
    });

    // ---- TRIP GROUP CHAT ----
    socket.on('join_trip_chat', ({ tripId }) => {
      socket.join(`trip_${tripId}`);
      console.log(`[TRIP] User ${socket.userId} joined trip_${tripId}`);
    });

    socket.on('leave_trip_chat', ({ tripId }) => {
      socket.leave(`trip_${tripId}`);
    });
    
    // ---- REAL-TIME DISCOVERY (Movement) ----
    socket.on('update_location', async ({ lat, lng }) => {
      try {
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
        
        const userId = socket.userId;
        if (!userId) return;

        console.log(`[SOCKET] Location update for ${userId}: ${lat}, ${lng}`);

        // Update DB
        await User.findByIdAndUpdate(userId, {
            location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }
        });

        // Broadcast movement to nearby users room
        const nearbyUsers = await User.find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
              $maxDistance: 50000, // 50km
            },
          },
          _id: { $ne: userId },
          isOnline: true,
          visibilityStatus: 'public'
        }).select('_id').limit(20); // Limit to top 20 nearby users to save CPU

        if (io) {
            nearbyUsers.forEach(u => {
              io.to(u._id.toString()).emit('user_moved', {
                userId,
                location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] }
              });
            });
        }
      } catch (err) {
        console.error('Socket location update error:', err);
      }
    });

    // ---- DISCONNECT ----
    socket.on('disconnect', (reason) => {
      if (socket.userId) {
        console.log(`🔌 User ${socket.userId} disconnected (Reason: ${reason})`);
        
        // 30 second grace period for mobile fluctuations (ISP handoffs, brief tunnel, etc)
        const timeout = setTimeout(async () => {
          console.log(`⏰ Grace period expired for ${socket.userId}. Marking as offline.`);
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          // Notify matches
          const user = await User.findById(socket.userId).select('matches');
          user?.matches?.forEach(mid => {
            io.to(mid.toString()).emit('user_online', {
              userId: socket.userId,
              isOnline: false,
              lastSeen: new Date(),
            });
          });
          disconnectHolders.delete(socket.userId);
        }, 30000);

        disconnectHolders.set(socket.userId, timeout);
      }
    });
  });

  return io;
};

const getIO = () => {
  return io || null;
};

module.exports = { initSocket, getIO };
