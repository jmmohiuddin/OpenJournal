import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message, Connection, Entry } from '../models/index.js';
import { generateWingmanMessage } from './aiService.js';

let io = null;

export function initSocket(server) {
  // Allow both localhost and tunnel domain
  const allowedOrigins = [
    'http://localhost:5173',
    'https://bring-acer-replaced-erik.trycloudflare.com',
    process.env.CLIENT_URL
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.userId}`);

    // Join a specific chat room
    socket.on('join_chat', async (connectionId) => {
      try {
        const connection = await Connection.findById(connectionId);
        if (!connection) return;

        const isParticipant = 
          connection.seekerId.equals(socket.userId) ||
          connection.sageId.equals(socket.userId);

        if (isParticipant) {
          socket.join(`connection:${connectionId}`);
          console.log(`User ${socket.userId} joined chat ${connectionId}`);
        }
      } catch (err) {
        console.error('Join chat error:', err.message);
      }
    });

    // Join a thought circle room
    socket.on('join_circle', (circleId) => {
      socket.join(`circle:${circleId}`);
      console.log(`User ${socket.userId} joined circle ${circleId}`);
    });

    // Leave a thought circle room
    socket.on('leave_circle', (circleId) => {
      socket.leave(`circle:${circleId}`);
      console.log(`User ${socket.userId} left circle ${circleId}`);
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
      try {
        const { connectionId, content } = data;

        const connection = await Connection.findById(connectionId);
        if (!connection) return;

        const isParticipant = 
          connection.seekerId.equals(socket.userId) ||
          connection.sageId.equals(socket.userId);

        if (!isParticipant || connection.status === 'declined') return;

        // Create message
        const message = await Message.create({
          connectionId,
          senderId: socket.userId,
          content,
          type: 'user'
        });

        await message.populate('senderId', 'displayName');

        // Emit to all participants in the room
        io.to(`connection:${connectionId}`).emit('message', message);

        // Update connection activity
        await updateConversationMetrics(connectionId);

      } catch (err) {
        console.error('Send message error:', err.message);
      }
    });

    // Typing indicator
    socket.on('typing', (connectionId) => {
      socket.to(`connection:${connectionId}`).emit('user_typing', {
        userId: socket.userId
      });
    });

    socket.on('stop_typing', (connectionId) => {
      socket.to(`connection:${connectionId}`).emit('user_stopped_typing', {
        userId: socket.userId
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
}

// Notify a specific user
export function notifyUser(userId, event, data) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

// Update conversation metrics for KPIs
async function updateConversationMetrics(connectionId) {
  try {
    const messages = await Message.find({ connectionId, type: 'user' }).sort({ createdAt: 1 });
    const messageCount = messages.length;

    // Mark as "completed" if both users have sent 5+ messages
    if (messageCount >= 10) {
      const senderIds = [...new Set(messages.map(m => m.senderId?.toString()).filter(Boolean))];

      if (senderIds.length >= 2) {
        const counts = senderIds.map(id =>
          messages.filter(m => m.senderId?.toString() === id).length
        );

        if (counts.every(c => c >= 5)) {
          await Connection.findByIdAndUpdate(connectionId, {
            status: 'completed'
          });
        }
      }
    }

    // Check for conversation stall (trigger at message 6, 12, etc.)
    if (messageCount > 0 && messageCount % 6 === 0) {
      await checkConversationHealth(connectionId, messages);
    }

  } catch (err) {
    console.error('Metrics update error:', err.message);
  }
}

// Analyze conversation and inject AI wingman prompts when needed
async function checkConversationHealth(connectionId, messages) {
  try {
    const connection = await Connection.findById(connectionId);
    if (!connection || connection.status === 'declined') return;

    // Count wingman messages already sent
    const wingmanCount = await Message.countDocuments({ connectionId, type: 'ai_wingman' });
    if (wingmanCount >= 3) return; // Max 3 AI interventions

    // Get last few messages to analyze tone
    const recentMessages = messages.slice(-4);
    
    // Simple heuristics for conversation depth
    const avgLength = recentMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0) / recentMessages.length;
    const hasQuestions = recentMessages.some(m => m.content?.includes('?'));
    
    // Determine context
    let context = null;
    
    // If messages are getting shorter and no questions, conversation may be stalling
    if (avgLength < 50 && !hasQuestions && messages.length >= 6) {
      context = 'stuck';
    }
    // If conversation is going well (longer messages, questions), suggest deepening
    else if (avgLength > 100 && hasQuestions && messages.length >= 8) {
      context = 'deepen';
    }

    if (context) {
      // Load entries for context
      const [problemEntry, solutionEntry] = await Promise.all([
        Entry.findById(connection.problemEntryId),
        Entry.findById(connection.solutionEntryId)
      ]);

      const wingmanMessage = await generateWingmanMessage(problemEntry, solutionEntry, context);
      
      if (wingmanMessage) {
        const message = await Message.create({
          connectionId,
          senderId: null,
          content: wingmanMessage,
          type: 'ai_wingman'
        });

        // Broadcast to chat room
        if (io) {
          io.to(`connection:${connectionId}`).emit('message', message);
        }
      }
    }
  } catch (err) {
    console.error('Conversation health check error:', err.message);
  }
}

// Notify all members of a thought circle (except excludeUserIds)
export function notifyCircleMembers(circleId, event, data, excludeUserIds = []) {
  if (!io) return;
  
  const room = `circle:${circleId}`;
  const socket = io.to(room);
  
  // Broadcast to room, excluding specific users handled client-side or by room membership
  socket.emit(event, data);
}
