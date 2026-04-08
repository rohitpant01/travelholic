const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../backend/.env' });

const JWT_SECRET = process.env.JWT_SECRET || 'f6f1d3b450866257814d0f1f6184c9df696b6e5a7e25b3052e51dfb87afc8801c1fef3bf8efc032fb08574c6134dbb7f6408c8c6928ed020d4937f7ae5179cf0';

// Generate a dummy token for testing (assuming the middleware only checks validity and presence of id)
const token = jwt.sign({ id: '65842898c8c8c8c8c8c8c8c8' }, JWT_SECRET, { expiresIn: '1h' });

const testSearch = async () => {
  try {
    console.log('--- Testing Nearby Place Search (Romantic) ---');
    const res = await axios.get('http://localhost:5001/api/places/search', {
      params: {
        query: 'romantic places',
        lat: 28.6139, // New Delhi
        lng: 77.2090
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Status:', res.status);
    console.log('Count:', res.data.count);
    console.log('First Result:', JSON.stringify(res.data.results[0], null, 2));

    console.log('\n--- Testing Nearby Place Search (Nature) ---');
    const res2 = await axios.get('http://localhost:5001/api/places/search', {
      params: {
        query: 'nature spots',
        lat: 28.6139,
        lng: 77.2090
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Status:', res2.status);
    console.log('Count:', res2.data.count);
    
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
};

testSearch();
