# 📋 TravelHolic Project Requirements

This document provides a comprehensive overview of the dependencies and system requirements for the **TravelHolic** project.

---

## 🛠️ System Requirements
- **Node.js**: >= 18.x
- **npm**: >= 9.x
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli` (for production builds)
- **MongoDB**: Atlas Cluster (Free Tier)
- **Cloudinary**: Account for image storage
- **Twilio**: Account for OTP/SMS
- **AWS**: Rekognition service for face verification

---

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
# Configure your .env (see README.md)
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npx expo start
```

---

## 📦 Core Dependencies

### Backend (Node.js/Express)
| Package | Version | Description |
| :--- | :--- | :--- |
| `express` | ^4.18.2 | Web framework |
| `mongoose` | ^8.0.3 | MongoDB ODM |
| `jsonwebtoken` | ^9.0.2 | Authentication |
| `socket.io` | ^4.6.1 | Real-time Chat |
| `twilio` | ^4.19.3 | OTP SMS Service |
| `cloudinary` | ^1.41.0 | Image Storage |
| `aws-sdk` | ^2.1693.0 | AWS Rekognition |

### Frontend (React Native/Expo)
| Package | Version | Description |
| :--- | :--- | :--- |
| `react-native` | 0.81.5 | Framework |
| `expo` | ~54.0.10 | Expo SDK |
| `react-navigation` | ^6.x | Navigation |
| `reduxjs/toolkit` | ^2.0.1 | State Management |
| `react-native-maps` | 1.20.1 | Google Maps |
| `socket.io-client`| ^4.6.1 | Real-time Chat Client |

---

*Note: For a full list of over 60+ dependencies, please refer to the root [requirements.txt](./requirements.txt).*
