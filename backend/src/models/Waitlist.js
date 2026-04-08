const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'web_teaser'
  }
});

module.exports = mongoose.model('Waitlist', waitlistSchema);
