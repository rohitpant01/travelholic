const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('../socket/socketHandler');
const { sendPushNotification } = require('./fcmUtility');

/**
 * @desc    Main Delivery Hub: Tries to deliver a notification via Socket and Push
 *          Updates status based on success/failure.
 */
const deliverNotification = async (notificationId, idempotencyKey = null) => {
  try {
    const notification = await Notification.findById(notificationId)
      .populate('sender', 'firstName lastName username photos')
      .populate('recipient', 'devices');
    
    if (!notification || !notification.recipient) return;

    // 1. Idempotency Check
    if (idempotencyKey) {
        const existing = await Notification.findOne({ idempotencyKey, status: { $in: ['sent', 'delivered'] } });
        if (existing) {
            console.log(`[NOTIF] Skipping duplicate notification: ${idempotencyKey}`);
            return existing;
        }
    }

    // Increment attempts
    notification.deliveryAttempts += 1;
    let deliveredViaSocket = false;
    let deliveredViaPush = false;

    // 2. Socket Delivery (In-App)
    try {
      const io = getIO();
      if (io) {
        const rooms = io.sockets.adapter.rooms.get(notification.recipient._id.toString());
        const isOnline = rooms && rooms.size > 0;
        
        if (isOnline) {
          io.to(notification.recipient._id.toString()).emit('new_notification', notification);
          deliveredViaSocket = true;
          console.log(`[HUB] Socket delivered to ${notification.recipient._id}`);
        }
      }
    } catch (err) {
      console.warn('[HUB] Socket delivery failed:', err.message);
    }

    // 3. Push Notification Delivery (Multi-device)
    const devices = notification.recipient.devices;
    if (devices && devices.length > 0) {
      try {
        const pushTitle = notification.title || 'New Notification';
        const priority = notification.priority || 'normal';

        const results = await Promise.all(devices.map(device => 
            sendPushNotification(device.token, pushTitle, notification.message, { 
                ...notification.data, 
                notificationId: notification._id.toString() 
            }, priority)
        ));

        deliveredViaPush = results.some(r => r.success);
        console.log(`[HUB] Push delivery result for ${notification.recipient._id}: ${deliveredViaPush}`);
      } catch (err) {
        console.error(`[HUB] Push delivery failed (Attempt ${notification.deliveryAttempts}):`, err.message);
      }
    }

    // 4. Update Status
    if (deliveredViaSocket || deliveredViaPush) {
      notification.status = 'sent';
      notification.sentAt = new Date();
    } else if (notification.deliveryAttempts >= 5) {
      notification.status = 'failed';
    } else {
      notification.status = 'pending';
    }

    await notification.save();
    return notification;
  } catch (err) {
    console.error('[HUB REDELIVERY ERROR]:', err);
  }
};

// NOTE: The legacy setInterval worker has been replaced by the professional BullMQ Event-Driven Queue
// (See queueService.js and initNotificationWorker call in server.js)

/**
 * @desc    Create a notification (Persistence First)
 */
const createNotification = async ({ recipient, sender, type, title, message, data, priority = 'normal' }) => {
  try {
    if (recipient.toString() === sender.toString()) return null;

    // 1. De-duplicate same type (e.g., likes)
    if (type === 'like' || type === 'comment') {
       await Notification.deleteMany({ 
         recipient, 
         sender, 
         type, 
         'data.postId': data?.postId 
       });
    }

    // 2. Persist in DB (PENDING)
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      title: title || 'New Notification',
      message,
      data,
      priority,
      status: 'pending'
    });

    // 3. Trigger immediate delivery loop
    // Fires in background to not block the main request thread
    deliverNotification(notification._id).catch(err => console.error('[ASYNC HUB ERROR]', err));

    return notification;
  } catch (error) {
    console.error('[NOTIFICATION CREATE ERROR]', error);
    return null;
  }
};

/**
 * @desc    Mark notification as delivered (via client ACK)
 */
const markDelivered = async (notificationId) => {
  return await Notification.findByIdAndUpdate(notificationId, { 
    status: 'delivered', 
    deliveredAt: new Date() 
  }, { new: true });
};

/**
 * @desc    Sync Missed Notifications
 */
const getMissedNotifications = async (userId, lastSyncedAt) => {
  return await Notification.find({
    recipient: userId,
    createdAt: { $gt: new Date(lastSyncedAt) },
    status: { $ne: 'delivered' }
  }).sort({ createdAt: -1 });
};

module.exports = {
  createNotification,
  deliverNotification,
  markDelivered,
  getMissedNotifications
};
