const mongoose = require('mongoose');

/**
 * ProfileVisit Schema
 * Stores history of profile views between users with a 24h duplicate window.
 */
const profileVisitSchema = new mongoose.Schema({
  viewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  profileOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: '30d' }, // Keep DB lean - auto cleanup after 30 days
  },
});

// Primary index for lookup and duplicate prevention logic
// Also supports efficient sorting by latest visits
profileVisitSchema.index({ profileOwnerId: 1, viewerId: 1, createdAt: -1 });

module.exports = mongoose.model('ProfileVisit', profileVisitSchema);
