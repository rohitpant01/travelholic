const mongoose = require('mongoose');

// ============================================================
// MATCH MODEL
// ============================================================
const matchSchema = new mongoose.Schema({
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  matchedAt: { type: Date, default: Date.now },
  isSuperLike: { type: Boolean, default: false },
  lastMessage: {
    text: String,
    sentAt: Date,
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  // Per-user unread message counts (key = userId, value = count)
  unreadCounts: {
    type: Map,
    of: Number,
    default: {},
  },
  isActive: { type: Boolean, default: true },
  pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, {
  timestamps: true,
});

matchSchema.index({ users: 1 });

const Match = mongoose.model('Match', matchSchema);

// ============================================================
// MESSAGE MODEL
// ============================================================
const messageSchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: null },
  imagePublicId: { type: String, default: null },
  voiceUrl: { type: String, default: null },
  voicePublicId: { type: String, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  type: { type: String, enum: ['text', 'image', 'voice', 'location'], default: 'text' },
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  edited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
  }],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  tempId: { type: String, default: null }, // For de-duplication
  readAt: Date,
}, {
  timestamps: true,
});

messageSchema.index({ matchId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });

const Message = mongoose.model('Message', messageSchema);

// ============================================================
// SWIPE LOG MODEL (prevent duplicate swipes)
// ============================================================
const swipeSchema = new mongoose.Schema({
  swiper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  swiped: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['like', 'skip', 'superlike'], required: true },
  createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 }, // 30 days TTL
});

swipeSchema.index({ swiper: 1, swiped: 1 }, { unique: true });

const Swipe = mongoose.model('Swipe', swipeSchema);

module.exports = { Match, Message, Swipe };
