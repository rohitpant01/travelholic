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
  addItem,
  removeItem,
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
router.post('/:id/items', addItem);
router.delete('/:id/items/:itemId', removeItem);

module.exports = router;
