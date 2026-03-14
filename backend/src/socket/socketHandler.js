const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Message, Match } = require('../models/Match');

let io;

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
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

    // Update online status
    await User.findByIdAndUpdate(socket.userId, { isOnline: true, lastSeen: new Date() });

    // Join personal room
    socket.join(socket.userId);

    // Broadcast online status to matches
    const user = await User.findById(socket.userId).select('matches');
    user?.matches?.forEach(matchId => {
      io.to(matchId.toString()).emit('user_online', { userId: socket.userId, isOnline: true });
    });

    // ---- JOIN MATCH ROOM ----
    socket.on('join_chat', ({ matchId }) => {
      socket.join(`match_${matchId}`);
    });

    socket.on('leave_chat', ({ matchId }) => {
      socket.leave(`match_${matchId}`);
    });

    // ---- SEND MESSAGE ----
    socket.on('send_message', async (data) => {
      try {
        const { matchId, text, imageUrl } = data;

        const match = await Match.findOne({ _id: matchId, users: socket.userId });
        if (!match) return socket.emit('error', { message: 'Not authorized' });

        const receiverId = match.users.find(u => u.toString() !== socket.userId).toString();

        const message = await Message.create({
          matchId,
          sender: socket.userId,
          receiver: receiverId,
          text: text || '',
          imageUrl: imageUrl || null,
          type: imageUrl ? 'image' : 'text',
        });

        await message.populate('sender', 'firstName photos');

        // Update match last message
        await Match.findByIdAndUpdate(matchId, {
          lastMessage: {
            text: imageUrl ? '📷 Photo' : text,
            sentAt: new Date(),
            sentBy: socket.userId,
          },
        });

        // Emit to match room
        io.to(`match_${matchId}`).emit('new_message', message);

        // Count unread messages for badge in notification
        const unreadCount = await Message.countDocuments({
          matchId,
          receiver: receiverId,
          isRead: false,
        });

        // Get sender's profile photo for the toast
        const senderProfilePhoto = socket.user.photos?.find(p => p.isProfile)?.url || socket.user.photos?.[0]?.url;

        // Notify receiver on their personal room with full data for toast popup
        io.to(receiverId).emit('new_message', {
          matchId,
          text: message.text || '📷 Photo',
          senderName: socket.user.firstName,
          senderPhoto: senderProfilePhoto,
          senderId: socket.userId,
          unreadCount,
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // ---- TYPING INDICATOR ----
    socket.on('typing_start', ({ matchId }) => {
      socket.to(`match_${matchId}`).emit('typing', { userId: socket.userId, isTyping: true });
    });

    socket.on('typing_stop', ({ matchId }) => {
      socket.to(`match_${matchId}`).emit('typing', { userId: socket.userId, isTyping: false });
    });

    // ---- READ RECEIPTS ----
    socket.on('messages_read', async ({ matchId }) => {
      try {
        await Message.updateMany(
          { matchId, receiver: socket.userId, isRead: false },
          { isRead: true, readAt: new Date() }
        );
        socket.to(`match_${matchId}`).emit('messages_read_ack', {
          matchId,
          readBy: socket.userId,
        });
      } catch (error) {
        console.error('Read receipt error:', error);
      }
    });

    // ---- DISCONNECT ----
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.userId}`);
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
      // Notify matches
      user?.matches?.forEach(matchId => {
        io.to(matchId.toString()).emit('user_online', {
          userId: socket.userId,
          isOnline: false,
          lastSeen: new Date(),
        });
      });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { initSocket, getIO };
