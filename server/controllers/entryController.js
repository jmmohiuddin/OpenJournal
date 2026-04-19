import { Entry, Connection } from '../models/index.js';
import { processEntry } from '../services/entryProcessor.js';
import { extractTextFromImage } from '../services/aiService.js';

// @desc    Create new journal entry
// @route   POST /api/entries
export const createEntry = async (req, res, next) => {
  try {
    const { content, contentHtml, isDiscoverable } = req.body;

    const entry = await Entry.create({
      userId: req.user._id,
      content,
      contentHtml,
      isDiscoverable: isDiscoverable || false
    });

    // Trigger async AI processing (non-blocking)
    processEntry(entry._id).catch(err => {
      console.error('AI processing error:', err.message);
    });

    res.status(201).json({
      success: true,
      data: entry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all entries for current user
// @route   GET /api/entries
export const getEntries = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, intent, mood } = req.query;

    const query = { userId: req.user._id };
    
    if (intent) query.intentLabel = intent;
    if (mood) query['sentiment.mood'] = mood;

    const entries = await Entry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Entry.countDocuments(query);

    res.json({
      success: true,
      data: entries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single entry
// @route   GET /api/entries/:id
export const getEntry = async (req, res, next) => {
  try {
    const entry = await Entry.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found'
      });
    }

    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update entry
// @route   PUT /api/entries/:id
export const updateEntry = async (req, res, next) => {
  try {
    const { content, contentHtml, isDiscoverable } = req.body;

    const entry = await Entry.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found'
      });
    }

    // Check if content changed
    const contentChanged = content && content !== entry.content;

    entry.content = content || entry.content;
    entry.contentHtml = contentHtml || entry.contentHtml;
    entry.isDiscoverable = isDiscoverable ?? entry.isDiscoverable;

    // Reset AI processing if content changed
    if (contentChanged) {
      entry.aiProcessed = false;
      entry.embedding = null;
    }

    await entry.save();

    // Re-trigger AI processing if content changed
    if (contentChanged) {
      processEntry(entry._id).catch(err => {
        console.error('AI processing error:', err.message);
      });
    }

    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete entry
// @route   DELETE /api/entries/:id
export const deleteEntry = async (req, res, next) => {
  try {
    const entry = await Entry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's mood insights
// @route   GET /api/entries/insights
export const getInsights = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const insights = await Entry.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate },
          'sentiment.mood': { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            mood: '$sentiment.mood'
          },
          count: { $sum: 1 },
          avgScore: { $avg: '$sentiment.score' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          moods: {
            $push: {
              mood: '$_id.mood',
              count: '$count',
              avgScore: '$avgScore'
            }
          },
          totalEntries: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get intent distribution
    const intentDistribution = await Entry.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate },
          intentLabel: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$intentLabel',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get top themes
    const topThemes = await Entry.aggregate([
      {
        $match: {
          userId: req.user._id,
          createdAt: { $gte: startDate }
        }
      },
      { $unwind: '$themes' },
      {
        $group: {
          _id: '$themes',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        moodTrend: insights,
        intentDistribution,
        topThemes
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create entry from uploaded image (OCR)
// @route   POST /api/entries/image
export const createEntryFromImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const { isDiscoverable } = req.body;

    // Extract text from image using AI
    const extractedText = await extractTextFromImage(
      req.file.buffer,
      req.file.mimetype
    );

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Could not extract any text from the image'
      });
    }

    // Create a small base64 thumbnail (store only for reference)
    const thumbnail = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64').slice(0, 5000)}`;

    const entry = await Entry.create({
      userId: req.user._id,
      content: extractedText,
      contentHtml: `<p>${extractedText.replace(/\n/g, '</p><p>')}</p>`,
      isDiscoverable: isDiscoverable === 'true' || isDiscoverable === true,
      source: 'image',
      sourceImageUrl: thumbnail
    });

    // Trigger async AI processing (same as regular entries)
    processEntry(entry._id).catch(err => {
      console.error('AI processing error (image entry):', err.message);
    });

    res.status(201).json({
      success: true,
      data: entry,
      extractedText
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export all user data as JSON
// @route   GET /api/entries/export
export const exportUserData = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch all user entries (without embeddings)
    const entries = await Entry.find({ userId })
      .select('-embedding')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch all user connections
    const connections = await Connection.find({
      $or: [{ seekerId: userId }, { sageId: userId }]
    })
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();

    // User profile (already on req.user from auth middleware)
    const profile = {
      displayName: req.user.displayName,
      email: req.user.email,
      values: req.user.values,
      interests: req.user.interests,
      discoveryEnabled: req.user.discoveryEnabled,
      badges: req.user.badges,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt
    };

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile,
      entries,
      connections,
      summary: {
        totalEntries: entries.length,
        totalConnections: connections.length
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="openjournal-export-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    next(error);
  }
};
