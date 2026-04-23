const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`[AUTH] Token verified for userId: ${decoded.userId}`);
    const user = await User.findById(decoded.userId).select('-password -otp -otpExpiry');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // 🔥 Allow restoration requests to pass through even if account is inactive/deleted
    const isRestorationRequest = req.path.includes('/cancel-deletion') || req.originalUrl.includes('/cancel-deletion');
    console.log(`[AUTH] Request Path: ${req.path}, isRestoration: ${isRestorationRequest}, userDeleted: ${user?.isDeleted}`);

    req.user = user;

    if (!isRestorationRequest) {
      if (!user.isActive) {
        console.warn(`[AUTH] Blocking inactive user: ${user._id}`);
        return res.status(401).json({ error: 'Account has been deactivated' });
      }

      if (user.isSuspended) {
        console.warn(`[AUTH] Blocking suspended user: ${user._id}`);
        return res.status(403).json({ error: 'Account suspended. Contact support.' });
      }

      if (user.isDeleted) {
        console.warn(`[AUTH] Blocking deleted user: ${user._id}`);
        return res.status(401).json({ error: 'Account is scheduled for deletion. Please restore it to continue.' });
      }
    } else {
      console.log(`[AUTH] Permitting restoration request for user: ${user._id}`);
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(401).json({ error: 'Not authorized, invalid token' });
  }
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const generateTokenWithRole = (userId, role) => {
  return jwt.sign({ userId, role: role || 'user' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const protectOptional = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (user && user.isActive && !user.isDeleted) {
      req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = { protect, protectOptional, generateToken, generateTokenWithRole };
