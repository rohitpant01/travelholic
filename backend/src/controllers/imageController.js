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

const BACKEND_URL = process.env.BACKEND_URL || 'https://travelholic-zsqn.onrender.com';

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
  for (let i = 0; i < count; i++) {
    selected.push(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  }

  res.json(selected.map(f => ({ ...f, source: 'Picsum' })));
};

/**
 * Fetch a BATCH of distinct images for a place in a single request.
 *
 * Root cause of the "all images are the same" bug:
 *   The old frontend called GET /images/place/:query N times with v=0,1,2…
 *   Each call made its own Google Places text-search → same top result →
 *   same photo_reference → same image every time.
 *
 * Fix: do the text-search ONCE here, collect ALL photo references from the
 * top results, deduplicate them, then hand out N distinct proxy URLs.
 *
 * Route: GET /api/images/place/:query/batch?count=4
 * Returns: { images: string[], source: string }
 */
exports.getPlaceImagesBatch = async (req, res) => {
  const { query } = req.params;
  const count = Math.min(parseInt(req.query.count, 10) || 3, 10); // cap at 10
  const searchQuery = `${query} travel`;

  // ── 1. Google Places (primary) ────────────────────────────────────────────
  if (GOOGLE_PLACES_API_KEY) {
    try {
      // 1a. Initial search (Top 20 results)
      const gRes = await axios.get(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
        { params: { query: searchQuery, key: GOOGLE_PLACES_API_KEY } }
      );

      let results = gRes.data.results || [];
      const allRefs = [];
      const seen = new Set();

      // Collect as many unique photo references as possible
      for (const place of results.slice(0, 20)) {
        if (place.photos) {
          place.photos.forEach(p => {
            if (p.photo_reference && !seen.has(p.photo_reference)) {
              seen.add(p.photo_reference);
              allRefs.push(p.photo_reference);
            }
          });
        }
      }

      // Shuffle Google Refs (Fisher-Yates)
      for (let i = allRefs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allRefs[i], allRefs[j]] = [allRefs[j], allRefs[i]];
      }

      let finalImages = allRefs.map(ref => 
        `${BACKEND_URL}/api/images/google-photo?ref=${ref}&t=${Date.now()}`
      );

      // ── 2. Mix in Fallbacks if needed (Unsplash) ──────────────────────────
      if (finalImages.length < count && UNSPLASH_ACCESS_KEY) {
        try {
          const uRes = await axios.get('https://api.unsplash.com/search/photos', {
            params: { query: searchQuery, per_page: 15, orientation: 'landscape' },
            headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
          });
          const uResults = uRes.data.results || [];
          uResults.forEach(r => {
            if (finalImages.length < count * 2) { // don't overfill
               finalImages.push(r.urls.regular);
            }
          });
        } catch (e) {
          console.warn('[ImageController] Mixed fallback failed:', e.message);
        }
      }

      if (finalImages.length > 0) {
        // Final Shuffle of the mixed result
        for (let i = finalImages.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [finalImages[i], finalImages[j]] = [finalImages[j], finalImages[i]];
        }

        const selection = finalImages.slice(0, count);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.json({ images: selection, source: 'Mixed/Google/Unsplash' });
      }
    } catch (e) {
      console.error('[ImageController] Production batch failed:', e.message);
    }
  }

  // ── 3. Last Resort: Picsum seeds ──────────────────────────────────────────
  const images = Array.from({ length: count }, (_, i) =>
    `https://picsum.photos/seed/${encodeURIComponent(query)}-${i}-${Date.now()}/1000/600`
  );
  return res.json({ images, source: 'Picsum' });
};

/**
 * Fetch a specific place image (single, used by detail screens etc.)
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

  const sendRes = (imgUrl, source) => {
    if (req.query.redirect === 'true') return res.redirect(imgUrl);
    return res.json({ image: imgUrl, source });
  };

  // 2. Try Google Places Search
  if (GOOGLE_PLACES_API_KEY) {
    try {
      const gRes = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: { query: searchQuery, key: GOOGLE_PLACES_API_KEY }
      });

      const results = gRes.data.results || [];
      if (results.length > 0) {
        const allPhotos = [];
        results.slice(0, 3).forEach(r => {
          if (r.photos) r.photos.forEach(p => allPhotos.push(p.photo_reference));
        });

        if (allPhotos.length > 0) {
          const photoRef = allPhotos[imgIdx % allPhotos.length];
          const finalUrl = `${BACKEND_URL}/api/images/google-photo?ref=${photoRef}`;
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return sendRes(finalUrl, 'Google Places');
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
        return sendRes(results[imgIdx % results.length].urls.regular, 'Unsplash');
      }
    } catch (e) { }
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
        return sendRes(photos[imgIdx % photos.length].src.large2x, 'Pexels');
      }
    } catch (e) { }
  }

  // Final Picsum placeholder
  sendRes(`https://picsum.photos/seed/${encodeURIComponent(query)}-${imgIdx}/1000/600`, 'Picsum');
};

/**
 * Handle direct Google Photo redirection (Privacy Proxy)
 */
exports.getGooglePhoto = async (req, res) => {
  const { ref } = req.query;
  if (!ref || !GOOGLE_PLACES_API_KEY) {
    return res.status(400).send('Missing photo reference or API key');
  }
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1000&photoreference=${ref}&key=${GOOGLE_PLACES_API_KEY}`;
  res.redirect(url);
};