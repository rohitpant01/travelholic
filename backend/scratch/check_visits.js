const mongoose = require('mongoose');
require('dotenv').config();
const ProfileVisit = require('../src/models/ProfileVisit');
const User = require('../src/models/User');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await ProfileVisit.countDocuments();
    console.log('Total ProfileVisits:', count);
    const latest = await ProfileVisit.find().sort({ createdAt: -1 }).limit(5);
    console.log('Latest Visits:', JSON.stringify(latest, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
