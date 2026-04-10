const Notification = require('../models/Notification');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'firstName lastName photos isDeleted')
      .sort({ createdAt: -1 })
      .limit(50);
    
    // Filter out notifications from deleted users
    const filteredNotifications = notifications.filter(n => n.sender && !n.sender.isDeleted);
    
    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user._id, 
      isRead: false 
    });

    console.log(`[NOTIFICATIONS] Sent ${filteredNotifications.length} notifications (${unreadCount} unread) to user ${req.user._id}`);
    
    // Disable caching for this sensitive route
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ notifications: filteredNotifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    console.log(`[NOTIFICATIONS] Marked ${result.modifiedCount} notifications as read for user ${req.user._id}`);

    // Sync across other potential devices
    try {
      const { getIO } = require('../socket/socketHandler');
      const io = getIO();
      if (io) {
        io.to(req.user._id.toString()).emit('notifications_read_sync');
        io.to(req.user._id.toString()).emit('new_notification', { unreadCount: 0 });
      }
    } catch (socketErr) {
      console.warn('[REST NOTIFY SYNC] Socket IO not available for sync');
    }
    res.json({ message: 'All notifications marked as read', modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Clear all notifications
// @route   DELETE /api/notifications
// @access  Private
const clearNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Acknowledge notification/message delivery (via client)
// @route   POST /api/notifications/ack
// @access  Private
const acknowledgeDelivery = async (req, res) => {
  try {
    const { notificationId, messageId } = req.body;
    const { markDelivered } = require('../utils/notificationService');

    if (notificationId) {
      await markDelivered(notificationId);
      console.log(`[ACK] Notification ${notificationId} marked delivered`);
    }

    if (messageId) {
      const { Match, Message } = require('../models/Match');
      const msg = await Message.findByIdAndUpdate(messageId, { 
        status: 'delivered', 
        deliveredAt: new Date(),
        $addToSet: { deliveredTo: req.user._id } 
      }, { new: true });

      if (msg) {
        // Broadcast "delivered" status back to sender via socket
        const { getIO } = require('../socket/socketHandler');
        const io = getIO();
        if (io) {
          io.to(msg.sender.toString()).emit('message_status_update', {
            messageId,
            status: 'delivered',
            deliveredTo: msg.deliveredTo
          });
        }
      }
      console.log(`[ACK] Message ${messageId} marked delivered`);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Sync missed notifications/messages (Startup backup)
// @route   GET /api/notifications/sync
// @access  Private
const syncNotifications = async (req, res) => {
  try {
    const { lastSyncedAt } = req.query;
    if (!lastSyncedAt) return res.status(400).json({ error: 'lastSyncedAt required' });

    const { getMissedNotifications } = require('../utils/notificationService');
    const missed = await getMissedNotifications(req.user._id, lastSyncedAt);

    // Also fetch missed chat messages
    const { Message } = require('../models/Match');
    const missedMessages = await Message.find({
      receiver: req.user._id,
      createdAt: { $gt: new Date(lastSyncedAt) },
      status: { $ne: 'delivered' }
    }).populate('sender', 'firstName photos');

    res.json({ 
      notifications: missed, 
      messages: missedMessages,
      serverTime: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getNotifications,
  markAllAsRead,
  clearNotifications,
  acknowledgeDelivery,
  syncNotifications
};
