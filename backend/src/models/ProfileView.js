const mongoose = require('mongoose');

const profileViewSchema = new mongoose.Schema({
  viewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  viewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
    index: { expires: '30d' }, // Automatically delete after 30 days to keep DB lean
  },
});

// Ensure a single user viewing another doesn't create endless duplicates in 24h
profileViewSchema.index({ viewer: 1, viewee: 1, viewedAt: -1 });

module.exports = mongoose.model('ProfileView', profileViewSchema);
