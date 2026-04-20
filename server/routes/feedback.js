import express from 'express';
import { Feedback } from '../models/index.js';

const router = express.Router();

// POST /api/feedback
router.post('/', async (req, res) => {
  try {
    const { type, message, email } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const feedback = await Feedback.create({ type, message, email });

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// GET /api/feedback
router.get('/', async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json({ success: true, data: feedbacks });
  } catch (error) {
    console.error('Fetch feedback error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

export default router;
