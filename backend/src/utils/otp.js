const twilio = require('twilio');

// ================================================================
// TWILIO CLIENT SETUP
// Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
// to your .env file
// ================================================================
let client;
try {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
} catch (error) {
  console.warn('⚠️  Twilio client init failed. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
}

// Send OTP via Twilio Verify Service
const sendOTP = async (phoneNumber) => {
  try {
    if (!client) throw new Error('Twilio client not initialized');

    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: phoneNumber,
        channel: 'sms',
      });

    return { success: true, status: verification.status };
  } catch (error) {
    console.error('Send OTP error:', error.message);
    throw new Error('Failed to send OTP. Please check your phone number.');
  }
};

// Verify OTP via Twilio Verify Service
const verifyOTP = async (phoneNumber, code) => {
  try {
    if (!client) throw new Error('Twilio client not initialized');

    const verificationCheck = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: phoneNumber,
        code,
      });

    return {
      success: verificationCheck.status === 'approved',
      status: verificationCheck.status,
    };
  } catch (error) {
    console.error('Verify OTP error:', error.message);
    throw new Error('OTP verification failed. Please try again.');
  }
};

module.exports = { sendOTP, verifyOTP };
