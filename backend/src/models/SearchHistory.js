const mongoose = require('mongoose');

const SearchHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  placeIds: [{
    type: String,
    required: true
  }],
  lastSearchedAt: {
    type: Date,
    default: Date.now,
    expires: 604800 // 7 days in seconds
  }
});

// Unique index per user to handle updates efficiently
SearchHistorySchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('SearchHistory', SearchHistorySchema);
