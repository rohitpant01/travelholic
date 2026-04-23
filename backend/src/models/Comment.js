const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ['active', 'under_review', 'hidden', 'removed'], default: 'active' },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Optimized for feed comments fetching
commentSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
