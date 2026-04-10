const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { createNotification } = require('../utils/notificationService');
const Filter = require('bad-words');
const filter = new Filter();

// @desc    Get comments for a post
// @route   GET /api/comments/:postId
// @access  Private
const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .populate('userId', 'firstName lastName username photos')
      .sort({ createdAt: -1 });

    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Add a comment to a post
// @route   POST /api/comments/:postId
// @access  Private
const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const postId = req.params.postId;
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const sanitizedText = filter.clean(text);

    const comment = await Comment.create({
      postId,
      userId,
      text: sanitizedText
    });

    // Populate user info for the new comment
    const populatedComment = await Comment.findById(comment._id).populate('userId', 'firstName lastName username photos');

    // Increment commentsCount on Post
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    // 4. Fetch Post to get updated count and recipient
    const post = await Post.findById(postId);

    // 5. BROADCAST UPDATE (Real-time visibility)
    try {
      const { getIO } = require('../socket/socketHandler');
      getIO().emit('post_interaction', { 
        postId, 
        commentsCount: post?.commentsCount || 1, 
        newComment: populatedComment,
        type: 'comment' 
      });
    } catch (sErr) {
      console.error('[SOCKET ERROR] Failed to emit comment interaction:', sErr);
    }

    // 6. TRIGGER NOTIFICATION
    if (post && post.userId.toString() !== userId.toString()) {
      createNotification({
        recipient: post.userId,
        sender: userId,
        type: 'comment',
        message: `${req.user.username || 'Someone'} commented on your post: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
        data: { postId }
      });
    }

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error('[ADD COMMENT ERROR]', error);
    res.status(500).json({ error: error.message });
  }
};

// @desc    Update a comment
// @route   PUT /api/comments/:id
// @access  Private
const updateComment = async (req, res) => {
  try {
    const { text } = req.body;
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check ownership
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: 'User not authorized to update this comment' });
    }

    comment.text = text ? filter.clean(text) : comment.text;
    await comment.save();

    const populatedComment = await comment.populate('userId', 'firstName lastName username photos');
    res.status(200).json(populatedComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check ownership
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: 'User not authorized to delete this comment' });
    }

    const postId = comment.postId;
    await Comment.deleteOne({ _id: req.params.id });

    // Decrement commentsCount on Post
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });

    res.status(200).json({ message: 'Comment removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getComments,
  addComment,
  updateComment,
  deleteComment
};
