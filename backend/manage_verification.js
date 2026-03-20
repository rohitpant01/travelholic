require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const manageVerification = async () => {
  const phone = process.argv[2];
  const action = process.argv[3] || 'unverify'; // 'verify' or 'unverify'

  if (!phone) {
    console.log('❌ Please provide a phone number: node manage_verification.js <phone> [verify/unverify]');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ Connected to DB. Looking for user with phone: ${phone}`);
    
    const user = await User.findOne({ phone });
    
    if (!user) {
      console.log(`❓ No user found with phone: ${phone}`);
      process.exit(1);
    }

    const setVerified = action === 'verify';
    user.isPhotoVerified = setVerified;
    await user.save();

    console.log(`✨ Successfully ${setVerified ? 'VERIFIED' : 'UNVERIFIED'} user: ${user.fullName} (${user.email})`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error managing verification:', error.message);
    process.exit(1);
  }
};

manageVerification();
