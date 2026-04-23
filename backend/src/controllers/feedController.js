const Post = require('../models/Post');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Report = require('../models/Report');
const { Match } = require('../models/Match');
const { createNotification } = require('../utils/notificationService');

// Safe lazy-load for bad-words (CJS/ESM compat issue with Node v22)
let filter = null;
try {
  const Filter = require('bad-words');
  filter = new Filter();
} catch (err) {
  console.warn('[FEED] bad-words module failed to load, profanity filter disabled:', err.message);
  filter = { isProfane: () => false, clean: (t) => t };
}

// @desc    Get feed (Nearby, Friends, Global)
// @route   GET /api/feed
// @access  Private
const getFeed = async (req, res) => {
  try {
    const { mode = 'global', page = 1, limit = 15 } = req.query;
    const skip = (page - 1) * limit;
    let query = {};
    let sort = { createdAt: -1 };
    
    // 0. Global Stealth: Exclude posts from deleted users
    const deletedUsers = await User.find({ isDeleted: true }).select('_id');
    const deletedUserIds = deletedUsers.map(u => u._id);
    query.userId = { $nin: deletedUserIds };

    // 1. Filter Logic
    if (mode === 'nearby') {
      const user = await User.findById(req.user._id).select('location');
      // Show only global or nearby posts within 50km
      query.visibility = { $in: ['global', 'nearby'] };
      
      if (user?.location?.coordinates && user.location.coordinates[0] !== 0) {
        query.location = {
          $nearSphere: {
            $geometry: { 
              type: 'Point', 
              coordinates: user.location.coordinates 
            },
            $maxDistance: 50 * 1000, // 50km
          }
        };
        sort = {}; // Sorted by proximity automatically
      }
    } else if (mode === 'friends') {
      const [user, matches] = await Promise.all([
        User.findById(req.user._id).select('following'),
        Match.find({ 
          users: req.user._id, 
          isActive: true 
        })
      ]);
      
      // 1. Get IDs of users we follow
      const followingIds = user?.following || [];
      
      // 2. Get IDs of users we have matched with
      const matchedUserIds = matches.map(m => 
        m.users.find(id => id.toString() !== req.user._id.toString())
      ).filter(Boolean);

      // Friends see any post (except maybe private, but normally they see all) 
      // from their matched/followed circle
      query.userId = { $in: [...followingIds, ...matchedUserIds, req.user._id, req.user._id] }; // Includes self
    } else {
      // DEFAULT: Global Mode
      // Only show posts explicitly marked as global
      query.visibility = 'global';
    }

    // 2. Fetch Posts
    const posts = await Post.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'firstName lastName username photos age city country');

    // 3. Enrich with 'isLiked' status for the current user
    const postIds = posts.map(p => p._id);
    const myLikes = await Like.find({ 
      postId: { $in: postIds }, 
      userId: req.user._id 
    });
    const myLikeIds = myLikes.map(l => l.postId.toString());

    const result = posts.map(p => {
      const pObj = p.toObject();
      return {
        ...pObj,
        isLiked: myLikeIds.includes(p._id.toString()),
        user: pObj.userId // cleaner naming for frontend
      };
    });

    res.json({ posts: result, page: Number(page) });
  } catch (error) {
    console.error('[GET FEED ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Create a post (Atomic)
// @route   POST /api/feed/create
// @access  Private
const createPost = async (req, res) => {
  try {
    const { content, placeName, visibility, allowAIItinerary } = req.body;
    let { location } = req.body;

    // 1. Handle Multipart Parsing (location is sent as JSON string)
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid location data' });
      }
    }

    // 2. Handle Uploaded Files (Cloudinary URLs)
    const images = req.files ? req.files.map(f => f.path) : [];

    // 3. Validation
    if (!content && images.length === 0) {
      return res.status(400).json({ error: 'Post must have content or images' });
    }

    let isProfane = false;
    if (content) { try { isProfane = filter.isProfane(String(content)); } catch (e) {} }
    if (isProfane) {
      return res.status(400).json({ error: 'Your post contains offensive language. Please keep it friendly!' });
    }

    if (!location || !location.coordinates) {
      return res.status(400).json({ error: 'Location is required for travel posts' });
    }

    // 4. Persistence
    const post = await Post.create({
      userId: req.user._id,
      content,
      images,
      location,
      placeName: placeName || '',
      visibility: visibility || 'global',
      allowAIItinerary: allowAIItinerary === 'false' ? false : (allowAIItinerary === 'true' ? true : !!allowAIItinerary)
    });

    const populatedPost = await Post.findById(post._id).populate('userId', 'firstName lastName username photos age city country');
    
    res.status(201).json({ 
      message: 'Post created successfully', 
      post: populatedPost 
    });
  } catch (error) {
    console.error('[CREATE POST ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Toggle Like (Like/Unlike)
// @route   POST /api/feed/:id/like
// @access  Private
const toggleLike = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    // 🛡️ Atomic Toggle Logic
    const existingLike = await Like.findOne({ postId, userId });

    if (existingLike) {
      // UNLIKE
      await Like.deleteOne({ _id: existingLike._id });
      const post = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: -1 } }, { new: true });
      
      // Broadcast update
      try {
        const { getIO } = require('../socket/socketHandler');
        getIO().emit('post_interaction', { postId, likesCount: post?.likesCount || 0, type: 'unlike' });
      } catch (sErr) {}

      res.json({ liked: false, message: 'Unliked', likesCount: post?.likesCount || 0 });
    } else {
      // LIKE
      try {
        await Like.create({ postId, userId });
        const post = await Post.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } }, { new: true });
        
        // Broadcast update
        try {
          const { getIO } = require('../socket/socketHandler');
          getIO().emit('post_interaction', { postId, likesCount: post?.likesCount || 1, type: 'like' });
        } catch (sErr) {}

        // TRIGGER NOTIFICATION
        if (post && post.userId.toString() !== userId.toString()) {
           createNotification({
             recipient: post.userId,
             sender: userId,
             type: 'like',
             message: `${req.user.username || 'Someone'} liked your post`,
             data: { postId }
           });
        }
        res.json({ liked: true, message: 'Liked', likesCount: post?.likesCount || 1 });
      } catch (err) {
        // Handle race condition if unique index fails
        if (err.code === 11000) return res.json({ liked: true });
        throw err;
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Add Comment
// @route   POST /api/feed/:id/comment
// @access  Private
const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const postId = req.params.id;

    if (!text) return res.status(400).json({ error: 'Comment text is required' });

    let isProfane = false;
    try { isProfane = filter.isProfane(String(text)); } catch (e) {}
    if (isProfane) {
      return res.status(400).json({ error: 'Your comment contains offensive language.' });
    }

    const comment = await Comment.create({
      postId,
      userId: req.user._id,
      text
    });

    const post = await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    const populated = await Comment.findById(comment._id).populate('userId', 'firstName lastName username photos');

    res.status(201).json({ comment: populated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete Post
// @route   DELETE /api/feed/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    // Cleanup social data
    await Like.deleteMany({ postId: post._id });
    await Comment.deleteMany({ postId: post._id });
    await Post.deleteOne({ _id: post._id });

    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Edit Post
// @route   PUT /api/feed/:id
// @access  Private
const editPost = async (req, res) => {
  try {
    const { content, placeName } = req.body;
    const post = await Post.findById(req.params.id);
    
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized to edit this post' });
    }

    if (content !== undefined) post.content = content;
    if (placeName !== undefined) post.placeName = placeName;

    const updatedPost = await post.save();
    const populatedPost = await Post.findById(updatedPost._id).populate('userId', 'firstName lastName username photos age city country');

    res.json({ message: 'Post updated', post: populatedPost });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get Single Post
// @route   GET /api/feed/:id
// @access  Private
const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('userId', 'firstName lastName username photos age city country');
    
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Check if liked by current user (if logged in)
    let isLiked = false;
    if (req.user?._id) {
      const like = await Like.findOne({ postId: post._id, userId: req.user._id });
      isLiked = !!like;
    }
    
    res.json({ 
      post: {
        ...post.toObject(),
        isLiked,
        user: post.userId
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get users who liked a post
// @route   GET /api/feed/:id/likes
// @access  Private
const getPostLikes = async (req, res) => {
  try {
    const postId = req.params.id;
    const likes = await Like.find({ postId })
      .populate('userId', 'firstName lastName username photos age city country')
      .sort({ createdAt: -1 });
    
    // Extract user objects and filter out any null values (if user was deleted)
    const users = likes.map(l => l.userId).filter(u => !!u);
    
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get user's posts
// @route   GET /api/feed/user/:userId
// @access  Private
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 15 } = req.query;
    const skip = (page - 1) * limit;

    // Check if target user is deleted
    const targetUser = await User.findById(userId).select('isDeleted');
    if (!targetUser || targetUser.isDeleted) {
      return res.json({ posts: [], page: Number(page), message: 'User not found or deleted' });
    }

    const posts = await Post.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'firstName lastName username photos age city country');

    const postIds = posts.map(p => p._id);
    // Enrich with 'isLiked' (if logged in)
    let myLikeIds = [];
    if (req.user?._id) {
      const myLikes = await Like.find({ 
        postId: { $in: postIds }, 
        userId: req.user._id 
      });
      myLikeIds = myLikes.map(l => l.postId.toString());
    }

    const result = posts.map(p => {
      const pObj = p.toObject();
      return {
        ...pObj,
        isLiked: myLikeIds.includes(p._id.toString()),
        user: pObj.userId
      };
    });

    res.json({ posts: result, page: Number(page) });
  } catch (error) {
    console.error('[GET USER POSTS ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Report Post (Compliance)
// @route   POST /api/feed/:id/report
// @access  Private
const reportPost = async (req, res) => {
  try {
    const { reason, details } = req.body;
    const postId = req.params.id;

    if (!reason) return res.status(400).json({ error: 'Reason for report is required' });

    // Verify post exists
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    await Report.create({
      reportedBy: req.user._id,
      targetId: postId,
      type: 'post',
      reason,
      details: details || ''
    });

    res.json({ message: 'Post reported successfully. Our team will review it.' });
  } catch (error) {
    console.error('[REPORT POST ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getFeed,
  createPost,
  getPost,
  toggleLike,
  addComment,
  reportPost,
  deletePost,
  editPost,
  getPostLikes,
  getUserPosts
};
