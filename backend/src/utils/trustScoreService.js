/**
 * Trust Score Service
 * 
 * Dynamic trust score calculator (0–100) based on:
 * - Account age
 * - Activity level (posts, completedTrips)
 * - Photo verification
 * - Valid past reports (reports that led to admin action)
 * - Invalid reports (dismissed by admin)
 * - Violation history
 * - Warning count
 */

const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');

/**
 * Calculate trust score for a user
 * @param {string} userId
 * @returns {number} Trust score 0–100
 */
const calculateTrustScore = async (userId) => {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return 50;

    let score = 50; // Base score

    // 1. Account age bonus: +1 per 10 days, max +15
    const daysSinceSignup = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    score += Math.min(15, Math.floor(daysSinceSignup / 10));

    // 2. Activity bonus: +1 per 5 posts, max +10
    const postCount = await Post.countDocuments({ userId, isDeleted: { $ne: true } });
    score += Math.min(10, Math.floor(postCount / 5));

    // 3. Photo verification bonus: +10
    if (user.isPhotoVerified) {
      score += 10;
    }

    // 4. Valid reports bonus: +3 per valid report, max +10
    const validReports = await Report.countDocuments({
      reportedBy: userId,
      status: 'resolved',
      resolution: { $in: ['warned', 'content_removed', 'user_suspended', 'user_banned'] }
    });
    score += Math.min(10, validReports * 3);

    // 5. Invalid reports penalty: -5 per dismissed report, max -10
    const invalidReports = await Report.countDocuments({
      reportedBy: userId,
      status: 'dismissed'
    });
    score -= Math.min(10, invalidReports * 5);

    // 6. Violation penalty: -8 per violation, max -25
    const violationCount = (user.violationHistory || []).length;
    score -= Math.min(25, violationCount * 8);

    // 7. Warning penalty: -3 per warning, max -10
    score -= Math.min(10, (user.warningCount || 0) * 3);

    // Clamp to 0–100
    score = Math.max(0, Math.min(100, Math.round(score)));

    return score;
  } catch (err) {
    console.error('[TRUST] Score calculation failed:', err.message);
    return 50; // Safe default
  }
};

/**
 * Get report weight based on trust score
 * @param {number} trustScore
 * @returns {number} Weight multiplier
 */
const getReportWeight = (trustScore) => {
  if (trustScore >= 80) return 1.5;  // High trust
  if (trustScore >= 50) return 1.0;  // Normal
  if (trustScore >= 25) return 0.5;  // Low trust
  return 0.25;                        // Untrusted
};

/**
 * Recalculate and persist trust score for a user
 * @param {string} userId
 * @returns {number} Updated trust score
 */
const recalculateTrustScore = async (userId) => {
  const score = await calculateTrustScore(userId);
  await User.findByIdAndUpdate(userId, { trustScore: score });
  return score;
};

module.exports = {
  calculateTrustScore,
  getReportWeight,
  recalculateTrustScore
};
