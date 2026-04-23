const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: [
      'suspend_user',
      'unsuspend_user',
      'warn_user',
      'delete_content',
      'restore_content',
      'resolve_report',
      'promote_user',
      'demote_user',
      'ban_user',
      'unban_user',
      'auto_hide_content',
      'recalculate_trust',
      'mass_report_detected'
    ],
    required: true
  },
  targetType: {
    type: String,
    enum: ['user', 'post', 'comment', 'report'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient log queries
moderationLogSchema.index({ createdAt: -1 });
moderationLogSchema.index({ action: 1 });
moderationLogSchema.index({ targetId: 1 });

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
