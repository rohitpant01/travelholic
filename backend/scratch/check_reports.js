const mongoose = require('mongoose');
require('dotenv').config();
const Report = require('../src/models/Report');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const reports = await Report.find().sort({ createdAt: -1 }).limit(5);
    reports.forEach(r => {
      console.log(`Report ID: ${r._id}, Type: ${r.type}, Snapshot:`, JSON.stringify(r.targetSnapshot, null, 2));
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
