const axios = require('axios');

/**
 * Controller to handle image proxying from backend to frontend
 * This keeps API keys secure on Render and reduces frontend complexity
 */

// API Keys from environment
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

/**
 * Fetch a random travel image for landing/home screens
 */
exports.getRandomImage = async (req, res) => {
  const { count = 1, query = 'travel landscape' } = req.query;

  // 1. Try Unsplash (Primary)
  if (UNSPLASH_ACCESS_KEY) {
    try {
      const response = await axios.get('https://api.unsplash.com/photos/random', {
        params: { query, count, orientation: 'landscape' },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      });

      const results = Array.isArray(response.data) ? response.data : [response.data];
      return res.json(results.map(img => ({
        name: img.location?.city || img.location?.title || 'Adventure',
        image: img.urls.regular,
        source: 'Unsplash'
      })));
    } catch (error) {
      console.error('[ImageController] Unsplash failed:', error.message);
    }
  }

  // 2. Try Pexels (Fallback)
  if (PEXELS_API_KEY) {
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: { query, per_page: count },
        headers: { Authorization: PEXELS_API_KEY }
      });

      if (response.data.photos?.length > 0) {
        return res.json(response.data.photos.map(p => ({
          name: 'Adventure',
          image: p.src.large2x,
          source: 'Pexels'
        })));
      }
    } catch (error) {
      console.error('[ImageController] Pexels failed:', error.message);
    }
  }

  // 3. Static Fail-safe Fallback (Picsum)
  const fallbacks = [
    { name: 'Taj Mahal', image: 'https://picsum.photos/id/1018/1000/600' },
    { name: 'Kerala Backwaters', image: 'https://picsum.photos/id/1015/1000/600' },
    { name: 'Jaipur Palaces', image: 'https://picsum.photos/id/1016/1000/600' },
    { name: 'Leh Ladakh', image: 'https://picsum.photos/id/1019/1000/600' },
    { name: 'Goa Beaches', image: 'https://picsum.photos/id/1020/1000/600' }
  ];
  
  const selected = [];
  for(let i=0; i<count; i++) {
    selected.push(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  }

  res.json(selected.map(f => ({ ...f, source: 'Picsum' })));
};

/**
 * Fetch a specific place image
 */
exports.getPlaceImage = async (req, res) => {
  const { query } = req.params;
  const searchQuery = `${query} travel`;

  // Try Unsplash
  if (UNSPLASH_ACCESS_KEY) {
    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: { query: searchQuery, per_page: 1, orientation: 'landscape' },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      });
      if (response.data.results?.[0]) {
        return res.json({ image: response.data.results[0].urls.regular, source: 'Unsplash' });
      }
    } catch (e) {}
  }

  // Try Pexels
  if (PEXELS_API_KEY) {
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: { query: searchQuery, per_page: 1 },
        headers: { Authorization: PEXELS_API_KEY }
      });
      if (response.data.photos?.[0]) {
        return res.json({ image: response.data.photos[0].src.large2x, source: 'Pexels' });
      }
    } catch (e) {}
  }

  // Final Picsum placeholder
  res.json({ image: `https://picsum.photos/seed/${encodeURIComponent(query)}/1000/600`, source: 'Picsum' });
};
