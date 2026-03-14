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
export const API_BASE_URL = 'http://192.168.0.170:5000/api';
// Use 'http://localhost:5000/api' for iOS Simulator
// Use 'http://192.168.0.170:5000/api' for physical device (your PC IP)

// ================================================================
// GOOGLE MAPS API KEY
// ================================================================
// Used in: Step4LocationScreen, DiscoverScreen (distance display)
// Get from: https://console.cloud.google.com
// Enable: Maps SDK for Android, Maps SDK for iOS, Geocoding API, Places API
// ================================================================
export const GOOGLE_MAPS_API_KEY = 'AIzaSyCLYyVPFrMguQYp71lbDIxftCzMOF4d5JY';
export const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
// → Also add this key to app.json under:
//   "android" > "config" > "googleMaps" > "apiKey"
//   "ios" > "config" > "googleMapsApiKey"

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased to 60s for photo uploads
});

// Request interceptor: attach JWT token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401s globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // Navigation to login handled in components
    }
    return Promise.reject(error);
  }
);

export default apiClient;
