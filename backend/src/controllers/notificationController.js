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

module.exports = {
  getNotifications,
  markAllAsRead,
  clearNotifications,
};
