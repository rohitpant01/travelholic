const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getNotifications, markAllAsRead, clearNotifications, acknowledgeDelivery, syncNotifications } = require('../controllers/notificationController');

router.get('/', protect, getNotifications);
router.put('/read', protect, markAllAsRead);
router.delete('/', protect, clearNotifications);
router.post('/ack', protect, acknowledgeDelivery);
router.get('/sync', protect, syncNotifications);

module.exports = router;
