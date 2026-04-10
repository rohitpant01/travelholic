const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
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
router.get('/:id', getPost); // 🔥 Public deep linking route
router.post('/:id/like', protect, toggleLike);
router.post('/:id/comment', protect, addComment);
router.post('/:id/report', protect, reportPost);
router.delete('/:id', protect, deletePost);
router.put('/:id', protect, editPost);
router.get('/:id/likes', protect, getPostLikes);
router.get('/user/:userId', getUserPosts); // 🔥 Public for profile view deep links

module.exports = router;
