const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const ModerationLog = require('../models/ModerationLog');

// ============================================================
// HELPER: Create a moderation log entry
// ============================================================
const logAction = async (adminId, action, targetType, targetId, reason = '', metadata = {}) => {
  try {
    await ModerationLog.create({ adminId, action, targetType, targetId, reason, metadata });
  } catch (err) {
    console.error('[ADMIN] Failed to create moderation log:', err.message);
  }
};

// ============================================================
// REPORTS
// ============================================================

// @desc    Get all reports with optional filters
// @route   GET /api/admin/reports
// @access  Admin
const getReports = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('reportedBy', 'firstName lastName username email photos')
        .populate('resolvedBy', 'firstName lastName username')
        .lean(),
      Report.countDocuments(filter)
    ]);

    res.json({
      reports,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('[ADMIN] getReports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// @desc    Resolve a report
// @route   PUT /api/admin/reports/:id/resolve
// @access  Admin
const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, adminNotes } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: 'Resolution is required' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.status = 'resolved';
    report.resolution = resolution;
    report.adminNotes = adminNotes || '';
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
    await report.save();

    await logAction(req.user._id, 'resolve_report', 'report', report._id, adminNotes, { resolution });

    // Auto-actions based on resolution
    if (resolution === 'content_removed' && report.type === 'post') {
      await Post.findByIdAndUpdate(report.targetId, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id
      });
      await logAction(req.user._id, 'delete_content', 'post', report.targetId, 'Auto-removed via report resolution');
    }

    if (resolution === 'user_suspended') {
      // Find the target user for user-type reports, or the post author for post-type reports
      let targetUserId = report.targetId;
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId);
        if (post) targetUserId = post.userId;
      }

      await User.findByIdAndUpdate(targetUserId, { isSuspended: true });
      await logAction(req.user._id, 'suspend_user', 'user', targetUserId, 'Suspended via report resolution');
    }

    if (resolution === 'warned') {
      let targetUserId = report.targetId;
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId);
        if (post) targetUserId = post.userId;
      }

      const user = await User.findById(targetUserId);
      if (user) {
        user.warningCount = (user.warningCount || 0) + 1;
        if (user.warningCount >= 3) {
          user.isSuspended = true;
          await logAction(req.user._id, 'suspend_user', 'user', user._id, 'Auto-suspended: warning threshold reached');
        }
        await user.save({ validateBeforeSave: false });
        await logAction(req.user._id, 'warn_user', 'user', user._id, adminNotes, { warningCount: user.warningCount });
      }
    }

    res.json({ message: 'Report resolved successfully', report });
  } catch (error) {
    console.error('[ADMIN] resolveReport error:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
};

// ============================================================
// CONTENT MODERATION
// ============================================================

// @desc    Soft-delete content (post)
// @route   PUT /api/admin/content/:id/soft-delete
// @access  Admin
const softDeleteContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Content not found' });
    }

    post.isDeleted = true;
    post.deletedAt = new Date();
    post.deletedBy = req.user._id;
    await post.save();

    await logAction(req.user._id, 'delete_content', 'post', post._id, reason || 'Admin removed');

    res.json({ message: 'Content soft-deleted successfully' });
  } catch (error) {
    console.error('[ADMIN] softDeleteContent error:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
};

// @desc    Restore soft-deleted content
// @route   PUT /api/admin/content/:id/restore
// @access  Admin
const restoreContent = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Content not found' });
    }

    post.isDeleted = false;
    post.deletedAt = undefined;
    post.deletedBy = undefined;
    await post.save();

    await logAction(req.user._id, 'restore_content', 'post', post._id, 'Content restored by admin');

    res.json({ message: 'Content restored successfully' });
  } catch (error) {
    console.error('[ADMIN] restoreContent error:', error);
    res.status(500).json({ error: 'Failed to restore content' });
  }
};

// ============================================================
// USER MANAGEMENT
// ============================================================

// @desc    List users with filters
// @route   GET /api/admin/users
// @access  Admin
const getUsers = async (req, res) => {
  try {
    const { search, role, suspended, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (suspended === 'true') filter.isSuspended = true;
    if (suspended === 'false') filter.isSuspended = false;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('firstName lastName username email phone role isSuspended warningCount isActive photos createdAt lastSeen')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      users,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('[ADMIN] getUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// @desc    Suspend a user
// @route   PUT /api/admin/users/:id/suspend
// @access  Admin
const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent suspending admins/superadmins unless you're superadmin
    if (['admin', 'superadmin'].includes(user.role) && req.user.role !== 'superadmin') {
      return res.status(404).json({ error: 'Route not found' });
    }

    user.isSuspended = true;
    await user.save({ validateBeforeSave: false });

    await logAction(req.user._id, 'suspend_user', 'user', user._id, reason || 'Suspended by admin');

    res.json({ message: 'User suspended successfully' });
  } catch (error) {
    console.error('[ADMIN] suspendUser error:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
};

// @desc    Unsuspend a user
// @route   PUT /api/admin/users/:id/unsuspend
// @access  Admin
const unsuspendUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isSuspended = false;
    await user.save({ validateBeforeSave: false });

    await logAction(req.user._id, 'unsuspend_user', 'user', user._id, 'Unsuspended by admin');

    res.json({ message: 'User unsuspended successfully' });
  } catch (error) {
    console.error('[ADMIN] unsuspendUser error:', error);
    res.status(500).json({ error: 'Failed to unsuspend user' });
  }
};

// @desc    Warn a user (auto-suspend at threshold)
// @route   PUT /api/admin/users/:id/warn
// @access  Admin
const warnUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.warningCount = (user.warningCount || 0) + 1;
    let autoSuspended = false;

    if (user.warningCount >= 3) {
      user.isSuspended = true;
      autoSuspended = true;
      await logAction(req.user._id, 'suspend_user', 'user', user._id, 'Auto-suspended: warning threshold (3) reached');
    }

    await user.save({ validateBeforeSave: false });

    await logAction(req.user._id, 'warn_user', 'user', user._id, reason || 'Warning issued', {
      warningCount: user.warningCount,
      autoSuspended
    });

    res.json({
      message: autoSuspended
        ? `User warned (${user.warningCount}/3) and auto-suspended`
        : `User warned (${user.warningCount}/3)`,
      warningCount: user.warningCount,
      autoSuspended
    });
  } catch (error) {
    console.error('[ADMIN] warnUser error:', error);
    res.status(500).json({ error: 'Failed to warn user' });
  }
};

// ============================================================
// DASHBOARD STATS
// ============================================================

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
const getStats = async (req, res) => {
  try {
    const [totalUsers, suspendedUsers, pendingReports, totalReports, totalPosts] = await Promise.all([
      User.countDocuments({ isDeleted: { $ne: true } }),
      User.countDocuments({ isSuspended: true }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments(),
      Post.countDocuments({ isDeleted: { $ne: true } })
    ]);

    res.json({
      totalUsers,
      suspendedUsers,
      pendingReports,
      totalReports,
      totalPosts
    });
  } catch (error) {
    console.error('[ADMIN] getStats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

// ============================================================
// MODERATION LOGS
// ============================================================

// @desc    Get moderation logs
// @route   GET /api/admin/logs
// @access  Admin
const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30, action } = req.query;
    const filter = {};
    if (action) filter.action = action;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      ModerationLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('adminId', 'firstName lastName username')
        .lean(),
      ModerationLog.countDocuments(filter)
    ]);

    res.json({
      logs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('[ADMIN] getLogs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

// ============================================================
// SUPERADMIN-ONLY: ROLE MANAGEMENT
// ============================================================

// @desc    Change user role
// @route   PUT /api/admin/users/:id/role
// @access  Superadmin only
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot demote yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save({ validateBeforeSave: false });

    const actionType = ['admin', 'superadmin'].includes(role) ? 'promote_user' : 'demote_user';
    await logAction(req.user._id, actionType, 'user', user._id, `Role changed: ${oldRole} → ${role}`, {
      oldRole,
      newRole: role
    });

    res.json({
      message: `User role updated to ${role}`,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[ADMIN] changeUserRole error:', error);
    res.status(500).json({ error: 'Failed to change user role' });
  }
};

module.exports = {
  getReports,
  resolveReport,
  softDeleteContent,
  restoreContent,
  getUsers,
  suspendUser,
  unsuspendUser,
  warnUser,
  getStats,
  getLogs,
  changeUserRole
};
