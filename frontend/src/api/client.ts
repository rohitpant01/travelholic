import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
export const API_BASE_URL = 'http://10.147.61.2:5001/api';
// Use 'http://localhost:5000/api' for iOS Simulator
// Use 'http://10.147.61.2:5001/api' for physical device (your PC IP)
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
export const GOOGLE_MAPS_API_KEY = 'AIzaSyCLYyVPFrMguQYp71lbDIxftCzMOF4d5JY';
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
    const token = await AsyncStorage.getItem('token');
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

// Response interceptor: handle 401s globally
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API RESPONSE] ${response.status} from ${response.config.url}`);
    return response;
  },
  async (error) => {
    console.warn(`[API ERROR] ${error.message} on ${error.config?.url}`);
    if (error.config) {
      console.log('Error Config:', {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        data: error.config.data ? 'Present' : 'Missing',
      });
    }
    if (error.response) {
      console.error('Error Response:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Error Request: No response received');
    }
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
