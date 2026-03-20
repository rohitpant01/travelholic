const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getNotifications, markAllAsRead, clearNotifications } = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.put('/read', protect, markAllAsRead);
router.delete('/', protect, clearNotifications);

module.exports = router;
