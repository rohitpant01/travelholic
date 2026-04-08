const User = require('../models/User');
const { Trip, TripMember, TripMessage } = require('../models/Trip');
const Post = require('../models/Post');
const LyraItinerary = require('../models/LyraItinerary');
const AIItinerary = require('../models/AIItinerary');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const { Match } = require('../models/Match');
const Comment = require('../models/Comment');
const { deleteImage } = require('../config/cloudinary');

/**
 * Irreversibly purges all data associated with a user.
 * Designed for GDPR "Right to be Forgotten" compliance.
 */
const performHardPurge = async (userId) => {
  try {
    console.log(`[GDPR PURGE] Starting permanent deletion for user: ${userId}`);
    
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[GDPR PURGE] User ${userId} not found, skipping.`);
      return;
    }

    // 1. Delete Cloudinary Photos
    if (user.photos && user.photos.length > 0) {
      for (const photo of user.photos) {
        try {
          await deleteImage(photo.publicId);
          console.log(`[GDPR PURGE] Deleted Cloudinary image: ${photo.publicId}`);
        } catch (e) {
          console.error(`[GDPR PURGE] Photo delete failed: ${photo.publicId}`, e.message);
        }
      }
    }

    // 2. Clear Social Interactions (Matches/Likes)
    // Remove user ID from all other users' arrays
    const updateOps = {
      $pull: {
        likes: userId,
        likedBy: userId,
        superLikes: userId,
        matches: userId,
        blockedUsers: userId,
        followers: userId,
        following: userId
      }
    };
    await User.updateMany({}, updateOps);
    await Match.deleteMany({ users: userId });

    // 3. Delete Personal Content
    await Post.deleteMany({ userId });
    await LyraItinerary.deleteMany({ userId });
    await AIItinerary.deleteMany({ userId });
    await Comment.deleteMany({ user: userId });
    await Notification.deleteMany({ $or: [{ sender: userId }, { recipient: userId }] });

    // 4. Handle Trips
    // Remove from memberships
    await TripMember.deleteMany({ user: userId });
    // Handle messages (Keep content but anonymize or delete? We'll delete for total purge)
    await TripMessage.deleteMany({ sender: userId });
    
    // Deleting trips where the user was the creator
    const userTrips = await Trip.find({ creator: userId });
    for (const trip of userTrips) {
       // Deep cleanup for trips
       await TripMember.deleteMany({ trip: trip._id });
       await TripMessage.deleteMany({ trip: trip._id });
       await Trip.findByIdAndDelete(trip._id);
    }

    // 5. Delete Final User Record
    await User.findByIdAndDelete(userId);

    console.log(`[GDPR PURGE] COMPLETED for user: ${userId}`);
    return true;
  } catch (error) {
    console.error(`[GDPR PURGE] CRITICAL FAILURE for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Background job to find and purge scheduled users.
 */
const runScheduledPurge = async () => {
  try {
    const now = new Date();
    const usersToPurge = await User.find({
      isDeleted: true,
      deletionScheduledAt: { $lte: now }
    }).select('_id');

    if (usersToPurge.length === 0) return;

    console.log(`[SCHEDULER] Found ${usersToPurge.length} users to purge.`);
    for (const u of usersToPurge) {
      await performHardPurge(u._id);
    }
  } catch (error) {
    console.error('[SCHEDULER ERROR]', error);
  }
};

module.exports = { performHardPurge, runScheduledPurge };
