const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  type: {
    type: String,
    enum: ['user', 'group', 'post', 'comment'],
    required: true
  },
  reason: {
    type: String,
    enum: ['spam', 'inappropriate', 'harassment', 'fake_info', 'hate_speech',
           'violence', 'nudity', 'scam', 'impersonation', 'other',
           'fake_location', 'scam_listing', 'unsafe_place'],
    required: true
  },
  details: {
    type: String,
    default: '',
    maxlength: 500
  },

  // Weighted scoring
  reporterTrustScore: { type: Number, default: 50 },
  weight: { type: Number, default: 1.0 },

  // Status flow
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },

  // Admin resolution
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolution: {
    type: String,
    enum: ['dismissed', 'warned', 'content_removed', 'user_suspended', 'user_banned']
  },
  adminNotes: { type: String, default: '' },

  // Reporter notification tracking
  reporterResponse: {
    type: String,
    enum: ['content_removed', 'no_violation', 'action_taken', 'pending'],
    default: 'pending'
  },
  reporterNotified: { type: Boolean, default: false }
}, {
  timestamps: true
});

// CRITICAL: One user can report a specific target only once
reportSchema.index({ reportedBy: 1, targetId: 1, type: 1 }, { unique: true });
// Aggregate reports per target for threshold checking
reportSchema.index({ targetId: 1, type: 1, status: 1 });
// Admin queue: pending reports sorted by date
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
