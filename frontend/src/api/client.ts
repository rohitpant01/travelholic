import axios from 'axios';
import storage from '../utils/storage';

// ================================================================
// API CONFIGURATION
// ================================================================
// Development: use your local machine IP (not localhost for device)
// Production: your Render/Railway deployed backend URL
//
// Examples:
//   Local (Expo on device): 'http://192.168.1.xxx:5000/api'
//   Local (Expo simulator): 'http://localhost:5000/api'
//   Production (Render):    'https://travelholic-api.onrender.com/api'
// ================================================================
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.62.246.2:5001/api';
// Use 'http://localhost:5000/api' for iOS Simulator
// Use 'http://10.62.246.2:5001/api' for physical device (your PC IP)
// ⚠️ IMPORTANT: For the APK to work, your PC and Phone MUST be on the same WiFi!

// ================================================================
// GOOGLE MAPS API KEY
// ================================================================
// Used in: Step4LocationScreen, DiscoverScreen (distance display)
// Get from: https://console.cloud.google.com
// Enable: Maps SDK for Android, Maps SDK for iOS, Geocoding API, Places API
// ================================================================
//   "ios" > "config" > "googleMapsApiKey"
// ================================================================
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes for slow media uploads
  headers: {
    'Accept': 'application/json',
  },
});

// Request interceptor: attach JWT token and log diagnostics
apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getSecureItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 🔍 Debug log for Android connectivity
    console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    if (config.data instanceof FormData) {
      const parts = (config.data as any)._parts || [];
      const fieldNames = parts.map((p: any) => p[0]);
      console.log(`[API FORMDATA] Detected. Fields:`, JSON.stringify(fieldNames));

      // Secondary check: ensure relevant fields are present
      const expected = ['photos', 'selfie', 'audio', 'image'];
      if (!fieldNames.some((f: string) => expected.includes(f))) {
        console.warn('[API FORMDATA WARNING] No expected file fields found!');
      }
    }

    return config;
  },
  (error) => {
    console.error('[API REQUEST ERROR]:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API RESPONSE] ${response.status} from ${response.config.url}`);
    return response;
  },
  async (error) => {
    console.warn(`[API ERROR] ${error.message} on ${error.config?.url}`);
    
    // Fallback System for Place Discovery (Zero-Empty Screen)
    if (error.response?.status === 404 && error.config?.url?.includes('/places/search')) {
      console.log('[INTERCEPTOR] 404 caught. Returning curated fallback places.');
      return Promise.resolve({
        data: {
          success: true,
          isFallback: true,
          locationName: 'Trending Worldwide',
          results: {
            romantic: [{ id: 'fb1', name: 'Curated Romantic View', address: 'Trending Spots', rating: 4.8, distanceText: 'Worldwide', types: ['tourist_attraction'], whyThisPlace: 'Trending spot for couples ✨', location: { lat: 0, lng: 0 } }],
            nature: [{ id: 'fb2', name: 'Curated Natural Escape', address: 'Trending Outdoors', rating: 4.7, distanceText: 'Worldwide', types: ['park'], whyThisPlace: 'Reconnect with nature 🌿', location: { lat: 0, lng: 0 } }],
            restaurants: [{ id: 'fb3', name: 'Curated Dining Experience', address: 'Trending Culinary', rating: 4.9, distanceText: 'Worldwide', types: ['restaurant'], whyThisPlace: 'Top culinary experience 🍽️', location: { lat: 0, lng: 0 } }],
            cafes: [],
            hotels: [],
            hidden_gems: []
          }
        }
      });
    }

    if (error.response?.status === 401) {
      await storage.removeSecureItem('token');
      await storage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
