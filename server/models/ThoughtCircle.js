import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  entryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry'
  },
  role: {
    type: String,
    enum: ['initiator', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const thoughtCircleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxLength: 100
  },
  description: {
    type: String,
    maxLength: 500
  },
  // Shared themes from members' entries
  themes: [{
    type: String
  }],
  // The common thread connecting members
  topic: {
    type: String,
    required: true
  },
  members: [memberSchema],
  maxMembers: {
    type: Number,
    default: 8
  },
  status: {
    type: String,
    enum: ['forming', 'active', 'closed'],
    default: 'forming'
  },
  // AI-generated opener for the group
  welcomeMessage: {
    type: String
  },
  // Privacy: only summaries shown until joined
  isPrivate: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for finding circles by themes
thoughtCircleSchema.index({ themes: 1, status: 1 });
thoughtCircleSchema.index({ 'members.userId': 1 });

// Check if user is a member
thoughtCircleSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.userId.toString() === userId.toString());
};

// Check if circle is full
thoughtCircleSchema.methods.isFull = function() {
  return this.members.length >= this.maxMembers;
};

const ThoughtCircle = mongoose.model('ThoughtCircle', thoughtCircleSchema);

export default ThoughtCircle;
