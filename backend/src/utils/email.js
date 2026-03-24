const emailjs = require('@emailjs/nodejs');

/**
 * Send OTP via EmailJS
 * @param {string} email - Destination email
 * @param {string} otp - 6-digit code
 */
const sendEmailOTP = async (email, otp) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!privateKey) {
    console.warn('[EMAILJS] Private Key missing! Falling back to terminal logging only.');
    return { success: false, error: 'Private Key missing' };
  }

  const templateParams = {
    to_email: email,
    email: email,
    recipient: email,
    otp: otp,
    to_name: email.split('@')[0], // Fallback name
  };

  try {
    console.log(`[EMAILJS] Sending OTP to ${email}...`);
    const result = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      {
        publicKey: publicKey,
        privateKey: privateKey,
      }
    );
    console.log(`[EMAILJS] Successfully sent. Status: ${result.status}`);
    return { success: true, result };
  } catch (error) {
    console.error('[EMAILJS] Send Error:', error);
    throw new Error('Failed to send verification email via EmailJS.');
  }
};

module.exports = { sendEmailOTP };
