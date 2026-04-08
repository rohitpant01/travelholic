require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { geocodeAddress } = require('../src/utils/geocodingService');

const fixUserCoordinates = async () => {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected.');

    // Find users at 0,0 who have a city or country
    const usersToFix = await User.find({
      $or: [
        { 'location.coordinates.0': 0 },
        { location: null },
        { 'location.coordinates': { $exists: false } }
      ],
      $or: [
        { city: { $exists: true, $ne: '' } },
        { country: { $exists: true, $ne: '' } }
      ]
    });

    console.log(`🔍 Found ${usersToFix.length} users to fix.`);

    for (const user of usersToFix) {
      const address = `${user.city || ''}, ${user.country || ''}`.trim().replace(/^,|,$/g, '');
      if (!address) continue;

      console.log(`📍 Geocoding for ${user.firstName} (${user.username}): "${address}"...`);
      const result = await geocodeAddress(address);

      if (result) {
        user.location = {
          type: 'Point',
          coordinates: [result.lng, result.lat],
          city: user.city || '',
          country: user.country || '',
          formattedAddress: address
        };
        await user.save({ validateBeforeSave: false });
        console.log(`✅ Fixed: ${result.lat}, ${result.lng}`);
      } else {
        console.warn(`❌ Could not geocode: ${address}`);
      }
    }

    console.log('\n✨ Batch fix complete.');
    process.exit(0);
  } catch (err) {
    console.error('💥 Error during batch fix:', err);
    process.exit(1);
  }
};

fixUserCoordinates();
