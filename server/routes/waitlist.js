import express from 'express';
import { getWaitlistStats } from '../controllers/waitlistController.js';

const router = express.Router();

router.get('/stats', getWaitlistStats);

export default router;
