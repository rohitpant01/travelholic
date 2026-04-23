const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getComments,
  addComment,
  updateComment,
  deleteComment,
  reportComment
} = require('../controllers/commentController');

router.use(protect);

router.get('/:postId', getComments);
router.post('/:postId', addComment);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);
router.post('/:id/report', reportComment);

module.exports = router;
