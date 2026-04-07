import express from 'express';
import {
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  getInsights
} from '../controllers/entryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Insights route (must be before /:id)
router.get('/insights', getInsights);

// CRUD routes
router.route('/')
  .get(getEntries)
  .post(createEntry);

router.route('/:id')
  .get(getEntry)
  .put(updateEntry)
  .delete(deleteEntry);

export default router;
