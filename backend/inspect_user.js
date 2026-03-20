require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const fetch = require('node-fetch');

const inspectUser = async () => {
  const phone = process.argv[2];
  if (!phone) {
    console.log('Usage: node inspect_user.js <phone>');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ phone });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    console.log(`[USER] Name: ${user.fullName}`);
    console.log(`[USER] Verified: ${user.isPhotoVerified}`);
    
    const profilePhoto = user.photos.find(p => p.isProfile) || user.photos[0];
    console.log(`[PHOTO] Profile URL: ${profilePhoto?.url}`);
    console.log(`[PHOTO] Last Selfie URL: ${user.verificationSelfieUrl}`);

    if (profilePhoto && profilePhoto.url) {
      console.log(`[FETCH] Checking Profile Photo...`);
      const res = await fetch(profilePhoto.url);
      console.log(`[FETCH] Status: ${res.status}, Type: ${res.headers.get('content-type')}`);
    } else {
      console.log(`[FETCH] SKIP Profile Photo (No URL)`);
    }

    if (user.verificationSelfieUrl) {
      console.log(`[FETCH] Checking Selfie...`);
      const res = await fetch(user.verificationSelfieUrl);
      console.log(`[FETCH] Status: ${res.status}, Type: ${res.headers.get('content-type')}`);
    } else {
      console.log(`[FETCH] SKIP Selfie (No URL)`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

inspectUser();
