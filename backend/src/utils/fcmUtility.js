const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../../service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ [FCM] Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ [FCM] Firebase Admin initialization failed:', error.message);
}

/**
 * Send a direct FCM notification (High Reliability)
 * @param {string} token - FCM/Expo Push Token
 * @param {string} title - Title
 * @param {string} body - Body
 * @param {object} data - Data payload
 * @param {string} priority - 'high' or 'normal'
 */
const sendDirectPush = async (token, title, body, data = {}, priority = 'high') => {
  if (!token) return;

  // If it's an Expo token, we should still use Expo SDK but with FCM priority if possible,
  // OR if we want to bypass Expo entirely, we need the NATIVE FCM tokens.
  // Assuming the tokens stored are Expo tokens, we continue using expo-server-sdk 
  // but we can also support native FCM tokens here if the frontend starts sending them.
  
  const message = {
    notification: {
      title,
      body,
    },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // Common for Android
    },
    android: {
      priority: priority === 'high' ? 'high' : 'normal',
      notification: {
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true,
        },
      },
    },
    token: token,
  };

  try {
    // If it's a native FCM token
    if (!token.startsWith('ExponentPushToken')) {
      const response = await admin.messaging().send(message);
      console.log('✅ [FCM] Direct push sent:', response);
      return response;
    } else {
      // It's an Expo token, we still need Expo SDK to proxy it unless we have the FCM token.
      // We will fallback to the existing expo utility but this fcmUtility is ready for native tokens.
      console.log('[FCM] Expo token detected, bypassing direct FCM for this call');
      return null; 
    }
  } catch (error) {
    console.error('❌ [FCM] Direct push failed:', error.message);
    throw error;
  }
};

module.exports = { admin, sendDirectPush };
