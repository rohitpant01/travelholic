// src/routes/auth.js
const express = require('express');
const router = express.Router();
const {
  register, login, sendOTPHandler, verifyOTPHandler,
  forgotPassword, resetPassword, googleLogin,
  sendEmailOTPHandler, verifyEmailOTPHandler,
  changeEmail
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOTPHandler);
router.post('/verify-otp', verifyOTPHandler);
router.post('/send-email-otp', sendEmailOTPHandler);
router.post('/verify-email-otp', verifyEmailOTPHandler);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/google', googleLogin);
router.post('/change-email', protect, changeEmail);

module.exports = router;
