import { Connection, Message, Entry } from '../models/index.js';
import { generateWingmanMessage } from '../services/aiService.js';
import { notifyUser } from '../services/socketService.js';
import { runPassiveMatching } from '../services/passiveMatchingService.js';

const MATCH_REFRESH_COOLDOWN_MS = parseInt(process.env.MATCH_REFRESH_COOLDOWN_MS || '300000', 10);
const lastMatchRefreshByUser = new Map();

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const getParticipantIds = (connection) => {
  const ids = [
    connection?.seekerId,
    connection?.sageId,
    connection?.user1Id,
    connection?.user2Id
  ]
    .map(toIdString)
    .filter(Boolean);
  return [...new Set(ids)];
};

const isParticipant = (connection, userId) => {
  const currentUserId = toIdString(userId);
  return getParticipantIds(connection).includes(currentUserId);
};

const normalizeForClient = (connection) => {
  const normalized = connection.toObject();
  if (!normalized.seekerId && normalized.user1Id) normalized.seekerId = normalized.user1Id;
  if (!normalized.sageId && normalized.user2Id) normalized.sageId = normalized.user2Id;
  if (!normalized.problemEntryId && normalized.entry1Id) normalized.problemEntryId = normalized.entry1Id;
  if (!normalized.solutionEntryId && normalized.entry2Id) normalized.solutionEntryId = normalized.entry2Id;
  return normalized;
};

const refreshUserMatchesIfNeeded = async (userId) => {
  const userIdString = toIdString(userId);
  if (!userIdString) return;

  const now = Date.now();
  const lastRefreshedAt = lastMatchRefreshByUser.get(userIdString) || 0;
  if (now - lastRefreshedAt < MATCH_REFRESH_COOLDOWN_MS) return;

  lastMatchRefreshByUser.set(userIdString, now);

  try {
    await runPassiveMatching({
      userId: userIdString,
      limit: 20
    });
  } catch (error) {
    // Don't fail the connections endpoint if background refresh has issues.
    console.error(`Passive matching refresh failed for user ${userIdString}:`, error.message);
  }
};

// @desc    Get all connections for current user
// @route   GET /api/connections
export const getConnections = async (req, res, next) => {
  try {
    const { status } = req.query;
    await refreshUserMatchesIfNeeded(req.user._id);

    const query = {
      $or: [
        { seekerId: req.user._id },
        { sageId: req.user._id },
        { user1Id: req.user._id },
        { user2Id: req.user._id }
      ]
    };

    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'declined' };
    }

    const connections = await Connection.find(query)
      .populate('seekerId', 'displayName')
      .populate('sageId', 'displayName')
      .populate('user1Id', 'displayName')
      .populate('user2Id', 'displayName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: connections.map(normalizeForClient)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get connection details with entries
// @route   GET /api/connections/:id
export const getConnectionDetails = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.id)
      .populate('seekerId', 'displayName photoURL')
      .populate('sageId', 'displayName photoURL')
      .populate('user1Id', 'displayName photoURL')
      .populate('user2Id', 'displayName photoURL')
      .populate('problemEntryId', 'content themes sentiment intentLabel')
      .populate('solutionEntryId', 'content themes sentiment intentLabel')
      .populate('entry1Id', 'content themes sentiment intentLabel')
      .populate('entry2Id', 'content themes sentiment intentLabel');

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    if (!isParticipant(connection, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this connection'
      });
    }

    const normalized = normalizeForClient(connection);
    const currentUserId = toIdString(req.user._id);
    const seekerId = toIdString(normalized.seekerId);
    const isSeeker = seekerId === currentUserId;
    const isSage = toIdString(normalized.sageId) === currentUserId;

    // Differential Privacy: Only show full content after both accept
    const bothAccepted = connection.seekerAccepted && connection.sageAccepted;
    let responseData = normalized;
    
    if (!bothAccepted) {
      // Obfuscate the other person's entry content until mutual acceptance
      if (isSeeker && responseData.solutionEntryId) {
        responseData.solutionEntryId = {
          _id: responseData.solutionEntryId._id,
          themes: responseData.solutionEntryId.themes,
          sentiment: responseData.solutionEntryId.sentiment,
          intentLabel: responseData.solutionEntryId.intentLabel,
          // Content replaced with privacy-preserving summary
          content: connection.theirEntrySummary || 'A thoughtful reflection...',
          isPrivacyProtected: true
        };
      } else if (isSage && responseData.problemEntryId) {
        responseData.problemEntryId = {
          _id: responseData.problemEntryId._id,
          themes: responseData.problemEntryId.themes,
          sentiment: responseData.problemEntryId.sentiment,
          intentLabel: responseData.problemEntryId.intentLabel,
          // Content replaced with privacy-preserving summary
          content: connection.theirEntrySummary || 'A thoughtful reflection...',
          isPrivacyProtected: true
        };
      }
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a connection
// @route   POST /api/connections/:id/accept
export const acceptConnection = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    if (!isParticipant(connection, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const normalized = normalizeForClient(connection);
    const currentUserId = toIdString(req.user._id);
    const isSeeker = toIdString(normalized.seekerId) === currentUserId;
    const isSage = toIdString(normalized.sageId) === currentUserId;

    // Update acceptance status
    if (isSeeker) connection.seekerAccepted = true;
    if (isSage) connection.sageAccepted = true;

    // If both accepted, activate the connection
    if (connection.seekerAccepted && connection.sageAccepted) {
      connection.status = 'accepted';

      // Generate AI wingman opener
      try {
        const [problemEntry, solutionEntry] = await Promise.all([
          Entry.findById(normalized.problemEntryId),
          Entry.findById(normalized.solutionEntryId)
        ]);

        if (problemEntry && solutionEntry) {
          const wingmanMessage = await generateWingmanMessage(
            problemEntry,
            solutionEntry,
            'opener'
          );

          await Message.create({
            connectionId: connection._id,
            senderId: null,
            content: wingmanMessage,
            type: 'ai_wingman'
          });
        }
      } catch (err) {
        console.error('Wingman message error:', err.message);
      }

      // Notify both users
      const otherUserId = isSeeker ? normalized.sageId : normalized.seekerId;
      notifyUser(toIdString(otherUserId), 'connection_accepted', {
        connectionId: connection._id
      });
    }

    await connection.save();

    res.json({
      success: true,
      data: normalizeForClient(connection)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Decline a connection
// @route   POST /api/connections/:id/decline
export const declineConnection = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    if (!isParticipant(connection, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    connection.status = 'declined';
    await connection.save();

    res.json({
      success: true,
      message: 'Connection declined'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a connection
// @route   GET /api/connections/:id/messages
export const getMessages = async (req, res, next) => {
  try {
    const connection = await Connection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    if (!isParticipant(connection, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const messages = await Message.find({ connectionId: req.params.id })
      .populate('senderId', 'displayName')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a message in a connection
// @route   POST /api/connections/:id/messages
export const createMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    const connection = await Connection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    if (!isParticipant(connection, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    if (connection.status === 'declined') {
      return res.status(400).json({
        success: false,
        message: 'Connection is not active'
      });
    }

    const message = await Message.create({
      connectionId: connection._id,
      senderId: req.user._id,
      content: content.trim(),
      type: 'user'
    });

    await message.populate('senderId', 'displayName');

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark connection as helpful/resolved
// @route   POST /api/connections/:id/feedback
export const markFeedback = async (req, res, next) => {
  try {
    const { helpful, rating, feedback } = req.body;
    const connection = await Connection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    if (!isParticipant(connection, req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to provide feedback'
      });
    }

    const normalized = normalizeForClient(connection);
    const currentUserId = toIdString(req.user._id);
    const isSeeker = toIdString(normalized.seekerId) === currentUserId;
    const isSage = toIdString(normalized.sageId) === currentUserId;

    // Update based on role
    if (isSeeker) {
      if (helpful !== undefined) connection.markedHelpful = helpful;
      if (rating) connection.seekerRating = rating;
      if (feedback) connection.seekerFeedback = feedback;
      if (helpful) connection.status = 'resolved';
    }
    
    if (isSage) {
      if (rating) connection.sageRating = rating;
      if (feedback) connection.sageFeedback = feedback;
    }

    await connection.save();

    res.json({
      success: true,
      data: normalizeForClient(connection)
    });
  } catch (error) {
    next(error);
  }
};
