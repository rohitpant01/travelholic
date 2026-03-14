require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const clearUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB to clear users...');
    
    const result = await User.deleteMany({});
    console.log(`🗑️ Successfully deleted ${result.deletedCount} users.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing users:', error.message);
    process.exit(1);
  }
};

clearUsers();
