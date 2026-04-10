const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../middleware/auth');
const { uploadPhoto } = require('../config/cloudinary');
const { 
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
} = require('../controllers/feedController');

// Feed routes
router.get('/', protect, getFeed);
router.post('/create', protect, uploadPhoto.array('media', 5), createPost);
router.get('/:id', protectOptional, getPost); // 🔥 Public deep linking route with optional auth context
router.post('/:id/like', protect, toggleLike);
router.post('/:id/comment', protect, addComment);
router.post('/:id/report', protect, reportPost);
router.delete('/:id', protect, deletePost);
router.put('/:id', protect, editPost);
router.get('/:id/likes', protect, getPostLikes);
router.get('/user/:userId', protectOptional, getUserPosts); // 🔥 Public for profile view deep links with optional auth context

module.exports = router;
