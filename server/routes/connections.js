import express from 'express';
import {
  getConnections,
  getConnectionDetails,
  acceptConnection,
  declineConnection,
  getMessages,
  createMessage,
  markFeedback
} from '../controllers/connectionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/', getConnections);
router.get('/:id', getConnectionDetails);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', createMessage);
router.post('/:id/accept', acceptConnection);
router.post('/:id/decline', declineConnection);
router.post('/:id/feedback', markFeedback);

export default router;
