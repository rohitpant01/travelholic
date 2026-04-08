const mongoose = require('mongoose');

const TopDestinationSchema = new mongoose.Schema({
  destinations: [Object],
  previousTitles: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TopDestination', TopDestinationSchema);
