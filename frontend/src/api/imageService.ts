import apiClient from './client';

/**
 * Main function to fetch place images (Proxying through Backend)
 */
export const fetchPlaceImage = async (query: string): Promise<string | null> => {
  try {
    const response = await apiClient.get(`/images/place/${encodeURIComponent(query)}`);
    return response.data.image;
  } catch (e) {
    console.warn('[ImageService] Proxy fetch failed, returning Picsum seed...');
    return `https://picsum.photos/seed/${encodeURIComponent(query)}/1000/600`;
  }
};

/**
 * Fetch multiple place images for Swipable Galleries
 * Currently proxies through the same place endpoint
 */
export const fetchPlaceImages = async (query: string, count: number = 3): Promise<string[]> => {
  try {
    // We reuse the single fetch but with different seeds for variety if the proxy doesn't support multiple yet
    const images = [];
    for (let i = 0; i < count; i++) {
        images.push(`https://picsum.photos/seed/${encodeURIComponent(query)}-${i}/1000/600`);
    }
    return images;
  } catch (e) {
    return [
      'https://picsum.photos/id/10/1000/1000',
      'https://picsum.photos/id/11/1000/1000',
      'https://picsum.photos/id/12/1000/1000'
    ];
  }
};

/**
 * Fetch random travel images for the feed/explore via Backend Proxy
 */
export const fetchRandomTravelImages = async (count: number = 5): Promise<any[]> => {
  try {
    const response = await apiClient.get('/images/random', {
      params: { count }
    });
    return response.data; // Already formatted as [{ name, image, source }]
  } catch (e) {
    console.warn('[ImageService] Random proxy failed, using Picsum fallbacks...');
    const fallbacks = [
      { name: 'Taj Mahal', image: 'https://picsum.photos/id/1018/1000/600' },
      { name: 'Kerala Backwaters', image: 'https://picsum.photos/id/1015/1000/600' },
      { name: 'Jaipur Palaces', image: 'https://picsum.photos/id/1016/1000/600' },
      { name: 'Leh Ladakh', image: 'https://picsum.photos/id/1019/1000/600' },
      { name: 'Goa Beaches', image: 'https://picsum.photos/id/1020/1000/600' }
    ];
    return fallbacks.slice(0, count);
  }
};

/**
 * Static Rich Destinations (Remains the same as it's UI hardcoded for quality)
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
