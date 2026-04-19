import express from 'express';
import { getWaitlistStats, skipWaitlist } from '../controllers/waitlistController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', getWaitlistStats);
router.post('/skip', protect, skipWaitlist);

export default router;
