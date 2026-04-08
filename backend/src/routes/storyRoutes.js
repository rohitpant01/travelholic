const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadPhoto } = require('../config/cloudinary'); // Use existing Cloudinary config
const { 
  getStories, 
  createStory,
  deleteStory,
  addView,
  getViewers
} = require('../controllers/storyController');

router.use(protect);

router.get('/', getStories);
router.post('/', uploadPhoto.single('media'), createStory);
router.post('/:id/view', addView);
router.get('/:id/views', getViewers);
router.delete('/:id', deleteStory);

module.exports = router;
