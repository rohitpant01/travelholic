# Appendix: EkalGo System Codebase Extracts

This appendix contains simplified, core snippets of the actual source code powering the most critical features of the EkalGo platform. The code has been condensed for readability while maintaining the original logic and structure.

## 1. Authentication and Onboarding Engine (Backend)
This section handles the multi-step user registration process, including Google OAuth integration and OTP-based email/phone verification.

```javascript
// src/controllers/authController.js

const User = require('../models/User');
const { generateToken, generateTokenWithRole } = require('../middleware/auth');
const { sendEmailOTP } = require('../utils/email');

// @desc    Register new user - Step 1
const register = async (req, res) => {
  try {
    const { firstName, lastName, username, email, phone, password, authProvider } = req.body;
    
    // 1. Check for existing users
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

    // 2. Identify if Google Auth is used
    const isGoogle = !!req.body.googleId || req.body.authProvider === 'google';
    
    // 3. Create User Payload
    const userPayload = {
      firstName, lastName, username: username.toLowerCase(), email: email.toLowerCase(),
      phone, password: password || `google_${Date.now()}`,
      registrationStep: isGoogle ? 4 : 2, // Skip OTP for Google users
      isEmailVerified: isGoogle ? true : false,
      authProvider: authProvider || (isGoogle ? 'google' : 'local')
    };

    const user = await User.create(userPayload);

    // 4. Send Email OTP for local authentication
    if (!isGoogle) {
      const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
      user.emailOtp = emailOtp;
      user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      await user.save({ validateBeforeSave: false });
      await sendEmailOTP(email, emailOtp);
    }

    const token = generateToken(user._id);
    res.status(201).json({ message: 'Account created successfully.', token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

## 2. AI-Powered Day Planner & Itinerary Generation (Backend)
This component leverages AI models (Gemini/OpenAI) and Google Places API to dynamically generate localized travel itineraries.

```javascript
// src/controllers/aiController.js

const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

// Generate Itinerary Logic
exports.generateItinerary = async (req, res) => {
  try {
    const { destination, days, budget, interests, travelType } = req.body;

    // 1. Resolve coordinates for the destination
    const coords = await getCoordinates(destination);

    // 2. Fetch destination-scoped nearby attractions
    const searchRadius = 15000; // 15 km limit to stay in-city
    const realPlaces = await getNearbyPlaces(coords.lat, coords.lng, destination, searchRadius, 30);

    // 3. Build skeleton itinerary with verified places
    const skeletonItinerary = buildSkeleton(realPlaces, days);

    // 4. Construct AI Prompt with strict localization constraints
    const unifiedPrompt = `
      You are a hyperlocal travel expert EXCLUSIVELY for ${destination}, India.
      IMPORTANT RULES: Every place, hotel, and restaurant MUST be physically inside ${destination}.
      Below is a FIXED ${days}-day itinerary skeleton. 
      Add a short description, realistic INR cost, travel time, and 2 unique hotel recommendations per day.
      Trip profile -> Budget: ${budget} | Type: ${travelType} | Interests: ${interests}
    `;

    // 5. Query AI Model (OpenAI/Gemini)
    const data = await runAI(unifiedPrompt);

    // 6. Enrich Hotel data using Google Places API sequentially
    for (const day of data.itinerary) {
      if (!day.stay_recommendations?.length) continue;
      day.stay_recommendations = await enrichHotels(day.stay_recommendations, coords, destination);
    }

    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate itinerary. Please try again." });
  }
};
```

## 3. Global App Navigation & Real-time Redux Synchronization (Frontend)
The primary layout of the application, incorporating real-time WebSockets, Redux Global State, and Tab-based Navigation.

```tsx
// App.tsx

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useDispatch, useSelector } from 'react-redux';
import { useSocket } from './src/context/SocketContext';
import * as Notifications from 'expo-notifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function MainTabs() {
  const chatsWithUnread = useSelector((s: RootState) => s.chat.chatsWithUnread);
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#2E8B57' }}>
      <Tab.Screen name="Travelers" component={DiscoverScreen} />
      <Tab.Screen name="Explorer" component={PlaceDiscoveryScreen} />
      <Tab.Screen name="Trips" component={TripsScreen} />
      <Tab.Screen 
        name="Matches" 
        component={MatchesScreen} 
        options={{ tabBarBadge: chatsWithUnread > 0 ? chatsWithUnread : undefined }} 
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// App Initialization and WebSocket Integration
function AppNavigator() {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { socket } = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isAuthenticated || !user?._id || !socket) return;
    
    // Listen for real-time incoming messages
    const onReceiveMessage = (data: any) => {
      const isGroupMessage = !!data.trip || data.chatType === 'group';
      
      // Upsert message into Redux Store
      if (isGroupMessage) {
        dispatch(upsertTripMessage({ message: data, currentUserId: user._id }));
      } else {
        dispatch(upsertMessage({ message: data, currentUserId: user._id }));
      }

      // Show In-App Notification if Chat is not active
      showInAppToast(data);
    };

    socket.on('receive_message', onReceiveMessage);
    socket.on('new_match', (data) => dispatch(addMatch(data.match)));

    return () => {
      socket.off('receive_message', onReceiveMessage);
    };
  }, [isAuthenticated, user?._id, socket]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## 4. Multi-Device Push Notifications (Frontend/Backend Context)
The logic used to silently synchronize push tokens and missing background data upon app foregrounding.

```javascript
// Background Data Synchronization on App Resume
useEffect(() => {
  const syncMissedData = async () => {
    try {
      const lastSync = await AsyncStorage.getItem('last_sync_time');
      const response = await apiClient.get(`/notifications/sync?lastSyncedAt=${lastSync}`);
      
      if (response.data.messages?.length > 0) {
        response.data.messages.forEach((msg) => {
           const isGroupMessage = !!msg.trip || msg.chatType === 'group';
           isGroupMessage 
              ? dispatch(upsertTripMessage({ message: msg, currentUserId: user._id }))
              : dispatch(upsertMessage({ message: msg, currentUserId: user._id }));
        });
      }
      await AsyncStorage.setItem('last_sync_time', new Date().toISOString());
    } catch (e) {
      console.warn('Sync failed:', e);
    }
  };

  syncMissedData();
}, [isAuthenticated, user?._id]);
```

## 5. Traveler Discovery & Matching Engine (Backend)
This module connects travelers based on shared itineraries, geolocation, and interests. It uses MongoDB's geospatial queries (`$geoNear`) for proximity-based discovery.

```javascript
// src/controllers/discoverController.js

// Calculate a compatibility score between two users
const calculateMatchingScore = (user, currentUser) => {
  let score = 0;
  // Priority 1: Same Destination (+50)
  if (user.destination?.city && currentUser.destination?.city && 
      user.destination.city.toLowerCase() === currentUser.destination.city.toLowerCase()) {
    score += 50;
    // Same Travel Date (+30)
    if (user.travelDate && currentUser.travelDate && 
        user.travelDate.split('T')[0] === currentUser.travelDate.split('T')[0]) score += 30;
  }
  // Priority 2: Shared Interests (+10 each)
  const commonInterests = user.interests.filter(i => currentUser.interests.includes(i));
  score += commonInterests.length * 10;

  return score;
};

// Get Discoverable Profiles using Geospatial Queries
const getDiscoverProfiles = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const maxDistance = currentUser.maxDiscoveryDistance || 200; // km
    const { lat, lng, searchCity } = req.query;
    
    const pipeline = [];

    // GeoNear query for location-based proximity discovery
    if (lat && lng && !searchCity) {
      pipeline.push({
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distanceMet',
          maxDistance: maxDistance * 1000,
          query: { _id: { $ne: req.user._id }, visibilityStatus: { $ne: 'ghost' } },
          spherical: true,
        },
      });
    } else if (searchCity) {
      // Travel Mode: Search by city destination
      pipeline.push({ 
        $match: { 'destination.city': { $regex: searchCity, $options: 'i' }, visibilityStatus: { $ne: 'ghost' } } 
      });
    }

    const profiles = await User.aggregate(pipeline);
    
    // Enrich with calculated matching score
    const enriched = profiles.map(p => ({
      ...p,
      distanceKm: Math.round(p.distanceMet / 1000) || 0,
      matchScore: calculateMatchingScore(p, currentUser)
    })).sort((a, b) => b.matchScore - a.matchScore);

    res.json({ profiles: enriched, count: enriched.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

## 6. Smart Budget Allocator Engine (Backend)
Used by the AI planner to ensure recommendations remain within the user's defined financial limits.

```javascript
// src/utils/budgetAllocator.js

class SmartBudgetAllocator {
  constructor(totalBudget, durationDays) {
    this.totalBudget = totalBudget || 0;
    this.durationDays = durationDays || 1;
    this.allocations = {
      hotels: this.totalBudget * 0.45,
      food: this.totalBudget * 0.25,
      travel: this.totalBudget * 0.15,
      activities: this.totalBudget * 0.15
    };
  }

  // Filter and format hotels strictly within budget
  filterHotelsWithinBudget(hotels) {
    const maxHotelTotalCost = this.allocations.hotels;
    
    return hotels.map(hotel => {
        let pricePerNight = hotel.pricePerNight || 3000;
        let totalCost = pricePerNight * this.durationDays;
        return {
          ...hotel,
          pricePerNight, totalCost,
          isBudgetFriendly: totalCost < (maxHotelTotalCost * 0.7)
        };
      })
      .filter(hotel => hotel.totalCost <= maxHotelTotalCost)
      .sort((a, b) => a.totalCost - b.totalCost);
  }
}

module.exports = SmartBudgetAllocator;
```

## 7. Social Feed & Background Uploading (Frontend)
Handles user-generated content, image compression, and AI-enabled travel posts running in the background for a lag-free experience.

```tsx
// src/components/CreatePostModal.tsx

import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { useDispatch } from 'react-redux';
import { createPostAction, addTempPost } from '../store/slices/feedSlice';

export default function CreatePostModal() {
  const dispatch = useDispatch();

  // Background Task: Compress Images and Send Form Data
  const submitPostInBackground = async (contentStr, currentImages, tempId, locationData, allowAI) => {
    try {
      const formData = new FormData();
      formData.append('content', contentStr);
      formData.append('location', JSON.stringify({ type: 'Point', coordinates: [locationData.lng, locationData.lat] }));
      formData.append('allowAIItinerary', String(allowAI));

      // Compress Images before Upload
      for (let i = 0; i < currentImages.length; i++) {
        const compressed = await ImageManipulator.manipulateAsync(
          currentImages[i], [{ resize: { width: 1080 } }], { compress: 0.7 }
        );
        formData.append('media', {
          uri: compressed.uri,
          name: \`post_\${Date.now()}_\${i}.jpg\`,
          type: 'image/jpeg',
        });
      }

      await dispatch(createPostAction({ formData, tempId })).unwrap();
    } catch (error) {
      console.error('Post Error', error);
    }
  };

  const handlePost = () => {
    const tempId = \`temp_\${Date.now()}\`;
    
    // 1. Instantly update UI (Optimistic UI update)
    dispatch(addTempPost({ _id: tempId, isTemporary: true, status: 'uploading', content, images }));

    // 2. Fire and forget background post upload
    submitPostInBackground(content, images, tempId, selectedLocation, aiEnabled);

    // 3. Trigger AI flow if toggled on
    if (aiEnabled) {
      navigation.navigate('LyraItinerary', { caption: content, postId: tempId });
    }
    onClose();
  };
  
  // ... JSX Render
}
```
