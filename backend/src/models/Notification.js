const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'match', 'trip_join_request', 'trip_accepted', 'trip_member_joined', 'nearby_travelers', 'trending_trip', 'message'],
    required: true,
  },
  title: String,
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['normal', 'high'],
    default: 'normal',
  },
  deliveryAttempts: {
    type: Number,
    default: 0,
  },
  deliveredAt: Date,
  data: {
    postId: mongoose.Schema.Types.ObjectId,
    tripId: mongoose.Schema.Types.ObjectId,
    matchId: mongoose.Schema.Types.ObjectId,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  sentAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
