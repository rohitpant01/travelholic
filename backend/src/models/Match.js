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
  isActive: { type: Boolean, default: true },
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
  type: { type: String, enum: ['text', 'image'], default: 'text' },
  isRead: { type: Boolean, default: false },
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
