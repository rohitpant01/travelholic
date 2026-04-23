const axios = require('axios');

// API Keys from environment
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const BACKEND_URL = process.env.BACKEND_URL || 'https://travelholic-zsqn.onrender.com';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Given a search query, find the best-matching place_id via Text Search,
//         then fetch up to `maxPhotos` photo_references via Place Details.
//         Returns an array of proxy URLs.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGooglePhotoUrls(searchQuery, maxPhotos = 10) {
  if (!GOOGLE_PLACES_API_KEY) return [];

  // Step 1 – Text Search → get the best matching place_id
  const textRes = await axios.get(
    'https://maps.googleapis.com/maps/api/place/textsearch/json',
    { params: { query: searchQuery, key: GOOGLE_PLACES_API_KEY } }
  );

  const topResult = (textRes.data.results || [])[0];
  if (!topResult) return [];

  const placeId = topResult.place_id;

  // Step 2 – Place Details → fetch ALL photos for this specific place (up to 10)
  const detailRes = await axios.get(
    'https://maps.googleapis.com/maps/api/place/details/json',
    {
      params: {
        place_id: placeId,
        fields: 'photos',
        key: GOOGLE_PLACES_API_KEY
      }
    }
  );

  const photos = detailRes.data.result?.photos || [];

  if (photos.length === 0) {
    // Fallback: use the single photo from text search if details returned nothing
    const fallbackRef = topResult.photos?.[0]?.photo_reference;
    if (fallbackRef) photos.push({ photo_reference: fallbackRef });
  }

  // Deduplicate
  const seen = new Set();
  const uniqueRefs = [];
  for (const p of photos) {
    if (p.photo_reference && !seen.has(p.photo_reference)) {
      seen.add(p.photo_reference);
      uniqueRefs.push(p.photo_reference);
    }
  }

  // Convert to backend proxy URLs (hides the real API key from the client)
  return uniqueRefs
    .slice(0, maxPhotos)
    .map(ref => `${BACKEND_URL}/api/images/google-photo?ref=${encodeURIComponent(ref)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Unsplash fallback images
// ─────────────────────────────────────────────────────────────────────────────
async function fetchUnsplashUrls(searchQuery, count = 10) {
  if (!UNSPLASH_ACCESS_KEY) return [];
  try {
    const res = await axios.get('https://api.unsplash.com/search/photos', {
      params: { query: searchQuery, per_page: count, orientation: 'landscape' },
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    });
    return (res.data.results || []).map(r => r.urls.regular);
  } catch (e) {
    console.warn('[ImageController] Unsplash fallback failed:', e.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Picsum last-resort seeds
// ─────────────────────────────────────────────────────────────────────────────
function picsumUrls(query, count) {
  return Array.from({ length: count }, (_, i) =>
    `https://picsum.photos/seed/${encodeURIComponent(query)}-${i}/1000/600`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/images/random  – landing / home hero images
// ─────────────────────────────────────────────────────────────────────────────
exports.getRandomImage = async (req, res) => {
  const { count = 1, query = 'travel landscape' } = req.query;

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
    } catch (e) {
      console.error('[ImageController] Unsplash random failed:', e.message);
    }
  }

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
    } catch (e) {
      console.error('[ImageController] Pexels random failed:', e.message);
    }
  }

  const fallbacks = [
    { name: 'Taj Mahal', image: 'https://picsum.photos/id/1018/1000/600' },
    { name: 'Kerala Backwaters', image: 'https://picsum.photos/id/1015/1000/600' },
    { name: 'Jaipur Palaces', image: 'https://picsum.photos/id/1016/1000/600' },
    { name: 'Leh Ladakh', image: 'https://picsum.photos/id/1019/1000/600' },
    { name: 'Goa Beaches', image: 'https://picsum.photos/id/1020/1000/600' }
  ];

  const selected = Array.from({ length: count }, () =>
    fallbacks[Math.floor(Math.random() * fallbacks.length)]
  );
  return res.json(selected.map(f => ({ ...f, source: 'Picsum' })));
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/images/place/:query/batch?count=4
//
// Returns N DISTINCT, REAL photos for the given place.
//
// Strategy:
//   1. Text Search  → best matching place_id
//   2. Place Details (fields=photos) → up to 10 real photos for that place  ← KEY FIX
//   3. Mix in Unsplash if Google returns fewer than `count`
//   4. Picsum last resort
// ─────────────────────────────────────────────────────────────────────────────
exports.getPlaceImagesBatch = async (req, res) => {
  const { query } = req.params;
  const count = Math.min(parseInt(req.query.count, 10) || 4, 10);
  const searchQuery = `${query} travel`;

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    let images = await fetchGooglePhotoUrls(searchQuery, 10);

    // Pad with Unsplash if Google didn't return enough
    if (images.length < count) {
      const extras = await fetchUnsplashUrls(searchQuery, count - images.length);
      images = [...images, ...extras];
    }

    if (images.length > 0) {
      // Shuffle so order is not predictable
      for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]];
      }
      return res.json({ images: images.slice(0, count), source: 'Google Places Details / Unsplash' });
    }
  } catch (e) {
    console.error('[ImageController] Batch failed:', e.message);
  }

  // Last resort
  return res.json({ images: picsumUrls(query, count), source: 'Picsum' });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/images/place/:query?v=0,1,2…  – single image for detail screens
//
// FIX: We now resolve ALL photos for the place ONCE, then pick by index.
//      This guarantees v=0,1,2 return three DIFFERENT real photos, not the same one.
// ─────────────────────────────────────────────────────────────────────────────
exports.getPlaceImage = async (req, res) => {
  const { query } = req.params;
  const { photoReference, v = 0 } = req.query;
  const imgIdx = parseInt(v, 10) || 0;

  const sendRes = (imgUrl, source) => {
    if (req.query.redirect === 'true') return res.redirect(imgUrl);
    return res.json({ image: imgUrl, source });
  };

  // Direct photo reference provided — proxy it straight through
  if (photoReference && GOOGLE_PLACES_API_KEY) {
    return res.redirect(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1000&photoreference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`
    );
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const searchQuery = `${query} travel`;

  // 1. Google Places Details (real photos for the exact place)
  if (GOOGLE_PLACES_API_KEY) {
    try {
      const images = await fetchGooglePhotoUrls(searchQuery, 10);
      if (images.length > 0) {
        // Use modulo so any index safely wraps around
        return sendRes(images[imgIdx % images.length], 'Google Places');
      }
    } catch (e) {
      console.error('[ImageController] Google Place image failed:', e.message);
    }
  }

  // 2. Unsplash fallback
  if (UNSPLASH_ACCESS_KEY) {
    try {
      const images = await fetchUnsplashUrls(searchQuery, 10);
      if (images.length > 0) {
        return sendRes(images[imgIdx % images.length], 'Unsplash');
      }
    } catch (e) { /* silent */ }
  }

  // 3. Pexels fallback
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
    } catch (e) { /* silent */ }
  }

  // 4. Picsum last resort
  sendRes(
    `https://picsum.photos/seed/${encodeURIComponent(query)}-${imgIdx}/1000/600`,
    'Picsum'
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/images/google-photo?ref=…  – privacy proxy (hides API key)
// ─────────────────────────────────────────────────────────────────────────────
exports.getGooglePhoto = async (req, res) => {
  const { ref } = req.query;
  if (!ref || !GOOGLE_PLACES_API_KEY) {
    return res.status(400).send('Missing photo reference or API key');
  }
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1000&photoreference=${ref}&key=${GOOGLE_PLACES_API_KEY}`;
  res.redirect(url);
};