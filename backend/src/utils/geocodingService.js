const axios = require('axios');

/**
 * Convert a city/country string into coordinates via Google Geocoding API
 * @param {string} address - The address, city, or country to geocode
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
const geocodeAddress = async (address) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!address || !apiKey) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await axios.get(url);

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry.location;
      return { lat, lng };
    }
    
    console.warn(`[GEOCODE] No results for: ${address}. Status: ${response.data.status}`);
    return null;
  } catch (error) {
    console.error('[GEOCODE ERROR]', error.message);
    return null;
  }
};

module.exports = { geocodeAddress };
