import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  connectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connection',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for AI messages
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  type: {
    type: String,
    enum: ['user', 'ai_wingman', 'system'],
    default: 'user'
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for fetching messages in a conversation
messageSchema.index({ connectionId: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
