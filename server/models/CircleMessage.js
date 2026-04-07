import mongoose from 'mongoose';

const circleMessageSchema = new mongoose.Schema({
  circleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ThoughtCircle',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  content: {
    type: String,
    required: true,
    maxLength: 2000
  },
  type: {
    type: String,
    enum: ['message', 'ai_facilitator', 'system', 'join', 'leave'],
    default: 'message'
  }
}, {
  timestamps: true
});

circleMessageSchema.index({ circleId: 1, createdAt: 1 });

const CircleMessage = mongoose.model('CircleMessage', circleMessageSchema);

export default CircleMessage;
