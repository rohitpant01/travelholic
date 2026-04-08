const Story = require('../models/Story');
const User = require('../models/User');

// @desc    Create a travel story
// @route   POST /api/stories
// @access  Private
const createStory = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No media uploaded' });
    
    const story = await Story.create({
      userId: req.user._id,
      mediaUrl: req.file.path,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'image'
    });

    const populated = await Story.findById(story._id).populate('userId', 'firstName lastName username photos');
    
    res.status(201).json({ story: populated });
  } catch (error) {
    console.error('[CREATE STORY ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

const getStories = async (req, res) => {
  try {
    // 🔥 Global Stealth: Exclude stories from deleted users
    const deletedUsers = await User.find({ isDeleted: true }).select('_id');
    const deletedUserIds = deletedUsers.map(u => u._id);

    const stories = await Story.find({ userId: { $nin: deletedUserIds } })
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName username photos');

    console.log(`[STORY API] Fetched ${stories.length} total stories for user ${req.user._id}`);

    // Group stories by user for the horizontal list
    const currentUserId = req.user._id.toString();
    const grouped = stories.reduce((acc, story) => {
      if (!story.userId) return acc; // Safety: skip if user missing

      const uid = story.userId._id.toString();
      const isViewedByMe = story.views.some(v => v.userId && v.userId.toString() === currentUserId);
      
      if (!acc[uid]) {
        acc[uid] = { 
          _id: uid, // Use userId as the key for the bubble
          userId: uid,
          username: story.userId.username || story.userId.firstName || 'Traveler',
          profilePic: story.userId.photos?.[0]?.url || 'https://via.placeholder.com/150',
          user: story.userId, 
          // Newest story is the thumbnail
          thumbnail: story.mediaUrl,
          items: [],
          isAllViewed: true // Assume all viewed, then set to false if any unviewed found
        };
      }
      
      if (!isViewedByMe) {
        acc[uid].isAllViewed = false;
      }

      // Ensure each story item also has basic user info for easier access
      const storyObj = story.toObject();
      storyObj.user = story.userId;
      storyObj.isViewed = isViewedByMe;
      
      acc[uid].items.push(storyObj);
      return acc;
    }, {});

    const finalStories = Object.values(grouped);
    console.log(`[STORY API] Grouped into ${finalStories.length} user bubbles`);

    res.json({ stories: finalStories });
  } catch (error) {
    console.error('[STORY FETCH ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Add view to story
// @route   POST /api/stories/:id/view
// @access  Private
const addView = async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user._id;

    // We don't need to fetch the story fully, just do an optimized atomic update.
    // If it's your own story, you probably shouldn't be counted as a viewer.
    // BUT we need to check ownership. We do this in one query:
    const result = await Story.updateOne(
      { 
        _id: storyId, 
        userId: { $ne: userId }, // Don't track if owner
        'views.userId': { $ne: userId } // Don't track if already viewed
      },
      {
        $push: { views: { userId, viewedAt: new Date() } }
      }
    );

    res.status(200).json({ success: true, updated: result.modifiedCount > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get viewers of a story (Owner Only)
// @route   GET /api/stories/:id/views
// @access  Private
const getViewers = async (req, res) => {
  try {
    const storyId = req.params.id;
    
    const story = await Story.findById(storyId).populate({
      path: 'views.userId',
      select: 'firstName lastName username photos'
    });

    if (!story) return res.status(404).json({ error: 'Story not found' });
    
    // Ensure only the owner can see the viewers
    if (story.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized to view these stats' });
    }

    res.status(200).json({ views: story.views });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete Story
// @route   DELETE /api/stories/:id
// @access  Private
const deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    if (story.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized to delete this story' });
    }

    await Story.deleteOne({ _id: story._id });

    res.json({ message: 'Story deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createStory,
  getStories,
  deleteStory,
  addView,
  getViewers
};
