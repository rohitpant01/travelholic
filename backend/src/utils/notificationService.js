const Notification = require('../models/Notification');
const { getIO } = require('../socket/socketHandler');

/**
 * @desc    Create a notification and emit via socket instantly
 * @param   {Object} params - { recipient, sender, type, title, message, data }
 */
const createNotification = async ({ recipient, sender, type, title, message, data }) => {
  try {
    // 1. Prevent self-notifications
    if (recipient.toString() === sender.toString()) return null;

    // 2. Clear old notifications of same type/post to avoid spam (optional but cleaner)
    if (type === 'like' || type === 'comment') {
       await Notification.deleteOne({ 
         recipient, 
         sender, 
         type, 
         'data.postId': data.postId 
       });
    }

    // 3. Create in DB
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      title,
      message,
      data
    });

    // 4. Populate sender for frontend display
    const populated = await Notification.findById(notification._id)
      .populate('sender', 'firstName lastName username photos');

    // 5. Emit via Socket.io
    try {
      const io = getIO();
      if (io) {
        // Emit to the recipient's private room
        io.to(recipient.toString()).emit('new_notification', populated);
        console.log(`[NOTIFICATION SERVICE] Emitted ${type} to user ${recipient}`);
      }
    } catch (socketErr) {
      console.warn('[NOTIFICATION SERVICE] Socket.io not available for emission');
    }

    return populated;
  } catch (error) {
    console.error('[NOTIFICATION SERVICE ERROR]', error);
    return null;
  }
};

module.exports = {
  createNotification
};
