const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../middleware/adminAuth');
const {
  getReports,
  getReportDetails,
  resolveReport,
  softDeleteContent,
  restoreContent,
  getUsers,
  suspendUser,
  unsuspendUser,
  warnUser,
  banUser,
  getStats,
  getLogs,
  changeUserRole
} = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(protect);
router.use(requireAdmin);

// Reports
router.get('/reports', getReports);
router.get('/reports/:id/details', getReportDetails);
router.put('/reports/:id/resolve', resolveReport);

// Content Moderation
router.put('/content/:id/soft-delete', softDeleteContent);
router.put('/content/:id/restore', restoreContent);

// User Management
router.get('/users', getUsers);
router.put('/users/:id/suspend', suspendUser);
router.put('/users/:id/unsuspend', unsuspendUser);
router.put('/users/:id/warn', warnUser);
router.put('/users/:id/ban', banUser);

// Dashboard
router.get('/stats', getStats);

// Moderation Logs
router.get('/logs', getLogs);

// Superadmin-only: Role Management
router.put('/users/:id/role', requireSuperAdmin, changeUserRole);

module.exports = router;
