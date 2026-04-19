import { User } from '../models/index.js';

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
