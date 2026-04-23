const axios = require('axios');

/**
 * Controller to handle image proxying from backend to frontend
 * This keeps API keys secure on Render and reduces frontend complexity
 */

// API Keys from environment
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

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
  const { photoReference, v = 0 } = req.query; 
  const imgIdx = parseInt(v, 10) || 0;
  
  // 1. If direct reference provided, proxy it immediately
  if (photoReference && GOOGLE_PLACES_API_KEY) {
    return res.redirect(`https://maps.googleapis.com/maps/api/place/photo?maxwidth=1000&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`);
  }

  const searchQuery = `${query} travel`;

  // Helper for response
  const sendRes = (imgUrl, source) => {
    if (req.query.redirect === 'true') {
      return res.redirect(imgUrl);
    }
    return res.json({ image: imgUrl, source });
  };

  // 2. Try Google Places Search (Fresh & High Quality)
  if (GOOGLE_PLACES_API_KEY) {
    try {
      const gRes = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: { query: searchQuery, key: GOOGLE_PLACES_API_KEY }
      });
      
      const results = gRes.data.results || [];
      if (results.length > 0) {
        // Try to get different photos from the first result first
        const firstResultPhotos = results[0].photos || [];
        if (firstResultPhotos.length > 0) {
          const photoRef = firstResultPhotos[imgIdx % firstResultPhotos.length]?.photo_reference;
          if (photoRef) {
            const finalUrl = `${process.env.BACKEND_URL || 'https://travelholic-zsqn.onrender.com'}/api/images/google-photo?ref=${photoRef}`;
            return sendRes(finalUrl, 'Google Places');
          }
        }
        
        // Fallback: If first result has no photos or we want more variety, try the next result
        const secondResultPhoto = results[1]?.photos?.[0]?.photo_reference;
        if (secondResultPhoto && imgIdx > 0) {
           const finalUrl = `${process.env.BACKEND_URL || 'https://travelholic-zsqn.onrender.com'}/api/images/google-photo?ref=${secondResultPhoto}`;
           return sendRes(finalUrl, 'Google Places (Alt)');
        }
      }
    } catch (e) {
      console.error('[ImageController] Google Places search failed:', e.message);
    }
  }

  // 3. Try Unsplash
  if (UNSPLASH_ACCESS_KEY) {
    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: { query: searchQuery, per_page: 10, orientation: 'landscape' },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      });
      const results = response.data.results || [];
      if (results.length > 0) {
        const selected = results[imgIdx % results.length];
        return sendRes(selected.urls.regular, 'Unsplash');
      }
    } catch (e) {}
  }

  // 4. Try Pexels
  if (PEXELS_API_KEY) {
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: { query: searchQuery, per_page: 10 },
        headers: { Authorization: PEXELS_API_KEY }
      });
      const photos = response.data.photos || [];
      if (photos.length > 0) {
        const selected = photos[imgIdx % photos.length];
        return sendRes(selected.src.large2x, 'Pexels');
      }
    } catch (e) {}
  }

  // Final Picsum placeholder with variety via seed
  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(query)}-${imgIdx}/1000/600`;
  sendRes(fallbackUrl, 'Picsum');
};

/**
 * Handle direct Google Photo redirection (Privacy Proxy)
 */
exports.getGooglePhoto = async (req, res) => {
  const { ref } = req.query;
  if (!ref || !GOOGLE_PLACES_API_KEY) {
    return res.status(400).send('Missing photo reference or API key');
  }
  // Redirect to Google API (browser will follow and load the image)
  // This keeps the key on the server side
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1000&photoreference=${ref}&key=${GOOGLE_PLACES_API_KEY}`;
  res.redirect(url);
};
