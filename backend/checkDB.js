require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/travelbuddy')
  .then(async () => {
    const users = await User.find({}, 'email googleId phone registrationStep createdAt');
    console.log(`Found ${users.length} users in DB:`);
    users.forEach(u => console.log(`- Email: ${u.email} | GoogleID: ${u.googleId} | Phone: ${u.phone} | Step: ${u.registrationStep} | Created: ${u.createdAt}`));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
