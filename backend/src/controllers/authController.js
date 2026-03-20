const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { sendOTP, verifyOTP } = require('../utils/otp');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register new user - Step 1
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    console.log('[DEBUG] Registration body:', JSON.stringify(req.body, null, 2));
    const { firstName, lastName, username, email, phone, password } = req.body;
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
    const user = await User.create({
      firstName,
      lastName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      phone,
      password,
      registrationStep: 2,
    });

    // Send OTP to phone
    console.log(`[AUTH] Sending OTP to ${phone}...`);
    try {
      await sendOTP(phone);
    } catch (otpError) {
      console.error('[AUTH] OTP send failed:', otpError.message);
      // Don't fail registration if OTP fails — user can resend
    }

    const token = generateToken(user._id);
    console.log(`[AUTH] Registration successful for ${email}. Token generated.`);

    res.status(201).json({
      message: 'Account created. Please verify your phone number.',
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        registrationStep: user.registrationStep,
        isPhoneVerified: user.isPhoneVerified,
      },
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

    // Update last seen
    user.lastSeen = new Date();
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    console.log(`[AUTH] Login successful for ${emailOrPhone}`);

    res.json({
      message: 'Login successful',
      token,
      user: user.toPublicProfile(),
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
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    console.log(`[AUTH] Resending OTP to ${phone}...`);
    await sendOTP(phone);
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('[AUTH] Send OTP error:', error.message);
    res.status(500).json({ error: error.message });
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

    // Mark phone as verified
    console.log(`[AUTH] OTP Verified for ${phone}. Updating user ${userId}...`);
    if (userId) {
      const updatedUser = await User.findByIdAndUpdate(userId, {
        isPhoneVerified: true,
        registrationStep: 3,
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
    const { phone } = req.body;
    const user = await User.findOne({ phone });

    if (!user) return res.status(404).json({ error: 'No account with this phone number' });

    await sendOTP(phone);
    res.json({ message: 'Password reset OTP sent to your phone' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Reset password with OTP
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;

    const result = await verifyOTP(phone, code);
    if (!result.success) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'ID Token required' });

    console.log('[AUTH] Google Sign-In attempt...');
    
    // Verify Google ID Token
    // We don't strictly pass audience if we want the library to auto-accept tokens 
    // from our Android, iOS, or Web clients as long as they are valid.
    const ticket = await googleClient.verifyIdToken({
      idToken,
      // audience: [ANDROID_CLIENT_ID, IOS_CLIENT_ID, WEB_CLIENT_ID]
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
      console.log(`[AUTH] Creating new user for Google ID: ${googleId}`);
      // Create new user with basic info from Google
      // We set a dummy phone number so the schema validation doesn't fail. 
      // They MUST complete Step 2 (OTP) immediately after.
      user = await User.create({
        googleId,
        email: email.toLowerCase(),
        phone: `google_${googleId}`, // Temporary placeholder
        password: `google_${googleId}_${Date.now()}`, // Temporary placeholder
        firstName: given_name || 'Traveler',
        lastName: family_name || '',
        username: `user_${googleId.slice(-6)}_${Date.now().toString().slice(-4)}`,
        isEmailVerified: true,
        registrationStep: 2, // Must provide real phone number next
      });
      
      if (picture) {
        user.photos = [{ url: picture, publicId: `google_${googleId}`, isProfile: true }];
        await user.save({ validateBeforeSave: false });
      }
    } else if (!user.googleId) {
      // Link existing email account to Google
      user.googleId = googleId;
      await user.save({ validateBeforeSave: false });
    }

    // Generate token
    const token = generateToken(user._id);
    
    // Determine if they need to complete registration
    // If the phone starts with 'google_', they haven't provided a real phone number yet
    const needsPhone = user.phone.startsWith('google_');
    const step = needsPhone ? 2 : user.registrationStep;
    
    res.json({
      message: 'Google Sign-In successful',
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        registrationStep: step,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
  } catch (error) {
    console.error('[AUTH] Google Sign-In error:', error.message);
    res.status(500).json({ error: 'Google authentication failed' });
  }
};

module.exports = { register, login, sendOTPHandler, verifyOTPHandler, forgotPassword, resetPassword, googleLogin };
