// src/routes/auth.js
const express = require('express');
const router = express.Router();
const {
  register, login, sendOTPHandler, verifyOTPHandler,
  forgotPassword, resetPassword, googleLogin
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOTPHandler);
router.post('/verify-otp', verifyOTPHandler);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
