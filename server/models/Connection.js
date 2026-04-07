import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  // The user who has the problem/question
  seekerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The user who has the solution/wisdom
  sageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The problem entry
  problemEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry',
    required: true
  },
  // The solution entry
  solutionEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry',
    required: true
  },
  // Semantic similarity score (vector cosine)
  similarityScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  // Cross-encoder rerank score
  rerankScore: {
    type: Number,
    min: 0,
    max: 1
  },
  // Combined score (weighted similarity + rerank)
  combinedScore: {
    type: Number,
    min: 0,
    max: 1
  },
  // AI-generated introduction message
  bridgeMessage: {
    type: String,
    required: true
  },
  // Privacy-preserving summary of the other person's entry
  theirEntrySummary: {
    type: String
  },
  // Connection status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'completed', 'resolved'],
    default: 'pending'
  },
  // Acceptance tracking
  seekerAccepted: {
    type: Boolean,
    default: false
  },
  sageAccepted: {
    type: Boolean,
    default: false
  },
  // Feedback
  markedHelpful: {
    type: Boolean,
    default: null
  },
  // Rating system (1-5 stars)
  seekerRating: {
    type: Number,
    min: 1,
    max: 5
  },
  sageRating: {
    type: Number,
    min: 1,
    max: 5
  },
  // Feedback text
  seekerFeedback: {
    type: String,
    maxlength: 500
  },
  sageFeedback: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Indexes for finding user's connections
connectionSchema.index({ seekerId: 1, status: 1 });
connectionSchema.index({ sageId: 1, status: 1 });

// Prevent duplicate connections for same entry pair
connectionSchema.index({ problemEntryId: 1, solutionEntryId: 1 }, { unique: true });

export default mongoose.model('Connection', connectionSchema);
