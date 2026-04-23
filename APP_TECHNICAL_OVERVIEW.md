# ✈️ EkalGo — Full Stack Technical Overview

EkalGo is a comprehensive, AI-powered travel companion application that blends social networking (traveler discovery), real-time communication, and intelligent travel planning.

## 🚀 1. Technology Stack

### Frontend (Mobile)
- **Framework**: React Native with Expo (SDK 54+)
- **State Management**: Redux Toolkit (Slices for Auth, Notifications, SavedSync)
- **Styling**: Vanilla CSS-in-JS (Theme-based system)
- **Navigation**: React Navigation (Stacks, Tabs)
- **Maps**: React Native Maps with Google Maps SDK
- **Real-time**: Socket.io-client
- **Animations**: React Native Reanimated & Lottie

### Backend (Server)
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB Atlas (ODM: Mongoose)
- **Real-time**: Socket.io
- **Authentication**: JSON Web Tokens (JWT) & bcrypt hashing
- **File Uploads**: Multer with Cloudinary integration

### Third-Party Services
- **AI Models**: OpenAI (GPT-4o), Groq (Llama 3), Google Gemini (1.5 Flash)
- **Location**: Google Places API & Geocoding API
- **Verification**: AWS Rekognition (Face Comparison)
- **SMS/OTP**: Twilio Verify
- **Images**: Cloudinary
- **Hosting**: Render.com (API) & MongoDB Atlas (DB)

---

## 🛠️ 2. Core Modules Detailed Breakdown

### A. Authentication & Onboarding
The onboarding process is a multi-step high-conversion flow designed to build a complete user profile.
- **Verification**: Uses Twilio for phone OTP and AWS Rekognition for "Face Verification" (comparing a live selfie with profile photos).
- **Registration Flow (7 Steps)**:
    1. Account Creation (Email/Password)
    2. OTP Verification (Twilio)
    3. Personal Details (Bio, Gender, DOB)
    4. Location Assignment (GPS + Geocoding)
    5. Photo Upload (Cloudinary, max 6 photos)
    6. Interests Selection (Tags)
    7. Travel Preferences (Budget, Looking for)
- **Files**: `authController.js`, `User.js` (Model), `LoginScreen.tsx`, `register/*` (Screens).

### B. Traveler Discovery (Social)
A "Tinder-style" discovery engine for finding travel partners.
- **Algorithm**: Location-based matching with a configurable distance (10-100km).
- **Matching Score**: Calculated based on shared destinations, travel dates, and common interests.
- **Actions**: Like, Skip, and Super Like. Mutual likes trigger a "Match".
- **Views**: "Swipe mode" (Deck swiper) and "List mode" (Distance-sorted).
- **Files**: `discoverController.js`, `Match.js` (Model), `DiscoverScreen.tsx`, `TravelerDiscoveryCard.tsx`.

### C. AI Intelligence Hub
A multi-LLM architecture categorized by performance and cost.
- **Planning**: Generates 1-14 day itineraries with locked skeletons to prevent "hallucinations" of non-existent places.
- **Lyra AI**: Converts user post captions/stories into structured itineraries.
- **Hidden Gems**: Gemini-powered offbeat destination suggestions.
- **Enrichment**: Sequential hotel/spot enrichment using Google Places for real-world ratings and photos.
- **Files**: `aiController.js`, `itineraryController.js`, `AIItineraryScreen.tsx`, `LyraItineraryScreen.tsx`.

### D. Real-time Communication
A robust chat system for matched travelers.
- **Features**: Typing indicators, Read receipts (Online/Offline status), Media sharing (Photos).
- **Infrastructure**: Socket.io for low-latency bidirectional communication.
- **Persistence**: Messages stored in MongoDB with "Match" references.
- **Files**: `chatController.js`, `socketHandler.js`, `ChatScreen.tsx`.

### E. Exploration & Places
Discovery of locations regardless of physical proximity.
- **Top Indian Destinations**: 10 rotating daily hotspots.
- **Category Discovery**: Filter places by adventure, spiritual, beaches, heritage, etc.
- **Insights**: AI-generated stories and travel tips for specific locations.
- **Files**: `placeController.js`, `PlaceDiscoveryScreen.tsx`, `PlaceDetailsScreen.tsx`.

### F. Trip Management
Tools for organizing and tracking journeys.
- **Functionality**: Create group trips, join existing trips, and manage trip history.
- **Detailing**: Itinerary integration, member lists, and destination maps.
- **Files**: `tripController.js`, `TripsScreen.tsx`, `TripDetailScreen.tsx`.

### G. Travel Utilities
- **Checklist**: Smart travel packing lists with AI suggestions.
- **Saved Sync**: Global synchronization of bucket-list destinations across Redux and MongoDB.
- **Notifications**: In-app center for matches, likes, and system alerts.
- **Files**: `checklistController.js`, `SavedDestinationsScreen.tsx`, `NotificationsScreen.tsx`.

---

## 🗄️ 3. Database Schema (MongoDB/Mongoose)

- **User**: Extensive schema containing bio, location-point (GeoJSON), photos array, social stats (followers/following), and travel info.
- **Match**: Links two users, stores `lastMessage`, `unreadCount`, and `isActive` status.
- **Swipe**: 30-day TTL (Time-To-Live) records of user interactions to prevent redundant swipes.
- **AIItinerary**: Stores generated plans with steps, costs, and coordinates.
- **Trip**: Collaboration-focused schema with members array, destination, and status.
- **Checklist**: Personal or trip-linked items with completion status.
- **Post/Comment/Story**: Basic social feed infrastructure for sharing travel moments.

---

## 📂 4. Project Directory Map

### Backend (`/backend`)
- `/src/controllers`: Business logic for every module.
- `/src/models`: Data structures and validation rules.
- `/src/routes`: API endpoint definitions (RESTful).
- `/src/socket`: Socket.io event handling.
- `/src/utils`: Reusable helpers (AWS, Twilio, Geocoding).

### Frontend (`/frontend`)
- `/src/screens`: 40+ unique screens covering all user flows.
- `/src/components`: Reusable UI elements (Headers, Cards, Inputs).
- `/src/store`: Redux state management (slices + middleware).
- `/src/api`: Centralized API services using Axios.
- `/src/utils`: Theme tokens (colors, fonts) and permissions.

---

## 🔒 5. Security & Availability
- **Data Protection**: `bcrypt` (12 rounds) for passwords, JWT for stateless auth.
- **Resilience**: Silent fallback logic between AI providers (OpenAI ↔ Gemini ↔ Groq).
- **Geolocation**: Strictly uses GeoJSON Point geometry for `$geoNear` aggregation efficiency.
- **Privacy**: "Ghost Mode" visibility toggle and 7-day account deletion recovery window.
