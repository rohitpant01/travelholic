/**
 * Utility to manage user devices and tokens
 */

/**
 * Adds or updates a device token for a user
 * @param {Object} user - Mongoose user document
 * @param {string} token - FCM push token
 * @param {string} platform - 'ios', 'android', 'web'
 * @param {string} deviceId - Unique device identifier
 */
const updateDeviceToken = (user, token, platform, deviceId) => {
  if (!user || !token) return;

  if (!user.devices) user.devices = [];

  const existingDeviceIndex = user.devices.findIndex(d => d.token === token);

  if (existingDeviceIndex > -1) {
    // Update existing device
    user.devices[existingDeviceIndex].lastUsed = new Date();
    if (platform) user.devices[existingDeviceIndex].platform = platform;
    if (deviceId) user.devices[existingDeviceIndex].deviceId = deviceId;
  } else {
    // Add new device
    user.devices.push({
      token,
      platform: platform || 'other',
      deviceId,
      lastUsed: new Date()
    });
  }

  // Keep only the 5 most recently used devices to prevent bloat
  if (user.devices.length > 5) {
    user.devices.sort((a, b) => b.lastUsed - a.lastUsed);
    user.devices = user.devices.slice(0, 5);
  }
};

/**
 * Removes a specific token from user's devices (logout/token invalid)
 * @param {Object} user 
 * @param {string} token 
 */
const removeDeviceToken = (user, token) => {
  if (!user || !user.devices || !token) return;
  user.devices = user.devices.filter(d => d.token !== token);
};

module.exports = {
  updateDeviceToken,
  removeDeviceToken
};
