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
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'ignored'],
    default: 'pending'
  },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
  resolution: { type: String, enum: ['dismissed', 'warned', 'content_removed', 'user_suspended'] },
  adminNotes: { type: String, default: '' }
}, {
  timestamps: true
});

reportSchema.index({ targetId: 1 });
reportSchema.index({ type: 1 });
reportSchema.index({ reportedBy: 1 });

module.exports = mongoose.model('Report', reportSchema);
