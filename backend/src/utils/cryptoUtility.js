const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY || '6928ed020d4937f7ae5179cf02123456', 'hex'); // 32 bytes
const ivSize = 16;

/**
 * Encrypt plain text using AES-256-CBC
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in hex (iv:content)
 */
const encrypt = (text) => {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(ivSize);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('[CRYPTO] Encryption failed:', error.message);
    return text;
  }
};

/**
 * Decrypt text using AES-256-CBC
 * @param {string} encryptedText - Encrypted text in hex (iv:content)
 * @returns {string} - Decrypted plain text
 */
const decrypt = (encryptedText) => {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedContent = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[CRYPTO] Decryption failed (Key mismatch or corrupted data):', error.message);
    return encryptedText; // Return original if failed
  }
};

/**
 * Helper to encrypt/decrypt location coordinates
 */
const encryptLocation = (coords) => {
  if (!coords || !Array.isArray(coords)) return coords;
  return coords.map(c => encrypt(c.toString()));
};

const decryptLocation = (coords) => {
  if (!coords || !Array.isArray(coords)) return coords;
  return coords.map(c => {
      const dec = decrypt(c);
      return isNaN(parseFloat(dec)) ? dec : parseFloat(dec);
  });
};

module.exports = {
  encrypt,
  decrypt,
  encryptLocation,
  decryptLocation
};
