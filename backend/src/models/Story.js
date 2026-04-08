const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mediaUrl: { type: String, required: true }, // Cloudinary URL
  type: { type: String, enum: ['image', 'video'], default: 'image' },
  views: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now }
  }],
  // ⏱️ Auto-expire after 24 hours
  createdAt: { 
    type: Date, 
    default: Date.now, 
    index: { expires: '24h' } 
  },
}, { timestamps: true });

module.exports = mongoose.model('Story', storySchema);
