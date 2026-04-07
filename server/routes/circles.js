import express from 'express';
import { protect } from '../middleware/auth.js';
import * as circleController from '../controllers/circleController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Circle discovery and listing
router.get('/discover', circleController.getPublicCircles);
router.get('/my', circleController.getMyCircles);
router.get('/suggest', circleController.suggestCircles);

// Circle CRUD
router.post('/', circleController.createCircle);
router.get('/:id', circleController.getCircle);
router.post('/:id/join', circleController.joinCircle);
router.post('/:id/leave', circleController.leaveCircle);

// Circle messages
router.get('/:id/messages', circleController.getCircleMessages);
router.post('/:id/messages', circleController.sendCircleMessage);

export default router;
