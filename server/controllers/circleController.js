import { ThoughtCircle, CircleMessage, Entry, User } from '../models/index.js';
import * as aiService from '../services/aiService.js';
import { notifyCircleMembers } from '../services/socketService.js';

// Get all public/active circles (for discovery)
export const getPublicCircles = async (req, res) => {
  try {
    const circles = await ThoughtCircle.find({
      status: { $in: ['forming', 'active'] },
      isPrivate: false
    })
    .populate('members.userId', 'displayName photoURL')
    .sort('-createdAt')
    .limit(20);

    // Filter out user's own circles for the discovery list
    const userId = req.user.id;
    const discoveryCircles = circles.filter(c => !c.isMember(userId));

    res.json({ data: discoveryCircles });
  } catch (error) {
    console.error('Get public circles error:', error);
    res.status(500).json({ message: 'Failed to fetch circles' });
  }
};

// Get user's circles
export const getMyCircles = async (req, res) => {
  try {
    const circles = await ThoughtCircle.find({
      'members.userId': req.user.id
    })
    .populate('members.userId', 'displayName photoURL')
    .sort('-updatedAt');

    res.json({ data: circles });
  } catch (error) {
    console.error('Get my circles error:', error);
    res.status(500).json({ message: 'Failed to fetch circles' });
  }
};

// Get single circle details
export const getCircle = async (req, res) => {
  try {
    const circle = await ThoughtCircle.findById(req.params.id)
      .populate('members.userId', 'displayName photoURL values interests');

    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    // If not a member, return limited info
    if (!circle.isMember(req.user.id)) {
      return res.json({
        data: {
          _id: circle._id,
          name: circle.name,
          topic: circle.topic,
          themes: circle.themes,
          memberCount: circle.members.length,
          maxMembers: circle.maxMembers,
          status: circle.status,
          isMember: false
        }
      });
    }

    res.json({ data: { ...circle.toObject(), isMember: true } });
  } catch (error) {
    console.error('Get circle error:', error);
    res.status(500).json({ message: 'Failed to fetch circle' });
  }
};

// Create a new thought circle from an entry
export const createCircle = async (req, res) => {
  try {
    const { entryId, name, topic, isPrivate } = req.body;
    const userId = req.user.id;

    // Get the entry for themes
    const entry = await Entry.findOne({ _id: entryId, userId });
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    // Generate welcome message
    let welcomeMessage = `Welcome to "${name}"! This is a space for thoughtful discussion about ${topic}.`;
    try {
      welcomeMessage = await aiService.generateCircleWelcome(name, topic, entry.themes || []);
    } catch (err) {
      console.log('Using default welcome message');
    }

    const circle = await ThoughtCircle.create({
      name,
      topic,
      themes: entry.themes || [],
      description: `A thought circle exploring: ${topic}`,
      members: [{
        userId,
        entryId,
        role: 'initiator'
      }],
      welcomeMessage,
      isPrivate: isPrivate || false,
      createdBy: userId,
      status: 'forming'
    });

    // Add system message
    await CircleMessage.create({
      circleId: circle._id,
      content: welcomeMessage,
      type: 'ai_facilitator'
    });

    res.status(201).json({ data: circle });
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ message: 'Failed to create circle' });
  }
};

// Join a circle
export const joinCircle = async (req, res) => {
  try {
    const circleId = req.params.id;
    const userId = req.user.id;
    const { entryId } = req.body; // Optional: relevant entry

    const circle = await ThoughtCircle.findById(circleId);
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    if (circle.isMember(userId)) {
      return res.status(400).json({ message: 'Already a member' });
    }

    if (circle.isFull()) {
      return res.status(400).json({ message: 'Circle is full' });
    }

    if (circle.status === 'closed') {
      return res.status(400).json({ message: 'Circle is closed' });
    }

    // Add member
    circle.members.push({
      userId,
      entryId: entryId || null,
      role: 'member'
    });

    // Activate if enough members
    if (circle.members.length >= 3 && circle.status === 'forming') {
      circle.status = 'active';
    }

    await circle.save();

    // Get user info for notification
    const user = await User.findById(userId).select('displayName');

    // Add join message
    await CircleMessage.create({
      circleId: circle._id,
      senderId: userId,
      content: `${user.displayName} joined the circle`,
      type: 'join'
    });

    // Notify existing members
    notifyCircleMembers(circle._id.toString(), 'circle_member_joined', {
      circleId: circle._id,
      userId,
      displayName: user.displayName,
      memberCount: circle.members.length
    }, [userId.toString()]);

    res.json({ data: circle });
  } catch (error) {
    console.error('Join circle error:', error);
    res.status(500).json({ message: 'Failed to join circle' });
  }
};

// Leave a circle
export const leaveCircle = async (req, res) => {
  try {
    const circleId = req.params.id;
    const userId = req.user.id;

    const circle = await ThoughtCircle.findById(circleId);
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    if (!circle.isMember(userId)) {
      return res.status(400).json({ message: 'Not a member' });
    }

    // Remove member
    circle.members = circle.members.filter(
      m => m.userId.toString() !== userId.toString()
    );

    // Close if no members left
    if (circle.members.length === 0) {
      circle.status = 'closed';
    }

    await circle.save();

    const user = await User.findById(userId).select('displayName');

    // Add leave message
    await CircleMessage.create({
      circleId: circle._id,
      senderId: userId,
      content: `${user.displayName} left the circle`,
      type: 'leave'
    });

    res.json({ message: 'Left circle successfully' });
  } catch (error) {
    console.error('Leave circle error:', error);
    res.status(500).json({ message: 'Failed to leave circle' });
  }
};

// Get circle messages
export const getCircleMessages = async (req, res) => {
  try {
    const circleId = req.params.id;
    const { before, limit = 50 } = req.query;

    const circle = await ThoughtCircle.findById(circleId);
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    if (!circle.isMember(req.user.id)) {
      return res.status(403).json({ message: 'Must be a member to view messages' });
    }

    const query = { circleId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await CircleMessage.find(query)
      .populate('senderId', 'displayName photoURL')
      .sort('-createdAt')
      .limit(parseInt(limit));

    res.json({ data: messages.reverse() });
  } catch (error) {
    console.error('Get circle messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

// Send message to circle
export const sendCircleMessage = async (req, res) => {
  try {
    const circleId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const circle = await ThoughtCircle.findById(circleId);
    if (!circle) {
      return res.status(404).json({ message: 'Circle not found' });
    }

    if (!circle.isMember(userId)) {
      return res.status(403).json({ message: 'Must be a member to send messages' });
    }

    const message = await CircleMessage.create({
      circleId,
      senderId: userId,
      content: content.trim(),
      type: 'message'
    });

    await message.populate('senderId', 'displayName photoURL');

    // Notify other members via socket
    notifyCircleMembers(circleId, 'circle_message', {
      circleId,
      message
    }, [userId.toString()]);

    res.status(201).json({ data: message });
  } catch (error) {
    console.error('Send circle message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// Find similar circles or suggest creating one
export const suggestCircles = async (req, res) => {
  try {
    const { entryId } = req.query;
    const userId = req.user.id;

    const entry = await Entry.findOne({ _id: entryId, userId });
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    // Find circles with overlapping themes
    const matchingCircles = await ThoughtCircle.find({
      themes: { $in: entry.themes || [] },
      status: { $in: ['forming', 'active'] },
      'members.userId': { $ne: userId }
    })
    .populate('members.userId', 'displayName photoURL')
    .limit(5);

    // Count theme overlaps
    const suggestions = matchingCircles.map(circle => {
      const sharedThemes = circle.themes.filter(t => 
        entry.themes?.includes(t)
      );
      return {
        circle,
        sharedThemes,
        overlapScore: sharedThemes.length / Math.max(circle.themes.length, 1)
      };
    }).sort((a, b) => b.overlapScore - a.overlapScore);

    res.json({ data: suggestions });
  } catch (error) {
    console.error('Suggest circles error:', error);
    res.status(500).json({ message: 'Failed to suggest circles' });
  }
};
