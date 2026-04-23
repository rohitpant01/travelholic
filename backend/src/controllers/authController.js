const User = require('../models/User');
const { generateToken, generateTokenWithRole } = require('../middleware/auth');
const { sendOTP, verifyOTP } = require('../utils/otp');
const { sendEmailOTP } = require('../utils/email');
const { OAuth2Client } = require('google-auth-library');
const { updateDeviceToken } = require('../utils/deviceUtility'); // Add this

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register new user - Step 1
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    console.log('[DEBUG] Registration body:', JSON.stringify(req.body, null, 2));
    const { firstName, lastName, username, email, phone, password, authProvider } = req.body;
    console.log(`[AUTH] Registration attempt: ${email} (${phone})`);
    
    // Check for existing users
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      console.log(`[AUTH] Registration failed: Email ${email} already exists`);
      return res.status(400).json({ error: 'Email already registered' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      console.log(`[AUTH] Registration failed: Username ${username} already exists`);
      return res.status(400).json({ error: 'Username already taken' });
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      console.log(`[AUTH] Registration failed: Phone ${phone} already exists`);
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Create user
    console.log(`[AUTH] Creating user for ${email}...`);
    const isGoogle = !!req.body.googleId || req.body.authProvider === 'google';
    console.log(`[DEBUG] isGoogle: ${isGoogle} (googleId: ${req.body.googleId}, authProvider: ${req.body.authProvider})`);
    
    const userPayload = {
      firstName,
      lastName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      phone,
      password: password || `google_${Date.now()}_${Math.random().toString(36).slice(-8)}`,
      // Google users: skip all OTP, go straight to onboarding (step 4)
      // Email users: start at step 2 (Email Verification)
      registrationStep: isGoogle ? 4 : 2,
      isPhoneVerified: true, // Phone OTP is disabled — phone collected but not verified
      isEmailVerified: isGoogle ? true : false, // Google users are auto-verified
      authProvider: authProvider || (isGoogle ? 'google' : 'local')
    };
    if (req.body.googleId) userPayload.googleId = req.body.googleId;
    if (req.body.picture) {
      userPayload.photos = [{ url: req.body.picture, publicId: `google_${req.body.googleId}`, isProfile: true }];
    }

    console.log(`[DEBUG] Final userPayload to be created:`, JSON.stringify(userPayload, null, 2));

    const user = await User.create(userPayload);
    
    // Multi-device support: Save token if provided
    if (req.body.pushToken) {
      updateDeviceToken(user, req.body.pushToken, req.body.platform, req.body.deviceId);
      await user.save({ validateBeforeSave: false });
    }

    console.log(`[DEBUG] Created user from DB: id=${user._id}, isEmailVerified=${user.isEmailVerified}, step=${user.registrationStep}`);

    // Send Email OTP only for non-Google users
    if (!isGoogle) {
      console.log(`[AUTH] Sending Email OTP to ${email}...`);
      const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('=========================================');
      console.log(`📧  VERIFICATION CODE FOR ${email}: ${emailOtp}`);
      console.log('=========================================');
      user.emailOtp = emailOtp;
      user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      await user.save({ validateBeforeSave: false });

      try {
        await sendEmailOTP(email, emailOtp);
      } catch (emailError) {
        console.error('[AUTH] Email OTP send failed:', emailError.message);
      }
    } else {
      console.log(`[AUTH] Google user ${email} — skipping email OTP, auto-verified.`);
    }

    const token = generateToken(user._id);
    console.log(`[AUTH] Registration successful for ${email}. Token generated.`);

    const publicUser = user.toPublicProfile();
    console.log(`[DEBUG] Final response user object for ${email}:`, JSON.stringify(publicUser, null, 2));

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: publicUser,
    });
  } catch (error) {
    console.error('[AUTH] Register error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
};

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    console.log(`[AUTH] Login attempt: ${emailOrPhone}`);

    // Find by email or phone
    let identifier = emailOrPhone;
    let query = [
      { email: identifier?.toLowerCase() },
      { phone: identifier },
    ];

    // If it looks like a 10-digit Indian number, also check with +91
    if (/^\d{10}$/.test(identifier)) {
      query.push({ phone: `+91${identifier}` });
    }

    const user = await User.findOne({ $or: query });

    if (!user) {
      console.log(`[AUTH] Login failed: User ${emailOrPhone} not found`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log(`[AUTH] Login failed: Incorrect password for ${emailOrPhone}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update Devices/Tokens (Multi-device support)
    if (req.body.pushToken) {
      updateDeviceToken(user, req.body.pushToken, req.body.platform, req.body.deviceId);
    }

    // Update last seen
    user.lastSeen = new Date();
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    const token = generateTokenWithRole(user._id, user.role);
    console.log(`[AUTH] Login successful for ${emailOrPhone}`);

    res.json({
      message: user.isDeleted ? 'Account scheduled for deletion' : 'Login successful',
      token,
      user: user.toPublicProfile(),
      role: user.role || 'user',
      isDeletionPending: user.isDeleted || false,
      deletionScheduledAt: user.deletionScheduledAt || null
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// @desc    Send OTP
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTPHandler = async (req, res) => {
  try {
    const { phone, checkExists } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    if (checkExists) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ error: 'This phone number is already registered to another account.' });
      }
    }

    const finalPhone = phone; // Use a consistent variable name
    console.log(`[AUTH] Sending Phone OTP to ${finalPhone}...`);
    try {
      await sendOTP(finalPhone);
      console.log('=========================================');
      console.log(`📱  PHONE VERIFICATION REQUESTED FOR ${finalPhone}`);
      console.log('=========================================');
      res.json({ message: 'OTP sent successfully' });
    } catch (error) {
      console.error('[AUTH] Send OTP error:', error.message);
      res.status(500).json({ error: error.message });
    }
  } catch (outerError) {
    console.error('[AUTH] Outer Send OTP error:', outerError.message);
    res.status(500).json({ error: outerError.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTPHandler = async (req, res) => {
  try {
    const { phone, code, userId } = req.body;
    console.log(`[AUTH] OTP Verification attempt for ${phone}, code: ${code}`);

    if (!phone || !code) return res.status(400).json({ error: 'Phone and OTP code required' });

    const result = await verifyOTP(phone, code);

    if (!result.success) {
      console.log(`[AUTH] OTP Verification failed for ${phone}`);
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark phone as verified and save the actual phone
    console.log(`[AUTH] OTP Verified for ${phone}. Updating user ${userId}...`);
    if (userId) {
      const updatedUser = await User.findByIdAndUpdate(userId, {
        phone: phone, // <-- Save the verified phone!
        isPhoneVerified: true,
        registrationStep: 4,
      }, { new: true });
      
      if (!updatedUser) {
        console.warn(`[AUTH] User ${userId} not found during verify-otp update`);
      } else {
        console.log(`[AUTH] User ${userId} updated successfully.`);
      }
    }

    res.json({ message: 'Phone verified successfully', verified: true });
  } catch (error) {
    console.error('[AUTH] Verify OTP handler error:', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account with this email address' });

    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOtp = emailOtp;
    user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save({ validateBeforeSave: false });

    console.log('=========================================');
    console.log(`📧  FORGOT PASSWORD OTP FOR ${email}: ${emailOtp}`);
    console.log('=========================================');

    try {
      await sendEmailOTP(email, emailOtp);
      res.json({ message: 'Password reset OTP sent to your email' });
    } catch (emailError) {
      console.error('[AUTH] Forgot password email send failed:', emailError.message);
      res.status(500).json({ error: 'Failed to send reset email. Try again.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check OTP
    if (!user.emailOtp || user.emailOtp !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Check expiry
    if (user.emailOtpExpiry && user.emailOtpExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // Success
    user.password = newPassword;
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    console.log(`[AUTH] Password reset successful for ${email}`);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('[AUTH] Reset Password error:', error);
    res.status(500).json({ error: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'ID Token required' });

    console.log('[AUTH] Google Sign-In attempt...');
    
    // Verify Google ID Token — accept tokens from any of our client IDs
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID,
        '898480493172-jk9gdd6ikil0e4285gcs7e424j5do5qd.apps.googleusercontent.com', // Android
      ],
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, given_name, family_name, picture } = payload;

    console.log(`[AUTH] Google verified user: ${email} (ID: ${googleId})`);

    // Find or create user
    let user = await User.findOne({ 
      $or: [
        { googleId },
        { email: email.toLowerCase() }
      ]
    });

    if (!user) {
      console.log(`[AUTH] New Google user, forwarding to step 1 (ID: ${googleId})`);
      return res.status(200).json({
        isNewUser: true,
        message: 'Google Sign-In successful. Please complete registration.',
        googleProfile: {
          googleId,
          email: email.toLowerCase(),
          firstName: given_name || '',
          lastName: family_name || '',
          picture: picture || ''
        }
      });
    } else if (!user.googleId) {
      // Link existing email account to Google
      console.log(`[AUTH] Linking existing account ${email} to Google...`);
      user.googleId = googleId;
      user.authProvider = 'google';
      await user.save({ validateBeforeSave: false });
    }

    // Google users are auto-verified — no email OTP needed
    if (!user.isEmailVerified) {
      console.log(`[AUTH] Google login: auto-verifying email for ${user.email}`);
      user.isEmailVerified = true;
      user.isPhoneVerified = true; // Phone OTP disabled
    }
    // Multi-device: Update token
    if (req.body.pushToken) {
      updateDeviceToken(user, req.body.pushToken, req.body.platform, req.body.deviceId);
      await user.save({ validateBeforeSave: false });
    }

    // Generate token
    const token = generateTokenWithRole(user._id, user.role);
    
    // Determine current effective step
    let effectiveStep = user.registrationStep || 4;
    
    res.status(200).json({
      message: user.isDeleted ? 'Account scheduled for deletion' : 'Google Sign-In successful',
      token,
      user: user.toPublicProfile(),
      role: user.role || 'user',
      isNewUser: false,
      isDeletionPending: user.isDeleted || false,
      deletionScheduledAt: user.deletionScheduledAt || null
    });
  } catch (error) {
    console.error('[AUTH] Google Sign-In error:', error.message);
    res.status(500).json({ error: 'Google authentication failed' });
  }
};

// @desc    Send Email OTP
// @route   POST /api/auth/send-email-otp
// @access  Private (or Public if userId provided)
const sendEmailOTPHandler = async (req, res) => {
  try {
    const { email, userId } = req.body;
    if (!email && !userId) return res.status(400).json({ error: 'Email or User ID required' });

    let user;
    if (userId) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('=========================================');
    console.log(`📧  RESEND VERIFICATION CODE FOR ${user.email}: ${emailOtp}`);
    console.log('=========================================');
    user.emailOtp = emailOtp;
    user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await sendEmailOTP(user.email, emailOtp);
    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('[AUTH] Send Email OTP error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Verify Email OTP
// @route   POST /api/auth/verify-email-otp
// @access  Public
const verifyEmailOTPHandler = async (req, res) => {
  try {
    const { email, code, userId } = req.body;
    if (!code) return res.status(400).json({ error: 'Verification code required' });

    let user;
    if (userId) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if expired
    if (user.emailOtpExpiry && user.emailOtpExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    if (user.emailOtp !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Success
    user.isEmailVerified = true;
    user.isPhoneVerified = true; // Phone OTP is disabled — auto-mark verified
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    
    // Skip phone OTP — advance directly to onboarding (step 4)
    if (user.registrationStep < 4) {
      user.registrationStep = 4;
      console.log(`[AUTH] Email verified for ${user.email}. Phone OTP disabled — advancing to step 4.`);
    }

    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Email verified successfully', verified: true });
  } catch (error) {
    console.error('[AUTH] Verify Email OTP error:', error);
    res.status(500).json({ error: error.message });
  }
};

const changeEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    const userId = req.user._id;

    if (!newEmail) return res.status(400).json({ error: 'New email required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify password if local
    if (user.authProvider === 'local') {
      if (!password) return res.status(400).json({ error: 'Password required' });
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check availability
    const existing = await User.findOne({ email: newEmail.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already taken' });

    // Update
    user.email = newEmail.toLowerCase();
    user.isEmailVerified = false;

    const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOtp = emailOtp;
    user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    console.log('=========================================');
    console.log(`📧  CHANGE EMAIL OTP FOR ${user.email}: ${emailOtp}`);
    console.log('=========================================');

    try {
      await sendEmailOTP(user.email, emailOtp);
    } catch (err) {
      console.error('[AUTH] Change email OTP send failed:', err.message);
    }

    res.json({
      message: 'Email updated successfully. Please verify your new email.',
      user: {
        _id: user._id,
        email: user.email,
        isEmailVerified: false,
        registrationStep: 2
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  register,
  login,
  sendOTPHandler,
  verifyOTPHandler,
  forgotPassword,
  resetPassword,
  googleLogin,
  sendEmailOTPHandler,
  verifyEmailOTPHandler,
  changeEmail
};

