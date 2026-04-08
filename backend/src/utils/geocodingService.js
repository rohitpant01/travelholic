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

/**
 * Convert coordinates into a city/country via Google Reverse Geocoding API
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<any>}
 */
const reverseGeocode = async (lat, lng) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await axios.get(url);

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      return response.data.results[0];
    }
    
    console.warn(`[REVERSE-GEOCODE] No results. Status: ${response.data.status}`);
    return null;
  } catch (error) {
    console.error('[REVERSE-GEOCODE ERROR]', error.message);
    return null;
  }
};

module.exports = { geocodeAddress, reverseGeocode };
