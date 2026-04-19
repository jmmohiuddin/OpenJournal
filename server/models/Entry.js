import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    maxlength: [50000, 'Content cannot exceed 50000 characters']
  },
  contentHtml: {
    type: String,
    default: ''
  },
  // Vector embedding for semantic search (1024 dimensions for Voyage AI)
  embedding: {
    type: [Number],
    default: null,
    select: false // Don't include by default in queries
  },
  // Intent classification
  intentLabel: {
    type: String,
    enum: ['Problem', 'Solution', 'Reflection', null],
    default: null
  },
  intentConfidence: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  // Sentiment analysis
  sentiment: {
    score: {
      type: Number,
      min: -1,
      max: 1
    },
    mood: {
      type: String,
      enum: ['hopeful', 'anxious', 'reflective', 'frustrated', 'grateful', 'confused', 'determined', 'melancholic', null]
    }
  },
  // Extracted themes
  themes: [{
    type: String,
    trim: true
  }],
  // Privacy control
  isDiscoverable: {
    type: Boolean,
    default: false
  },
  // Entry source type
  source: {
    type: String,
    enum: ['text', 'voice', 'image'],
    default: 'text'
  },
  // Base64 thumbnail for image-sourced entries
  sourceImageUrl: {
    type: String,
    default: null
  },
  // AI processing status
  aiProcessed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for user's entries sorted by date
entrySchema.index({ userId: 1, createdAt: -1 });

// Compound index for discoverable+processed entries by intent (used by matching candidate queries)
entrySchema.index({ isDiscoverable: 1, aiProcessed: 1, intentLabel: 1 });

// Index for fetching all discoverable entries for a user quickly
entrySchema.index({ isDiscoverable: 1, userId: 1 });

export default mongoose.model('Entry', entrySchema);
