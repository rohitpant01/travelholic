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
    
    // Send the chunks to the Expo push notification service.
    for (let chunk of chunks) {
      try {
        let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('[Push Notification] Error sending chunk', error);
      }
    }
  } catch (error) {
    console.error('[Push Notification] General error', error);
  }
};

module.exports = { sendPushNotification };
