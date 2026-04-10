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
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },

  // Verification
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isPhotoVerified: { type: Boolean, default: false },
  verificationSelfieUrl: String,
  otp: String,
  otpExpiry: Date,
  emailOtp: String,
  emailOtpExpiry: Date,

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
  maxDiscoveryDistance: { type: Number, default: 200, min: 10, max: 500 }, // km

  // Travel Plan
  origin: {
    city: String,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    }
  },
  destination: {
    city: String,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    }
  },
  travelDate: { type: Date },

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
  lastSeenPrivacy: { 
    type: String, 
    enum: ['everyone', 'matches', 'nobody'], 
    default: 'everyone' 
  },
  activityStatus: {
    type: String,
    enum: ['Online', 'Planning Trip', 'Exploring', 'Traveling'],
    default: 'Online'
  },
  visibilityStatus: {
    type: String,
    enum: ['public', 'ghost'],
    default: 'public'
  },
  
  // Deletion tracking
  isDeleted: { type: Boolean, default: false },
  deletionScheduledAt: { type: Date },

  // Push notifications
  devices: [{
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web', 'other'], default: 'other' },
    deviceId: String,
    lastUsed: { type: Date, default: Date.now }
  }],

  // Membership
  memberStatus: {
    type: String,
    enum: ['Free', 'Explorer', 'Premium', 'Elite'],
    default: 'Free'
  },

  // Travel History
  completedTrips: [{
    origin: { city: String },
    destination: { city: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    duration: Number, // in days
    details: String,
    createdAt: { type: Date, default: Date.now }
  }],

  // Social
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
 
  // Saved Content
  savedDestinations: [{
    id: String,
    title: String,
    image: String,
    location: String,
    description: String,
    rating: { type: Number, default: 0 },
    budget: String,
    bestTime: String,
    tags: [String],
    whyLoveThis: [String],
    nearestAirport: String,
    nearestCity: String,
    travelTip: String,
    lat: Number,
    lng: Number,
    savedAt: { type: Date, default: Date.now }
  }],

  // 🧠 Travel Memory (Lyra Learning)
  travelMemory: {
    preferences: {
      budget: { type: String, enum: ['Budget', 'Mid-range', 'Luxury', 'Any'], default: 'Any' },
      interests: [String],
      preferredPace: { type: String, enum: ['Relaxed', 'Balanced', 'Fast'], default: 'Balanced' }
    },
    savedItineraryCount: { type: Number, default: 0 },
    lastAiPlaformUsed: { type: Date },
    lyraGenerationTimestamps: { type: [Date], default: [] }
  },

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
  
  // Explicitly ensure these exist even if defaults or undefined
  return {
    _id: obj._id,
    firstName: obj.firstName,
    lastName: obj.lastName,
    username: obj.username,
    email: obj.email,
    phone: obj.phone,
    isEmailVerified: obj.isEmailVerified,
    isPhoneVerified: obj.isPhoneVerified,
    isPhotoVerified: obj.isPhotoVerified,
    registrationStep: obj.registrationStep,
    authProvider: obj.authProvider,
    googleId: obj.googleId,
    photos: obj.photos,
    interests: obj.interests,
    languages: obj.languages,
    lookingFor: obj.lookingFor,
    location: obj.location,
    city: obj.city,
    country: obj.country,
    hometown: obj.hometown,
    bio: obj.bio || '',
    dob: obj.dob,
    age: obj.age,
    gender: obj.gender,
    pronouns: obj.pronouns,
    lastVisitedPlace: obj.lastVisitedPlace || '',
    dreamDestination: obj.dreamDestination || '',
    countriesVisited: obj.countriesVisited || [],
    origin: obj.origin,
    destination: obj.destination,
    travelDate: obj.travelDate,
    activityStatus: obj.activityStatus,
    lastSeen: obj.lastSeen,
    isOnline: obj.isOnline,
    profileComplete: obj.profileComplete,
    memberStatus: obj.memberStatus,
    likesReceived: obj.likesReceived,
    matchesCount: obj.matchesCount,
    tripsCompleted: obj.tripsCompleted,
    completedTrips: obj.completedTrips || [],
    savedDestinations: obj.savedDestinations || [],
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
