const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  isProfile: { type: Boolean, default: false },
});

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
  city: String,
  country: String,
  formattedAddress: String,
});

const userSchema = new mongoose.Schema({
  // Account Details
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true },

  // Verification
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isPhotoVerified: { type: Boolean, default: false },
  verificationSelfieUrl: String,
  otp: String,
  otpExpiry: Date,

  // Personal Details
  dob: { type: Date },
  age: { type: Number },
  gender: { type: String, enum: ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'] },
  pronouns: String,
  bio: { type: String, maxlength: 200, default: '' },

  // Location
  location: locationSchema,
  city: { type: String, default: '' },
  country: { type: String, default: '' },
  hometown: { type: String, default: '' },
  lastVisitedPlace: { type: String, default: '' },
  countriesVisited: [{ type: String }],
  dreamDestination: { type: String, default: '' },
  maxDiscoveryDistance: { type: Number, default: 50, min: 10, max: 100 }, // km

  // Photos
  photos: [photoSchema],

  // Interests & Preferences
  interests: [{
    type: String,
    enum: [
      'Mountains', 'Beaches', 'Road Trips', 'Trekking', 'Camping',
      'Photography', 'Food Travel', 'Cultural Travel', 'Adventure Sports',
      'Backpacking', 'Solo Travel', 'Cruises', 'City Tours', 
      'History & Museums', 'Nightlife', 'Wellness & Yoga', 'Wildlife Safari'
    ]
  }],
  languages: [{ type: String }],

  // Partner Preferences
  lookingFor: [{
    type: String,
    enum: ['Travel Buddy', 'Group Trip', 'Adventure Partner', 'Local Guide']
  }],
  preferredGender: {
    type: String,
    enum: ['Male', 'Female', 'Non-binary', 'Any'],
    default: 'Any'
  },
  preferredAgeMin: { type: Number, default: 18 },
  preferredAgeMax: { type: Number, default: 60 },
  budget: {
    type: String,
    enum: ['Budget', 'Mid-range', 'Luxury', 'Any'],
    default: 'Any'
  },
  tripDuration: {
    type: String,
    enum: ['Weekend', '1-2 weeks', '1 month', 'Long-term', 'Any'],
    default: 'Any'
  },

  // Activity
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  superLikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  skips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  matches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Stats
  likesReceived: { type: Number, default: 0 },
  matchesCount: { type: Number, default: 0 },
  tripsCompleted: { type: Number, default: 0 },

  // Status
  isActive: { type: Boolean, default: true },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
  profileComplete: { type: Boolean, default: false },
  registrationStep: { type: Number, default: 1 },

  // Push notifications
  pushToken: String,

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
userSchema.index({ location: '2dsphere' });


// Virtual: full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual: profile photo
userSchema.virtual('profilePhoto').get(function () {
  const profile = this.photos?.find(p => p.isProfile);
  return profile?.url || this.photos?.[0]?.url || null;
});

// Pre-save: hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Pre-save: calculate age
userSchema.pre('save', function (next) {
  if (this.dob) {
    const today = new Date();
    const birth = new Date(this.dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    this.age = age;
  }
  next();
});

// Method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method: get public profile (remove sensitive fields)
userSchema.methods.toPublicProfile = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  delete obj.likes;
  delete obj.likedBy;
  delete obj.skips;
  delete obj.blockedUsers;
  delete obj.pushToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
