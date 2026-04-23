/**
 * Moderation Engine
 * 
 * Smart threshold-based content moderation with:
 * - Trust-weighted report scoring
 * - Automatic content hiding when threshold reached
 * - Mass-report abuse detection
 * - Duplicate report prevention (DB-level unique index)
 */

const Report = require('../models/Report');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const ModerationLog = require('../models/ModerationLog');
const { recalculateTrustScore, getReportWeight } = require('./trustScoreService');
const { createNotification } = require('./notificationService');

// ── Thresholds ──────────────────────────────────────────────
const THRESHOLDS = {
  post: 3.0,
  comment: 2.5,
  user: 5.0,
  group: 4.0
};

const MASS_REPORT_LIMIT = 5;        // Max reports per window
const MASS_REPORT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MASS_REPORT_WEIGHT_PENALTY = 0.1;

/**
 * Main report processing pipeline
 * @returns {{ success, duplicate, rateLimited, autoHidden, report }}
 */
const processReport = async (reporterId, targetId, targetType, reason, details = '') => {
  try {
    // 1. Mass-report abuse detection
    const massReportCheck = await detectMassReporting(reporterId);
    if (massReportCheck.rateLimited) {
      return { success: false, rateLimited: true, message: 'Too many reports. Please try again later.' };
    }

    // 2. Recalculate reporter's trust score
    const trustScore = await recalculateTrustScore(reporterId);
    let weight = getReportWeight(trustScore);

    // Apply mass-report penalty if flagged
    if (massReportCheck.penalized) {
      weight = MASS_REPORT_WEIGHT_PENALTY;
    }

    // 3. Immutable Snapshot Construction
    let targetSnapshot = {};
    try {
      if (targetType === 'user') {
        const targetUser = await User.findById(targetId).select('firstName lastName username photos bio location.city');
        if (targetUser) {
          targetSnapshot = {
             displayName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
             username: targetUser.username,
             photo: targetUser.photos?.find(p => p.isProfile)?.url || targetUser.photos?.[0]?.url || null,
             bio: targetUser.bio,
             city: targetUser.location?.city
          };
        }
      } else if (targetType === 'post') {
        const targetPost = await Post.findById(targetId).populate('userId', 'firstName lastName photos');
        if (targetPost) {
           targetSnapshot = {
              text: targetPost.content || targetPost.caption || '',
              images: targetPost.media || targetPost.photos || targetPost.images || [], // handle various post schema structures
              authorName: targetPost.userId ? `${targetPost.userId.firstName || ''} ${targetPost.userId.lastName || ''}`.trim() : 'Unknown',
              authorPhoto: targetPost.userId?.photos?.find(p => p.isProfile)?.url || targetPost.userId?.photos?.[0]?.url || null,
              createdAt: targetPost.createdAt
           };
        }
      } else if (targetType === 'comment') {
        const targetComment = await Comment.findById(targetId).populate('userId', 'firstName lastName photos');
        if (targetComment) {
           targetSnapshot = {
              text: targetComment.text || targetComment.content || '',
              authorName: targetComment.userId ? `${targetComment.userId.firstName || ''} ${targetComment.userId.lastName || ''}`.trim() : 'Unknown',
              authorPhoto: targetComment.userId?.photos?.find(p => p.isProfile)?.url || targetComment.userId?.photos?.[0]?.url || null,
              createdAt: targetComment.createdAt
           };
        }
      }
    } catch (snapshotErr) {
       console.warn(`[MODERATION] Failed to build snapshot for ${targetType} ${targetId}`, snapshotErr);
    }

    // 4. Create report (unique index prevents duplicates)
    let report;
    try {
      report = await Report.create({
        reportedBy: reporterId,
        targetId,
        type: targetType,
        reason,
        details,
        reporterTrustScore: trustScore,
        weight,
        targetSnapshot
      });
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate report — user already reported this target
        return { success: false, duplicate: true, message: 'You have already reported this content.' };
      }
      throw err;
    }

    // 5. Calculate aggregate weighted score for this target
    const { weightedScore, uniqueReporters } = await calculateWeightedScore(targetId, targetType);

    // 6. Update target's report stats
    await updateTargetReportStats(targetId, targetType, weightedScore, uniqueReporters);

    // 7. Check threshold for auto-hide
    let autoHidden = false;
    const threshold = THRESHOLDS[targetType] || 3.0;
    if (weightedScore >= threshold) {
      autoHidden = await autoHideContent(targetId, targetType, reporterId);
    }

    console.log(`[MODERATION] Report processed: type=${targetType}, target=${targetId}, score=${weightedScore.toFixed(2)}/${threshold}, autoHidden=${autoHidden}`);

    return { success: true, duplicate: false, rateLimited: false, autoHidden, report, weightedScore };
  } catch (err) {
    console.error('[MODERATION] processReport failed:', err);
    throw err;
  }
};

/**
 * Calculate aggregate weighted score for a target
 */
const calculateWeightedScore = async (targetId, targetType) => {
  const reports = await Report.find({
    targetId,
    type: targetType,
    status: { $in: ['pending', 'reviewed'] }
  }).lean();

  const weightedScore = reports.reduce((sum, r) => sum + (r.weight || 1.0), 0);
  const uniqueReporters = reports.length;

  return { weightedScore, uniqueReporters };
};

/**
 * Update report stats on the target document
 */
const updateTargetReportStats = async (targetId, targetType, weightedScore, uniqueReporters) => {
  try {
    if (targetType === 'post') {
      await Post.findByIdAndUpdate(targetId, { reportScore: weightedScore, reportCount: uniqueReporters });
    }
    // Comments and users don't have reportScore fields — tracked via Report aggregation
  } catch (err) {
    console.warn('[MODERATION] Failed to update target stats:', err.message);
  }
};

/**
 * Auto-hide content that exceeded the threshold
 */
const autoHideContent = async (targetId, targetType, reporterId) => {
  try {
    if (targetType === 'post') {
      const post = await Post.findById(targetId);
      if (post && post.status === 'active') {
        post.status = 'under_review';
        await post.save();

        // Notify the author
        await createNotification({
          recipient: post.userId,
          sender: reporterId,
          type: 'content_hidden',
          title: 'Content Under Review',
          message: 'Your post has been hidden for review due to community reports. Our team will review it shortly.',
          data: { postId: post._id }
        });

        await ModerationLog.create({
          adminId: reporterId, // System-triggered by reporter
          action: 'auto_hide_content',
          targetType: 'post',
          targetId: post._id,
          reason: 'Auto-hidden: report threshold reached'
        });

        return true;
      }
    }

    if (targetType === 'comment') {
      const comment = await Comment.findById(targetId);
      if (comment && comment.status === 'active') {
        comment.status = 'under_review';
        await comment.save();
        return true;
      }
    }

    if (targetType === 'user') {
      // Don't auto-suspend users — flag for admin review only
      console.log(`[MODERATION] User ${targetId} flagged for admin review (threshold reached)`);
      return false;
    }

    return false;
  } catch (err) {
    console.error('[MODERATION] autoHideContent failed:', err.message);
    return false;
  }
};

/**
 * Detect mass-reporting abuse
 * If a user files > MASS_REPORT_LIMIT reports within MASS_REPORT_WINDOW:
 *   - Their weight is reduced to 0.1
 *   - Their trust score drops by 10
 *   - Incident is logged
 */
const detectMassReporting = async (reporterId) => {
  try {
    const windowStart = new Date(Date.now() - MASS_REPORT_WINDOW_MS);

    const recentReportCount = await Report.countDocuments({
      reportedBy: reporterId,
      createdAt: { $gte: windowStart }
    });

    if (recentReportCount >= MASS_REPORT_LIMIT) {
      // Rate limit: block further reports if > 2x the limit
      if (recentReportCount >= MASS_REPORT_LIMIT * 2) {
        return { rateLimited: true, penalized: true };
      }

      // Penalize: reduce trust score
      const user = await User.findById(reporterId);
      if (user) {
        user.trustScore = Math.max(0, (user.trustScore || 50) - 10);
        await user.save({ validateBeforeSave: false });
      }

      await ModerationLog.create({
        adminId: reporterId,
        action: 'mass_report_detected',
        targetType: 'user',
        targetId: reporterId,
        reason: `User filed ${recentReportCount} reports in 1 hour`,
        metadata: { recentReportCount }
      });

      return { rateLimited: false, penalized: true };
    }

    return { rateLimited: false, penalized: false };
  } catch (err) {
    console.error('[MODERATION] Mass-report detection failed:', err.message);
    return { rateLimited: false, penalized: false };
  }
};

module.exports = {
  processReport,
  calculateWeightedScore,
  autoHideContent,
  detectMassReporting,
  THRESHOLDS
};
