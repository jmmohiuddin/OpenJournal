import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import * as aiService from '../services/aiService.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Get AI health status
router.get('/health', async (req, res) => {
  const health = await aiService.checkOllamaHealth();
  res.json(health);
});

// Ghost Canvas - get typing suggestion
router.post('/ghost-text', protect, async (req, res) => {
  try {
    const { text, cursorContext } = req.body;
    
    if (!text || text.length < 20) {
      return res.json({ suggestion: null });
    }
    
    const suggestion = await aiService.generateGhostText(text, cursorContext);
    res.json({ suggestion });
  } catch (error) {
    console.error('Ghost text error:', error);
    res.status(500).json({ message: 'Failed to generate suggestion' });
  }
});

// Onboarding interview question
router.post('/onboarding', protect, async (req, res) => {
  try {
    const { stage, previousAnswers } = req.body;
    const question = await aiService.generateOnboardingQuestion(stage, previousAnswers);
    res.json({ question });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ message: 'Failed to generate question' });
  }
});

// Generate entry summary (privacy-preserving)
router.post('/summarize', protect, async (req, res) => {
  try {
    const { entry } = req.body;
    const summary = await aiService.generateEntrySummary(entry);
    res.json({ summary });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: 'Failed to generate summary' });
  }
});

// Explain match
router.post('/explain-match', protect, async (req, res) => {
  try {
    const { entry1, entry2 } = req.body;
    const explanation = await aiService.generateMatchExplanation(entry1, entry2);
    res.json({ explanation });
  } catch (error) {
    console.error('Match explanation error:', error);
    res.status(500).json({ message: 'Failed to explain match' });
  }
});

// Rerank matches
router.post('/rerank', protect, async (req, res) => {
  try {
    const { problemEntry, candidateSolutions } = req.body;
    const ranked = await aiService.rerankMatches(problemEntry, candidateSolutions);
    res.json({ ranked });
  } catch (error) {
    console.error('Reranking error:', error);
    res.status(500).json({ message: 'Failed to rerank matches' });
  }
});

// Transcribe audio with OpenAI Whisper
router.post('/transcribe', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }
    
    const transcript = await aiService.transcribeAudio(req.file.buffer, req.file.mimetype);
    res.json({ transcript });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ message: 'Failed to transcribe audio' });
  }
});

export default router;
