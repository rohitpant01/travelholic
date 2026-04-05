import axios from 'axios';

// API Keys from environment or user provided
const UNSPLASH_ACCESS_KEY = process.env.EXPO_PUBLIC_UNSPLASH_ACCESS_KEY || ''; 
const PEXELS_API_KEY = process.env.EXPO_PUBLIC_PEXELS_API_KEY || '';
const PIXABAY_API_KEY = process.env.EXPO_PUBLIC_PIXABAY_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 'AIzaSyByQ5WTuSA4F-eThrkdhcAgHoJyuI8k0fs';

/**
 * Main function to fetch place images using Google Places Photo API
 */
export const fetchPlaceImage = async (query: string): Promise<string | null> => {
  // 1. Try Google Places API (Primary)
  try {
    const searchRes = await axios.get(`https://maps.googleapis.com/maps/api/place/textsearch/json`, {
      params: { query: `${query}`, key: GOOGLE_PLACES_API_KEY }
    });
    
    if (searchRes.data.results?.[0]?.photos?.[0]) {
      const photoRef = searchRes.data.results[0].photos[0].photo_reference;
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
    }
  } catch (e) {
    console.warn('[ImageService] Google Places API failed, falling back to Unsplash...');
  }

  // 2. Fallbacks
  const searchQuery = `${query} travel tourism`;
  if (UNSPLASH_ACCESS_KEY && UNSPLASH_ACCESS_KEY !== 'YOUR_UNSPLASH_ACCESS_KEY') {
    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: { query: searchQuery, per_page: 1, orientation: 'landscape' },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      });
      if (response.data.results?.[0]) return response.data.results[0].urls.regular;
    } catch (e) {}
  }

  if (PEXELS_API_KEY) {
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: { query: searchQuery, per_page: 1 },
        headers: { Authorization: PEXELS_API_KEY }
      });
      if (response.data.photos?.[0]) return response.data.photos[0].src.large2x;
    } catch (e) {}
  }

  if (PIXABAY_API_KEY) {
    try {
      const response = await axios.get('https://pixabay.com/api/', {
        params: { key: PIXABAY_API_KEY, q: searchQuery, image_type: 'photo', orientation: 'horizontal', per_page: 3 }
      });
      if (response.data.hits?.[0]) return response.data.hits[0].largeImageURL;
    } catch (e) {}
  }

  return `https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1000&auto=format&fit=crop`;
};

/**
 * Fetch multiple place images for Swipable Galleries
 */
export const fetchPlaceImages = async (query: string, count: number = 3): Promise<string[]> => {
  let images: string[] = [];
  
  // 1. Google Places Details API (Primary)
  try {
    const searchRes = await axios.get(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json`, {
      params: { input: query, inputtype: 'textquery', fields: 'place_id', key: GOOGLE_PLACES_API_KEY }
    });
    
    const placeId = searchRes.data.candidates?.[0]?.place_id;
    if (placeId) {
      const detailsRes = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
        params: { place_id: placeId, fields: 'photos', key: GOOGLE_PLACES_API_KEY }
      });

      if (detailsRes.data.result?.photos) {
        images = detailsRes.data.result.photos
          .slice(0, count)
          .map((p: any) => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`);
      }
    }
  } catch (e) {
    console.warn('[ImageService] Google Places Details failed, falling back...');
  }

  // 2. Unsplash Fallback
  const searchQuery = `${query} travel`;
  if (images.length < count && UNSPLASH_ACCESS_KEY && UNSPLASH_ACCESS_KEY !== 'YOUR_UNSPLASH_ACCESS_KEY') {
    try {
      const res = await axios.get('https://api.unsplash.com/search/photos', {
        params: { query: searchQuery, per_page: count, orientation: 'landscape' },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      });
      if (res.data.results) {
        images = [...images, ...res.data.results.map((r: any) => r.urls.regular)];
      }
    } catch (e) {}
  }

  // 3. Pixabay Fallback
  if (images.length < count && PIXABAY_API_KEY) {
    try {
      const res = await axios.get('https://pixabay.com/api/', {
        params: { key: PIXABAY_API_KEY, q: searchQuery, image_type: 'photo', orientation: 'horizontal', per_page: count }
      });
      if (res.data.hits) {
        images = [...images, ...res.data.hits.map((r: any) => r.largeImageURL)];
      }
    } catch (e) {}
  }

  const fallbacks = [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1000',
    'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1000',
    'https://images.unsplash.com/photo-1599661046289-e31887846eac?q=80&w=1000'
  ];

  while (images.length < count) {
    images.push(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  }

  // Filter out duplicates and nulls just in case
  return Array.from(new Set(images)).slice(0, count);
};

/**
 * Fetch random travel images for the feed/explore with fallbacks
 */
export const fetchRandomTravelImages = async (count: number = 5): Promise<any[]> => {
  const indianQueries = [
    'Taj Mahal Agra', 'Jaipur Hawa Mahal', 'Kerala Backwaters Alleppey', 
    'Leh Ladakh Mountains', 'Goa Beaches', 'Varanasi Ghats', 
    'Munnar Tea Gardens', 'Hampi Ruins', 'Jaisalmer Desert', 
    'Shimla Snow', 'Rishikesh Ganga', 'Udaipur Lake Palace'
  ];

  const getRandomQuery = () => indianQueries[Math.floor(Math.random() * indianQueries.length)];

  // 1. Try Unsplash (Primary)
  if (UNSPLASH_ACCESS_KEY && UNSPLASH_ACCESS_KEY !== 'YOUR_UNSPLASH_ACCESS_KEY') {
    try {
      const response = await axios.get('https://api.unsplash.com/photos/random', {
        params: { query: getRandomQuery() + ' travel', count, orientation: 'landscape' },
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      });
      if (Array.isArray(response.data)) {
        return response.data.map((img: any) => ({
          name: img.location?.city || img.location?.title || 'Adventure',
          image: img.urls.regular
        }));
      }
    } catch (e) {
      console.warn('[ImageService] Random Unsplash failed, trying fallback list...');
    }
  }

  // Static Fallback if all APIs fail (Production safety)
  const fallbacks = [
    { name: 'Taj Mahal', image: 'https://images.unsplash.com/photo-1564507592333-c60657eaa0ae' },
    { name: 'Kerala Backwaters', image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944' },
    { name: 'Jaipur Palaces', image: 'https://images.unsplash.com/photo-1599661046289-e31887846eac' },
    { name: 'Leh Ladakh', image: 'https://images.unsplash.com/photo-1581791534721-e599df4417f7' },
    { name: 'Goa Beaches', image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2' }
  ];
  return fallbacks.slice(0, count).map(f => ({
    name: f.name,
    image: `${f.image}?q=80&w=600&auto=format&fit=crop`
  }));
};

/**
 * Static Rich Destinations (Hardcoded for demo/premium feel)
 */
export const getRichDestinations = () => {
  return [
    {
      id: 'dest-taj-mahal',
      title: 'Taj Mahal, Agra',
      name: 'Taj Mahal',
      location: 'Agra, India',
      image: 'https://images.unsplash.com/photo-1564507592333-c60657eaa0ae?q=80&w=1000',
      description: 'The Taj Mahal is an ivory-white marble mausoleum on the south bank of the Yamuna river in the Indian city of Agra. Commissioned in 1632 by Shah Jahan.',
      rating: 4.9,
      budget: '₹2,000 - ₹5,000',
      duration: '1-2 Days',
      coordinates: { latitude: 27.1751, longitude: 78.0421 }
    },
    {
      id: 'dest-kerala',
      title: 'Backwaters, Kerala',
      name: 'Kerala Backwaters',
      location: 'Alleppey, India',
      image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=1000',
      description: 'The Kerala backwaters are a network of brackish lagoons and lakes parallel to the Arabian Sea coast.',
      rating: 4.8,
      budget: '₹5,000 - ₹12,000',
      duration: '3-4 Days',
      coordinates: { latitude: 9.4981, longitude: 76.3388 }
    },
    {
      id: 'dest-jaipur',
      title: 'Hawa Mahal, Jaipur',
      name: 'Jaipur Palaces',
      location: 'Jaipur, India',
      image: 'https://images.unsplash.com/photo-1599661046289-e31887846eac?q=80&w=1000',
      description: 'Jaipur, the capital of Rajasthan, is known as the "Pink City" for its trademark building color.',
      rating: 4.7,
      budget: '₹3,000 - ₹8,000',
      duration: '2-3 Days',
      coordinates: { latitude: 26.9239, longitude: 75.8267 }
    },
    {
      id: 'dest-ladakh',
      title: 'Pangong Lake, Ladakh',
      name: 'Leh Ladakh',
      location: 'Leh, India',
      image: 'https://images.unsplash.com/photo-1581791534721-e599df4417f7?q=80&w=1000',
      description: 'Ladakh is a region in the Indian state of Jammu and Kashmir famous for its high-altitude lakes and monastaries.',
      rating: 4.9,
      budget: '₹10,000 - ₹20,000',
      duration: '5-7 Days',
      coordinates: { latitude: 33.7595, longitude: 78.6674 }
    },
    {
      id: 'dest-goa',
      title: 'Palolem Beach, Goa',
      name: 'Goa Beaches',
      location: 'Goa, India',
      image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1000',
      description: 'Goa is a state on the southwestern coast of India visited for its white sand beaches and active nightlife.',
      rating: 4.6,
      budget: '₹4,000 - ₹10,000',
      duration: '4-5 Days',
      coordinates: { latitude: 15.0100, longitude: 74.0232 }
    },
    {
      id: 'dest-varanasi',
      title: 'Ganga Ghats, Varanasi',
      name: 'Varanasi',
      location: 'Uttar Pradesh, India',
      image: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?q=80&w=1000',
      description: 'Varanasi is a city on the banks of the river Ganges. The holiest of the seven sacred cities in Hinduism.',
      rating: 4.8,
      budget: '₹1,500 - ₹4,000',
      duration: '2-3 Days',
      coordinates: { latitude: 25.3176, longitude: 83.0062 }
    },
    {
      id: 'dest-munnar',
      title: 'Tea Gardens, Munnar',
      name: 'Munnar',
      location: 'Kerala, India',
      image: 'https://images.unsplash.com/photo-1516738901171-8eb4fc13bd20?q=80&w=1000',
      description: 'Munnar is a town and hill station located in the Western Ghats mountain range of Kerala.',
      rating: 4.7,
      budget: '₹2,500 - ₹6,000',
      duration: '2-3 Days',
      coordinates: { latitude: 10.0889, longitude: 77.0595 }
    },
    {
      id: 'dest-hampi',
      title: 'Virupaksha Temple, Hampi',
      name: 'Hampi',
      location: 'Karnataka, India',
      image: 'https://images.unsplash.com/photo-1590496793907-4221a6467367?q=80&w=1000',
      description: 'Hampi is an ancient village in Karnataka dotted with ruined temple complexes from the Vijayanagara Empire.',
      rating: 4.8,
      budget: '₹2,000 - ₹5,000',
      duration: '2-3 Days',
      coordinates: { latitude: 15.3350, longitude: 76.4600 }
    },
    {
      id: 'dest-udaipur',
      title: 'Lake Palace, Udaipur',
      name: 'Udaipur',
      location: 'Rajasthan, India',
      image: 'https://images.unsplash.com/photo-1615836245337-f589b91c9603?q=80&w=1000',
      description: 'Udaipur is a city set around a series of artificial lakes and is known for its lavish royal residences.',
      rating: 4.8,
      budget: '₹4,000 - ₹10,000',
      duration: '3-4 Days',
      coordinates: { latitude: 24.5854, longitude: 73.6815 }
    },
    {
      id: 'dest-shimla',
      title: 'Mall Road, Shimla',
      name: 'Shimla',
      location: 'Himachal Pradesh, India',
      image: 'https://images.unsplash.com/photo-1598091465089-b00346bfbf4b?q=80&w=1000',
      description: 'Shimla is the capital of Himachal Pradesh, once the summer capital of British India.',
      rating: 4.6,
      budget: '₹3,000 - ₹7,000',
      duration: '3-4 Days',
      coordinates: { latitude: 31.1048, longitude: 77.1734 }
    },
    {
      id: 'dest-rishikesh',
      title: 'Ganges, Rishikesh',
      name: 'Rishikesh',
      location: 'Uttarakhand, India',
      image: 'https://images.unsplash.com/photo-1605640840428-1b6bfcb1ca68?q=80&w=1000',
      description: 'Rishikesh is a city beside the Ganges River, renowned as a center for yoga and meditation.',
      rating: 4.7,
      budget: '₹2,500 - ₹6,000',
      duration: '2-4 Days',
      coordinates: { latitude: 30.0869, longitude: 78.2676 }
    },
    {
      id: 'dest-andaman',
      title: 'Havelock, Andaman',
      name: 'Andaman Islands',
      location: 'Andaman, India',
      image: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?q=80&w=1000',
      description: 'The Andaman Islands are an Indian archipelago known for their white-sand beaches and tropical rainforests.',
      rating: 4.9,
      budget: '₹15,000 - ₹30,000',
      duration: '5-6 Days',
      coordinates: { latitude: 11.9761, longitude: 92.9876 }
    }
  ];
};
