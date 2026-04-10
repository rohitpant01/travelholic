const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  images: [{ type: String }], // Cloudflare R2 Public URLs
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [longitude, latitude]
  },
  placeName: { type: String, trim: true, default: '' },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  visibility: { 
    type: String, 
    enum: ['nearby', 'friends', 'global'], 
    default: 'global' 
  },
  allowAIItinerary: { 
    type: Boolean, 
    default: true 
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Optimization Indexes
postSchema.index({ location: '2dsphere' }); // For Nearby feed
postSchema.index({ userId: 1 });
postSchema.index({ createdAt: -1 }); // For Global feed

module.exports = mongoose.model('Post', postSchema);
