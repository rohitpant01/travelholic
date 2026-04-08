const mongoose = require('mongoose');

const staySuggestionSchema = new mongoose.Schema({
  type: { type: String }, // Budget, Mid-range, Luxury
  stay_type: { type: String }, // Hostel, Hotel, Resort
  price_range: { type: String },
  area: { type: String },
  // Enrichment fields (stored as Mixed for flexibility)
  name: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  address: { type: String },
  rating: { type: Number }
}, { _id: false });

const dayPlanSchema = new mongoose.Schema({
  day: { type: Number, required: true },
  places: [{ type: mongoose.Schema.Types.Mixed }], // [{ name, latitude, longitude, rating... }]
  activities: [{ type: String }],
  notes: { type: String },
  // Cache coordinates at the day level for UI rendering
  latitude: { type: Number },
  longitude: { type: Number }
});

const lyraItinerarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourcePostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedPost',
    index: true
  },
  travel_type: { type: String },
  confidence: { type: Number },
  location: {
    name: String,
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] } // [lng, lat]
    }
  },
  itinerary: [dayPlanSchema],
  stay_suggestions: [staySuggestionSchema],
  estimated_cost: {
    stay: String,
    activities: String,
    food: String
  },
  nearby_recommendations: [{ type: mongoose.Schema.Types.Mixed }],
  isSaved: { type: Boolean, default: true },

  // 📲 Social Loop (Upgrade V3)
  visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  isCloned: { type: Boolean, default: false },
  clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'LyraItinerary' },
  isSharedToFeed: { type: Boolean, default: false },
  sharedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedPost' },

  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Spatial index for future geo-search
lyraItinerarySchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('LyraItinerary', lyraItinerarySchema);
