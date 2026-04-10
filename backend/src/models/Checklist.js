const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  category: {
    type: String,
    enum: ['Essentials', 'Clothing', 'Electronics', 'Documents', 'Toiletries', 'Others'],
    default: 'Others',
  },
});

const checklistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    default: null,
  },
  title: {
    type: String,
    required: [true, 'Checklist title is required'],
    trim: true,
  },
  tripType: {
    type: String,
    enum: ['General', 'Beach', 'Trek', 'International', 'Business', 'Solo'],
    default: 'General',
  },
  items: [checklistItemSchema],
  isShared: {
    type: Boolean,
    default: false,
  },
  reminderDate: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Calculate progress percentage virtual
checklistSchema.virtual('progress').get(function() {
  if (!this.items || this.items.length === 0) return 0;
  const completed = this.items.filter(item => item.isCompleted).length;
  return Math.round((completed / this.items.length) * 100);
});

checklistSchema.set('toJSON', { virtuals: true });
checklistSchema.set('toObject', { virtuals: true });

checklistSchema.index({ user: 1 });
checklistSchema.index({ trip: 1 });

const Checklist = mongoose.model('Checklist', checklistSchema);

module.exports = Checklist;
