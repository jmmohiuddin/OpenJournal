import express from 'express';
import {
  register,
  login,
  googleAuth,
  getProfile,
  updateProfile,
  completeOnboarding,
  saveOnboardingProfile
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);

// Protected routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/profile', protect, saveOnboardingProfile);
router.post('/onboarding', protect, completeOnboarding);

export default router;
