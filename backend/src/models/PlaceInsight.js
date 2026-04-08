const mongoose = require('mongoose');

const GemSchema = new mongoose.Schema({
  name: String,
  story: String,
  rating: Number,
  lat: Number,
  lng: Number
}, { _id: false });

const PlaceInsightSchema = new mongoose.Schema({
  placeName: { type: String, required: true, unique: true },
  how_to_reach: { type: String },
  travel_tips: [{ type: String }],
  why_to_visit: [{ type: String }],
  nearby_places: [GemSchema]
}, { timestamps: true });

module.exports = mongoose.model('PlaceInsight', PlaceInsightSchema);
