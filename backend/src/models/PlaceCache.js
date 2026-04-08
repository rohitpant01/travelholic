const mongoose = require('mongoose');

const PlaceCacheSchema = new mongoose.Schema({
  query: {
    type: String
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  radius: {
    type: Number,
    required: true
  },
  results: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  locationName: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 hours (in seconds)
  }
});

// Compound index for efficient lookup within a geographical bucket
PlaceCacheSchema.index({ query: 1, lat: 1, lng: 1 });

module.exports = mongoose.model('PlaceCache', PlaceCacheSchema);
