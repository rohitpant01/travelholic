const mongoose = require('mongoose');

// ============================================================
// TRIP MODEL
// ============================================================
const tripSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: { type: String, default: '' },
  groupIcon: { type: String, default: null },
  source: {
    city: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  destination: {
    city: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
  },
  date: { type: Date, required: true },
  endDate: { type: Date },
  mode: {
    type: String,
    enum: ['flight', 'train', 'car', 'bus', 'bike', 'other'],
    default: 'other',
  },
  budget: {
    type: String,
    enum: ['Budget', 'Mid-range', 'Luxury'],
    default: 'Budget',
  },
  travelType: {
    type: String,
    enum: ['Solo', 'Group', 'Couples'],
    default: 'Group',
  },
  tags: [{
    type: String,
    enum: [
      'Adventure', 'Food', 'Spiritual', 'Cultural', 'Nightlife',
      'Photography', 'Trekking', 'Beach', 'Road Trip', 'Backpacking',
      'Wildlife', 'Wellness', 'Historical', 'Camping',
    ],
  }],
  maxTravelers: { type: Number, default: 10, min: 2, max: 50 },
  description: { type: String, maxlength: 500, default: '' },
  genderPreference: {
    type: String,
    enum: ['Male', 'Female', 'Any'],
    default: 'Any',
  },
  isActive: { type: Boolean, default: true },
  membersCount: { type: Number, default: 1 }, // starts with creator
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

tripSchema.index({ date: 1 });
tripSchema.index({ 'source.location': '2dsphere' });
tripSchema.index({ 'destination.location': '2dsphere' });
tripSchema.index({ creator: 1 });
tripSchema.index({ isActive: 1, date: 1 });

// ============================================================
// TRIP MEMBER MODEL
// ============================================================
const tripMemberSchema = new mongoose.Schema({
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  message: { type: String, maxlength: 300, default: '' }, // join request message
  unreadCount: { type: Number, default: 0 },
  isPinned: { type: Boolean, default: false },
  isMuted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

tripMemberSchema.index({ trip: 1, user: 1 }, { unique: true });
tripMemberSchema.index({ trip: 1, status: 1 });
tripMemberSchema.index({ user: 1, status: 1 });

// ============================================================
// TRIP MESSAGE MODEL (Group Chat)
// ============================================================
const tripMessageSchema = new mongoose.Schema({
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: { type: String, default: '' },
  type: {
    type: String,
    enum: ['text', 'image', 'voice', 'location', 'itinerary', 'expense', 'system'],
    default: 'text',
  },
  imageUrl: { type: String, default: null },
  imagePublicId: { type: String, default: null },
  voiceUrl: { type: String, default: null },
  voicePublicId: { type: String, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  tempId: { type: String, default: null }, // For frontend deduplication
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'TripMessage', default: null },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }],
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['normal', 'high'],
    default: 'high',
  },
  deliveryAttempts: {
    type: Number,
    default: 0,
  },
  edited: { type: Boolean, default: false },
  expenseData: {
    title: String,
    amount: Number,
    currency: { type: String, default: 'INR' },
    splitBetween: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  isDeleted: { type: Boolean, default: false },
}, {
  timestamps: true,
});

tripMessageSchema.index({ trip: 1, createdAt: -1 });

const Trip = mongoose.model('Trip', tripSchema);
const TripMember = mongoose.model('TripMember', tripMemberSchema);
const TripMessage = mongoose.model('TripMessage', tripMessageSchema);

module.exports = { Trip, TripMember, TripMessage };
