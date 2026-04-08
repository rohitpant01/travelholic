const mongoose = require('mongoose');

const globalDestinationSchema = new mongoose.Schema({
  destinations: [{ type: mongoose.Schema.Types.Mixed }],
  previousTitles: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GlobalDestination', globalDestinationSchema);
