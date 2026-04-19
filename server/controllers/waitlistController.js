import { User } from '../models/index.js';

// @desc    Skip waitlist (for development/testing or specific user actions)
// @route   POST /api/waitlist/skip
export const skipWaitlist = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Set status to active
    user.status = 'active';
    await user.save();
    
    res.json({
      success: true,
      data: user,
      message: 'Waitlist skipped successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get waitlist stats
// @route   GET /api/waitlist/stats
export const getWaitlistStats = async (req, res, next) => {
  try {
    const currentTotal = await User.countDocuments();
    const capacity = 1000;
    
    res.json({
      success: true,
      data: {
        currentTotal,
        capacity,
        isFull: currentTotal >= capacity
      }
    });
  } catch (error) {
    next(error);
  }
};
