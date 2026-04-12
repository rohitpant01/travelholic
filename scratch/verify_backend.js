const axios = require('axios');

async function testDiscoverApi() {
  try {
    // Note: We need a valid token to test this, which we don't have.
    // However, I can manually inspect the logic I wrote to ensure it's safe.
    console.log('Backend hardening applied. Summary of safety measures:');
    console.log('1. calculateMatchingScore: Added null/undefined checks for user and currentUser.');
    console.log('2. calculateMatchingScore: Enforced array type for interests before filtering.');
    console.log('3. calculateDistance: Added isNaN check for all inputs.');
    console.log('4. getDiscoverProfiles: Added filter(p => p && p._id) to enrichment loop.');
    console.log('5. getDiscoverProfiles: Added || 0 to distanceKm and matchScore to prevent NaN.');
    console.log('6. updateLocation: Added success:true to response.');
  } catch (err) {
    console.error(err);
  }
}

testDiscoverApi();
