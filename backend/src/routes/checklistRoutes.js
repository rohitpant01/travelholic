const express = require('express');
const router = express.Router();
const {
  getChecklists,
  createChecklist,
  getChecklist,
  updateChecklist,
  deleteChecklist,
  toggleItem,
  duplicateChecklist,
} = require('../controllers/checklistController');
const { protect } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(getChecklists)
  .post(createChecklist);

router
  .route('/:id')
  .get(getChecklist)
  .put(updateChecklist)
  .delete(deleteChecklist);

router.patch('/:id/toggle-item', toggleItem);
router.post('/:id/duplicate', duplicateChecklist);

module.exports = router;
