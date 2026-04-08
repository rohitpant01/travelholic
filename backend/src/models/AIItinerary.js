const mongoose = require('mongoose');

const aiItinerarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  destination: { type: String, required: true },
  coordinates: {
    lat: Number,
    lng: Number
  },
  days: { type: Number },
  budget: { type: String },
  interests: { type: String },
  travelType: { type: String },
  startLocation: { type: String },
  
  // Full Itinerary Data
  roadmap: { type: String },
  estimated_total_cost: { type: String },
  itinerary: [{
    day: String,
    daily_insight: String,
    plan: [{
      time: String,
      place: String,
      description: String,
      lat: Number,
      lng: Number,
      cost: String,
      travel_time: String,
      distance: String
    }],
    stay_recommendations: [{
      name: String,
      area: String,
      price_per_night: String,
      description: String,
      image: String,
      lat: Number,
      lng: Number,
      rating: Number
    }]
  }],
  stay_recommendations: [{
    name: String,
    area: String,
    price_per_night: String,
    description: String,
    image: String,
    lat: Number,
    lng: Number,
    rating: Number
  }],
  how_to_reach: { type: String },
  best_time_to_visit: { type: String },
  travel_tips: [String],
  why_to_visit: [String],
  
  // Persistence & Social
  isSaved: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: false },
  publishedPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('AIItinerary', aiItinerarySchema);
