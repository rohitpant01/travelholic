const { Expo } = require('expo-server-sdk');
const expo = new Expo();

/**
 * Send a push notification to a user's Expo Push Token
 * @param {string} pushToken - The target user's Expo push token
 * @param {string} title - The notification title
 * @param {string} body - The notification body
 * @param {object} data - Optional data payload
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
    console.error(`[Push Notification] Invalid Expo push token: ${pushToken}`);
    return;
  }

  const messages = [{
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    
    for (let chunk of chunks) {
      let retryCount = 0;
      const MAX_RETRIES = 3;
      let success = false;

      while (retryCount <= MAX_RETRIES && !success) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          success = true;
        } catch (error) {
          const isTransient = error.message?.includes('fetch failed') || 
                            error.code === 'ECONNRESET' || 
                            error.code === 'ETIMEDOUT' ||
                            error.message?.includes('Client network socket disconnected');
          
          if (isTransient && retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 1000;
            console.warn(`[Push Notification] Transient error, retrying in ${delay}ms... (${retryCount}/${MAX_RETRIES})`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('[Push Notification] Final error sending chunk', error);
            break; // Stop retrying this chunk
          }
        }
      }
    }
  } catch (error) {
    console.error('[Push Notification] General error', error);
  }
};

module.exports = { sendPushNotification };
