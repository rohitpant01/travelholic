const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const ModerationLog = require('../models/ModerationLog');
const { createNotification } = require('../utils/notificationService');
const { recalculateTrustScore } = require('../utils/trustScoreService');

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

/**
 * Helper: Notify the reporter about report resolution
 */
const notifyReporter = async (report, responseType) => {
  try {
    const messages = {
      content_removed: 'Thanks for your report. The content was removed for violating our community guidelines.',
      no_violation: 'We reviewed your report and did not find a violation of our community guidelines.',
      action_taken: 'Thanks for your report. We took action against the reported content/user.'
    };

    await createNotification({
      recipient: report.reportedBy,
      sender: report.resolvedBy || report.reportedBy,
      type: 'report_resolved',
      title: 'Report Update',
      message: messages[responseType] || 'Your report has been reviewed.',
      data: { reportId: report._id }
    });

    // Update report with response tracking
    report.reporterResponse = responseType;
    report.reporterNotified = true;
    await report.save();
  } catch (err) {
    console.error('[ADMIN] Failed to notify reporter:', err.message);
  }
};

/**
 * Helper: Notify the content author about moderation action
 */
const notifyAuthor = async (authorId, adminId, notifType, message, data = {}) => {
  try {
    await createNotification({
      recipient: authorId,
      sender: adminId,
      type: notifType,
      title: 'Moderation Notice',
      message,
      data,
      priority: 'high'
    });
  } catch (err) {
    console.error('[ADMIN] Failed to notify author:', err.message);
  }
};

// ============================================================
// REPORTS
// ============================================================

// @desc    Get all reports with optional filters (enhanced with trust scores + grouped view)
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
        .populate('reportedBy', 'firstName lastName username email photos trustScore')
        .populate('resolvedBy', 'firstName lastName username')
        .lean(),
      Report.countDocuments(filter)
    ]);

    // Enrich: aggregate unique reporter count per target
    const enrichedReports = await Promise.all(reports.map(async (report) => {
      const targetReportCount = await Report.countDocuments({
        targetId: report.targetId,
        type: report.type,
        status: { $in: ['pending', 'reviewed'] }
      });

      // Fetch content preview based on type
      let contentPreview = null;
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId)
          .select('content images userId status reportScore')
          .populate('userId', 'firstName lastName username photos')
          .lean();
        contentPreview = post;
      } else if (report.type === 'comment') {
        const comment = await Comment.findById(report.targetId)
          .select('text userId postId status')
          .populate('userId', 'firstName lastName username')
          .lean();
        contentPreview = comment;
      } else if (report.type === 'user') {
        const user = await User.findById(report.targetId)
          .select('firstName lastName username email photos trustScore isSuspended isBanned warningCount')
          .lean();
        contentPreview = user;
      }

      return {
        ...report,
        targetReportCount,
        contentPreview
      };
    }));

    res.json({
      reports: enrichedReports,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('[ADMIN] getReports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

// @desc    Get detailed report view (all reports for same target + recommended action)
// @route   GET /api/admin/reports/:id/details
// @access  Admin
const getReportDetails = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reportedBy', 'firstName lastName username email photos trustScore')
      .populate('resolvedBy', 'firstName lastName username');

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get all reports for the same target
    const relatedReports = await Report.find({
      targetId: report.targetId,
      type: report.type
    })
      .populate('reportedBy', 'firstName lastName username photos trustScore')
      .sort({ createdAt: -1 })
      .lean();

    // Get target info
    let target = null;
    let targetAuthor = null;
    if (report.type === 'post') {
      target = await Post.findById(report.targetId)
        .populate('userId', 'firstName lastName username photos trustScore warningCount violationHistory isSuspended isBanned')
        .lean();
      targetAuthor = target?.userId;
    } else if (report.type === 'comment') {
      target = await Comment.findById(report.targetId)
        .populate('userId', 'firstName lastName username photos trustScore warningCount violationHistory isSuspended isBanned')
        .lean();
      targetAuthor = target?.userId;
    } else if (report.type === 'user') {
      target = await User.findById(report.targetId)
        .select('firstName lastName username email photos trustScore warningCount violationHistory isSuspended isBanned createdAt')
        .lean();
      targetAuthor = target;
    }

    // Calculate aggregate score
    const weightedScore = relatedReports
      .filter(r => ['pending', 'reviewed'].includes(r.status))
      .reduce((sum, r) => sum + (r.weight || 1.0), 0);

    // Recommend action based on score + violation history
    const violationCount = targetAuthor?.violationHistory?.length || 0;
    let recommendedAction = 'dismissed';
    if (weightedScore >= 5 || violationCount >= 3) {
      recommendedAction = 'user_banned';
    } else if (weightedScore >= 3 || violationCount >= 2) {
      recommendedAction = 'user_suspended';
    } else if (weightedScore >= 2) {
      recommendedAction = 'content_removed';
    } else if (weightedScore >= 1) {
      recommendedAction = 'warned';
    }

    res.json({
      report,
      relatedReports,
      target,
      targetAuthor,
      aggregateScore: weightedScore,
      uniqueReporters: relatedReports.length,
      recommendedAction
    });
  } catch (error) {
    console.error('[ADMIN] getReportDetails error:', error);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
};

// @desc    Resolve a report (enhanced with notifications + trust score updates)
// @route   PUT /api/admin/reports/:id/resolve
// @access  Admin
const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, adminNotes, reporterResponse } = req.body;

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

    // ── Auto-actions based on resolution ──────────────────

    if (resolution === 'content_removed' && (report.type === 'post' || report.type === 'comment')) {
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId);
        if (post) {
          post.isDeleted = true;
          post.status = 'removed';
          post.deletedAt = new Date();
          post.deletedBy = req.user._id;
          await post.save();

          // Notify author
          await notifyAuthor(post.userId, req.user._id, 'content_removed',
            'Your post was removed for violating our community guidelines. Repeated violations may lead to account suspension.',
            { postId: post._id }
          );
        }
        await logAction(req.user._id, 'delete_content', 'post', report.targetId, 'Removed via report resolution');
      } else if (report.type === 'comment') {
        const comment = await Comment.findById(report.targetId);
        if (comment) {
          comment.isDeleted = true;
          comment.status = 'removed';
          await comment.save();
        }
        await logAction(req.user._id, 'delete_content', 'comment', report.targetId, 'Removed via report resolution');
      }

      // Notify reporter
      await notifyReporter(report, reporterResponse || 'content_removed');

      // Recalculate reporter trust (valid report → boost)
      await recalculateTrustScore(report.reportedBy);
    }

    if (resolution === 'user_suspended') {
      let targetUserId = report.targetId;
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId);
        if (post) targetUserId = post.userId;
      } else if (report.type === 'comment') {
        const comment = await Comment.findById(report.targetId);
        if (comment) targetUserId = comment.userId;
      }

      // Apply progressive suspension
      const user = await User.findById(targetUserId);
      if (user) {
        const violationCount = (user.violationHistory || []).length;
        let suspensionDays = 3; // Default: 3 days
        if (violationCount >= 2) suspensionDays = 7;
        if (violationCount >= 4) suspensionDays = 30;

        user.isSuspended = true;
        user.suspendedUntil = new Date(Date.now() + suspensionDays * 24 * 60 * 60 * 1000);
        user.violationHistory.push({
          type: 'suspension',
          reason: adminNotes || 'Suspended via report resolution',
          adminId: req.user._id
        });
        await user.save({ validateBeforeSave: false });

        await notifyAuthor(targetUserId, req.user._id, 'suspension_received',
          `Your account has been suspended for ${suspensionDays} days due to community guideline violations.`
        );

        await recalculateTrustScore(targetUserId);
      }

      await logAction(req.user._id, 'suspend_user', 'user', targetUserId, 'Suspended via report resolution');
      await notifyReporter(report, reporterResponse || 'action_taken');
      await recalculateTrustScore(report.reportedBy);
    }

    if (resolution === 'user_banned') {
      let targetUserId = report.targetId;
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId);
        if (post) targetUserId = post.userId;
      }

      const user = await User.findById(targetUserId);
      if (user) {
        user.isBanned = true;
        user.isSuspended = true;
        user.violationHistory.push({
          type: 'ban',
          reason: adminNotes || 'Permanently banned via report resolution',
          adminId: req.user._id
        });
        await user.save({ validateBeforeSave: false });

        await notifyAuthor(targetUserId, req.user._id, 'ban_received',
          'Your account has been permanently banned for severe violations of our community guidelines.'
        );

        // Soft-delete all user posts
        await Post.updateMany({ userId: targetUserId }, { isDeleted: true, status: 'removed' });

        await recalculateTrustScore(targetUserId);
      }

      await logAction(req.user._id, 'ban_user', 'user', targetUserId, adminNotes || 'Permanent ban');
      await notifyReporter(report, reporterResponse || 'action_taken');
      await recalculateTrustScore(report.reportedBy);
    }

    if (resolution === 'warned') {
      let targetUserId = report.targetId;
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId);
        if (post) targetUserId = post.userId;
      } else if (report.type === 'comment') {
        const comment = await Comment.findById(report.targetId);
        if (comment) targetUserId = comment.userId;
      }

      const user = await User.findById(targetUserId);
      if (user) {
        user.warningCount = (user.warningCount || 0) + 1;
        user.violationHistory.push({
          type: 'warning',
          reason: adminNotes || 'Warning via report resolution',
          adminId: req.user._id
        });

        // Auto-suspend at 3 warnings
        if (user.warningCount >= 3) {
          user.isSuspended = true;
          user.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          await logAction(req.user._id, 'suspend_user', 'user', user._id, 'Auto-suspended: warning threshold reached');

          await notifyAuthor(targetUserId, req.user._id, 'suspension_received',
            'Your account has been suspended for 7 days after receiving 3 warnings.'
          );
        } else {
          await notifyAuthor(targetUserId, req.user._id, 'warning_received',
            `You received a warning (${user.warningCount}/3). Repeated violations may lead to account suspension.`
          );
        }

        await user.save({ validateBeforeSave: false });
        await logAction(req.user._id, 'warn_user', 'user', user._id, adminNotes, { warningCount: user.warningCount });
        await recalculateTrustScore(targetUserId);
      }

      await notifyReporter(report, reporterResponse || 'action_taken');
      await recalculateTrustScore(report.reportedBy);
    }

    if (resolution === 'dismissed') {
      report.status = 'dismissed';
      await report.save();

      // Restore content if it was auto-hidden
      if (report.type === 'post') {
        const post = await Post.findById(report.targetId);
        if (post && post.status === 'under_review') {
          post.status = 'active';
          await post.save();

          await notifyAuthor(post.userId, req.user._id, 'content_restored',
            'Your post has been restored. Our review found no violations.'
          );
        }
      } else if (report.type === 'comment') {
        const comment = await Comment.findById(report.targetId);
        if (comment && comment.status === 'under_review') {
          comment.status = 'active';
          await comment.save();
        }
      }

      // Notify reporter: no violation
      await notifyReporter(report, reporterResponse || 'no_violation');

      // Invalid report → may reduce reporter trust
      await recalculateTrustScore(report.reportedBy);
    }

    // Also resolve all other pending reports for the same target
    if (['content_removed', 'user_suspended', 'user_banned'].includes(resolution)) {
      await Report.updateMany(
        { targetId: report.targetId, type: report.type, status: 'pending', _id: { $ne: report._id } },
        {
          status: 'resolved',
          resolution,
          resolvedBy: req.user._id,
          resolvedAt: new Date(),
          adminNotes: `Batch-resolved via report #${report._id}`,
          reporterResponse: reporterResponse || 'action_taken',
          reporterNotified: true
        }
      );
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
    post.status = 'removed';
    post.deletedAt = new Date();
    post.deletedBy = req.user._id;
    await post.save();

    await logAction(req.user._id, 'delete_content', 'post', post._id, reason || 'Admin removed');

    // Notify author
    await notifyAuthor(post.userId, req.user._id, 'content_removed',
      'Your post was removed by a moderator for violating community guidelines.',
      { postId: post._id }
    );

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
    post.status = 'active';
    post.deletedAt = undefined;
    post.deletedBy = undefined;
    await post.save();

    await logAction(req.user._id, 'restore_content', 'post', post._id, 'Content restored by admin');

    // Notify author
    await notifyAuthor(post.userId, req.user._id, 'content_restored',
      'Good news! Your post has been restored. Our review found no violations.',
      { postId: post._id }
    );

    res.json({ message: 'Content restored successfully' });
  } catch (error) {
    console.error('[ADMIN] restoreContent error:', error);
    res.status(500).json({ error: 'Failed to restore content' });
  }
};

// ============================================================
// USER MANAGEMENT
// ============================================================

// @desc    List users with filters (enhanced with trust scores)
// @route   GET /api/admin/users
// @access  Admin
const getUsers = async (req, res) => {
  try {
    const { search, role, suspended, banned, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (suspended === 'true') filter.isSuspended = true;
    if (suspended === 'false') filter.isSuspended = false;
    if (banned === 'true') filter.isBanned = true;
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
        .select('firstName lastName username email phone role isSuspended isBanned warningCount trustScore isActive photos createdAt lastSeen suspendedUntil violationHistory')
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

// @desc    Suspend a user (with progressive timed suspension)
// @route   PUT /api/admin/users/:id/suspend
// @access  Admin
const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, days } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent suspending admins/superadmins unless you're superadmin
    if (['admin', 'superadmin'].includes(user.role) && req.user.role !== 'superadmin') {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Progressive suspension duration
    const violationCount = (user.violationHistory || []).length;
    let suspensionDays = days || (violationCount >= 4 ? 30 : violationCount >= 2 ? 7 : 3);

    user.isSuspended = true;
    user.suspendedUntil = new Date(Date.now() + suspensionDays * 24 * 60 * 60 * 1000);
    user.violationHistory.push({
      type: 'suspension',
      reason: reason || 'Suspended by admin',
      adminId: req.user._id
    });
    await user.save({ validateBeforeSave: false });

    await logAction(req.user._id, 'suspend_user', 'user', user._id, reason || 'Suspended by admin', { suspensionDays });

    await notifyAuthor(user._id, req.user._id, 'suspension_received',
      `Your account has been suspended for ${suspensionDays} days. Reason: ${reason || 'Community guideline violation'}`
    );

    await recalculateTrustScore(user._id);

    res.json({
      message: `User suspended for ${suspensionDays} days`,
      suspendedUntil: user.suspendedUntil
    });
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
    user.suspendedUntil = undefined;
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
    user.violationHistory.push({
      type: 'warning',
      reason: reason || 'Warning issued',
      adminId: req.user._id
    });

    let autoSuspended = false;

    if (user.warningCount >= 3) {
      user.isSuspended = true;
      user.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      autoSuspended = true;
      await logAction(req.user._id, 'suspend_user', 'user', user._id, 'Auto-suspended: warning threshold (3) reached');

      await notifyAuthor(user._id, req.user._id, 'suspension_received',
        'Your account has been suspended for 7 days after receiving 3 warnings.'
      );
    } else {
      await notifyAuthor(user._id, req.user._id, 'warning_received',
        `You received a warning (${user.warningCount}/3). Reason: ${reason || 'Community guideline violation'}. Repeated violations may lead to suspension.`
      );
    }

    await user.save({ validateBeforeSave: false });

    await logAction(req.user._id, 'warn_user', 'user', user._id, reason || 'Warning issued', {
      warningCount: user.warningCount,
      autoSuspended
    });

    await recalculateTrustScore(user._id);

    res.json({
      message: autoSuspended
        ? `User warned (${user.warningCount}/3) and auto-suspended for 7 days`
        : `User warned (${user.warningCount}/3)`,
      warningCount: user.warningCount,
      autoSuspended
    });
  } catch (error) {
    console.error('[ADMIN] warnUser error:', error);
    res.status(500).json({ error: 'Failed to warn user' });
  }
};

// @desc    Ban a user permanently
// @route   PUT /api/admin/users/:id/ban
// @access  Admin
const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent banning admins/superadmins unless you're superadmin
    if (['admin', 'superadmin'].includes(user.role) && req.user.role !== 'superadmin') {
      return res.status(404).json({ error: 'Route not found' });
    }

    user.isBanned = true;
    user.isSuspended = true;
    user.violationHistory.push({
      type: 'ban',
      reason: reason || 'Permanently banned',
      adminId: req.user._id
    });
    await user.save({ validateBeforeSave: false });

    // Soft-delete all user's posts
    await Post.updateMany({ userId: user._id }, { isDeleted: true, status: 'removed' });

    await logAction(req.user._id, 'ban_user', 'user', user._id, reason || 'Permanently banned');

    await notifyAuthor(user._id, req.user._id, 'ban_received',
      `Your account has been permanently banned. Reason: ${reason || 'Severe violation of community guidelines'}`
    );

    await recalculateTrustScore(user._id);

    res.json({ message: 'User permanently banned' });
  } catch (error) {
    console.error('[ADMIN] banUser error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

// ============================================================
// DASHBOARD STATS (enhanced)
// ============================================================

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
const getStats = async (req, res) => {
  try {
    const [totalUsers, suspendedUsers, bannedUsers, pendingReports, totalReports, totalPosts, hiddenPosts] = await Promise.all([
      User.countDocuments({ isDeleted: { $ne: true } }),
      User.countDocuments({ isSuspended: true, isBanned: { $ne: true } }),
      User.countDocuments({ isBanned: true }),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments(),
      Post.countDocuments({ isDeleted: { $ne: true } }),
      Post.countDocuments({ status: { $in: ['under_review', 'hidden'] } })
    ]);

    res.json({
      totalUsers,
      suspendedUsers,
      bannedUsers,
      pendingReports,
      totalReports,
      totalPosts,
      hiddenPosts
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
};
