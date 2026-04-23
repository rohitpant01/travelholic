const mongoose = require('mongoose');
require('dotenv').config();
const Report = require('../src/models/Report');
const User = require('../src/models/User');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const reports = await Report.find().sort({ createdAt: -1 }).limit(10);
    for (const r of reports) {
      const targetExists = await User.findById(r.targetId);
      console.log(`Report ID: ${r._id}, TargetID: ${r.targetId}, TargetExists: ${!!targetExists}, Snapshot:`, JSON.stringify(r.targetSnapshot, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
