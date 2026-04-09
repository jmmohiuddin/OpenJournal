import express from 'express';
import { runPassiveMatching, getMatchStats } from '../services/passiveMatchingService.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/matching/run-batch
 * Trigger batch matching for all discoverable entries
 * Admin/testing endpoint
 */
router.post('/run-batch', protect, async (req, res) => {
  try {
    const { limit = 100, userId, entryId, dryRun = false } = req.body;
    
    console.log(`🎯 Batch matching requested by user ${req.user._id}`);
    console.log(`   Limit: ${limit}, UserId: ${userId || 'all'}, EntryId: ${entryId || 'all'}, DryRun: ${dryRun}`);
    
    const results = await runPassiveMatching({
      limit,
      userId,
      entryId,
      dryRun
    });
    
    res.json({
      success: true,
      message: `Processed ${results.entriesProcessed} entries, created ${results.connectionsCreated} connections`,
      ...results
    });
  } catch (error) {
    console.error('Batch matching error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/matching/stats/:entryId
 * Get potential match statistics for an entry
 */
router.get('/stats/:entryId', protect, async (req, res) => {
  try {
    const stats = await getMatchStats(req.params.entryId);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Match stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/matching/find-for-entry/:entryId
 * Manually trigger matching for a specific entry
 */
router.post('/find-for-entry/:entryId', protect, async (req, res) => {
  try {
    const { entryId } = req.params;
    
    const results = await runPassiveMatching({
      entryId,
      limit: 1
    });
    
    res.json({
      success: true,
      message: `Found and created matches for entry ${entryId}`,
      ...results
    });
  } catch (error) {
    console.error('Entry matching error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
