# ✈️ EkalGo — Full Stack Travel Companion App

> **Find Your Travel Soulmate** — Tinder-style app for solo travelers.

---

## 📁 Project Structure

```
ekalgo/
├── backend/                   ← Node.js + Express API
│   ├── server.js
│   ├── .env.example           ← Copy to .env, fill API keys
│   ├── render.yaml            ← Render.com deployment config
│   └── src/
│       ├── config/
│       │   ├── db.js          ← MongoDB Atlas connection
│       │   └── cloudinary.js  ← Cloudinary image upload config
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── userController.js
│       │   ├── discoverController.js
│       │   └── chatController.js
│       ├── middleware/
│       │   └── auth.js        ← JWT middleware
│       ├── models/
│       │   ├── User.js        ← Full user schema
│       │   └── Match.js       ← Match, Message, Swipe schemas
│       ├── routes/
│       │   ├── auth.js
│       │   ├── user.js
│       │   ├── discover.js
│       │   ├── matches.js
│       │   └── chat.js
│       ├── socket/
│       │   └── socketHandler.js  ← Socket.io real-time chat
│       └── utils/
│           ├── otp.js            ← Twilio OTP
│           └── faceVerification.js ← AWS Rekognition
│
└── frontend/                  ← React Native (Expo)
    ├── App.tsx                ← Root navigator
    ├── app.json               ← Expo config (Google Maps keys here)
    └── src/
        ├── api/
        │   ├── client.ts      ← Axios + API_BASE_URL + GOOGLE_MAPS_API_KEY
        │   └── services.ts    ← All API calls
        ├── screens/
        │   ├── SplashScreen.tsx
        │   ├── LandingScreen.tsx
        │   ├── LoginScreen.tsx
        │   ├── ForgotPasswordScreen.tsx
        │   ├── DiscoverScreen.tsx  ← Swipe cards
        │   ├── MatchesScreen.tsx
        │   ├── ChatScreen.tsx      ← Real-time chat
        │   ├── ProfileScreen.tsx
        │   ├── EditProfileScreen.tsx
        │   ├── UserDetailScreen.tsx
        │   ├── SettingsScreen.tsx  ← Distance slider (10-100km)
        │   └── register/
        │       ├── Step1AccountScreen.tsx
        │       ├── Step2OTPScreen.tsx
        │       ├── Step3PersonalScreen.tsx
        │       ├── Step4LocationScreen.tsx  ← GPS + Google Maps geocoding
        │       ├── Step5PhotosScreen.tsx    ← Cloudinary upload
        │       ├── Step6InterestsScreen.tsx
        │       ├── Step7PreferencesScreen.tsx
        │       └── VerificationScreen.tsx   ← AWS face verification
        ├── store/
        │   ├── index.ts
        │   └── slices/authSlice.ts
        ├── components/
        │   └── RegisterHeader.tsx
        └── utils/
            └── theme.ts       ← Colors, fonts, spacing
```

---

## 🔑 WHERE TO ADD API KEYS

### 1. BACKEND — `backend/.env`
```
Copy backend/.env.example → backend/.env
Then fill in each value:
```

| Service | Key Name | Where to Get |
|---------|----------|--------------|
| **MongoDB Atlas** | `MONGODB_URI` | https://cloud.mongodb.com → Connect → Drivers |
| **JWT** | `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| **Twilio Account** | `TWILIO_ACCOUNT_SID` | https://console.twilio.com → Account Info |
| **Twilio Token** | `TWILIO_AUTH_TOKEN` | https://console.twilio.com → Account Info |
| **Twilio Phone** | `TWILIO_PHONE_NUMBER` | Twilio → Phone Numbers → Manage |
| **Twilio Verify** | `TWILIO_VERIFY_SERVICE_SID` | Twilio → Verify → Services → Create |
| **Cloudinary Name** | `CLOUDINARY_CLOUD_NAME` | https://cloudinary.com → Dashboard |
| **Cloudinary Key** | `CLOUDINARY_API_KEY` | Cloudinary → Dashboard → API Keys |
| **Cloudinary Secret** | `CLOUDINARY_API_SECRET` | Cloudinary → Dashboard → API Keys |
| **Google Maps** | `GOOGLE_MAPS_API_KEY` | https://console.cloud.google.com → APIs & Services → Credentials |
| **AWS Key ID** | `AWS_ACCESS_KEY_ID` | https://console.aws.amazon.com → IAM → Users → Security Credentials |
| **AWS Secret** | `AWS_SECRET_ACCESS_KEY` | Same as above |
| **AWS Region** | `AWS_REGION` | `us-east-1` (or your region) |

### 2. FRONTEND — `frontend/src/api/client.ts`
```ts
// Line 14:
export const API_BASE_URL = 'https://YOUR_BACKEND_URL.onrender.com/api';
// → Change to your deployed backend URL

// Line 22:
export const GOOGLE_MAPS_API_KEY = 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
// → Your Google Maps API key (same one from backend or a separate frontend key)
```

### 3. FRONTEND — `frontend/app.json`
```json
// Line 20 (iOS):
"googleMapsApiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

// Line 35 (Android):
"apiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

---

## 🚀 SETUP & RUN

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev        # Development
npm start          # Production
```

### Frontend
```bash
cd frontend
npm install
npx expo start     # Opens Expo DevTools
# Press 'a' for Android, 'i' for iOS
```

---

## 🌐 DEPLOYMENT

### Backend → Render.com (Free tier)
1. Push backend folder to GitHub
2. Go to https://render.com → New Web Service
3. Connect your repo
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Add all environment variables from `.env`
7. Deploy → copy the URL (e.g. `https://ekalgo-api.onrender.com`)
8. Update `API_BASE_URL` in `frontend/src/api/client.ts`

### Database → MongoDB Atlas (Free tier)
1. https://cloud.mongodb.com → Create cluster (free M0)
2. Database Access → Add user + password
3. Network Access → Add IP `0.0.0.0/0` (allow all)
4. Connect → Drivers → Copy connection string
5. Paste in backend `.env` as `MONGODB_URI`

### Mobile App → Expo EAS Build
```bash
cd frontend
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android   # APK
eas build --platform ios       # IPA (requires Apple Developer account)
```

---

## 🔐 GOOGLE MAPS API SETUP

1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable these APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Geocoding API** (used for reverse geocoding GPS coords)
   - **Places API** (optional, for place autocomplete)
4. Go to Credentials → Create API Key
5. Restrict the key to your app's bundle ID for security

---

## 📱 FEATURES

| Feature | Status |
|---------|--------|
| Email + Password Auth | ✅ |
| Phone OTP via Twilio | ✅ |
| Multi-step Registration (7 steps) | ✅ |
| Photo Upload to Cloudinary | ✅ |
| Face Verification (AWS Rekognition) | ✅ |
| GPS Location + Google Maps geocoding | ✅ |
| Location-based discovery | ✅ |
| Distance filter (10–100 km) | ✅ |
| Tinder-style swipe cards | ✅ |
| Like / Skip / Super Like | ✅ |
| Match detection | ✅ |
| Real-time chat (Socket.io) | ✅ |
| Photo messages in chat | ✅ |
| Read receipts | ✅ |
| Typing indicator | ✅ |
| Online/offline status | ✅ |
| Push notifications | 🔜 (add expo-notifications) |

---

## 🛡️ SECURITY

- Passwords hashed with bcrypt (12 rounds)
- JWT authentication on all protected routes
- Rate limiting (100 req/15 min)
- Helmet.js security headers
- Image validation (type + size)
- OTP expiry via Twilio Verify
- MongoDB indexes for performance
- 30-day TTL on swipe records

---

## 📞 SUPPORT

For issues, check:
- MongoDB Atlas connection: Verify URI format and IP whitelist
- Twilio OTP: Verify Service SID (not Account SID)
- Cloudinary: Check cloud name (not URL)
- AWS Rekognition: Enable service in your AWS region

---

*Built with ✈️ React Native + Node.js + MongoDB + Socket.io*
