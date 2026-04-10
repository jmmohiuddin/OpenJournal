import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  // Connection type - determines the nature of the match
  connectionType: {
    type: String,
    enum: [
      'seeker-sage',      // Problem → Solution (original)
      'solidarity',        // Problem ↔ Problem (shared struggle)
      'wisdom-exchange',   // Solution ↔ Solution (complementary wisdom)
      'kindred-spirits',   // Reflection ↔ Reflection (similar thoughts)
      'insight-share'      // Any cross-type high-relevance match
    ],
    default: 'seeker-sage'
  },
  // First user in the connection
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Second user in the connection
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // First entry
  entry1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry',
    required: true
  },
  // Second entry
  entry2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry',
    required: true
  },
  // Legacy fields for backward compatibility (seeker-sage type)
  // The user who has the problem/question
  seekerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // The user who has the solution/wisdom
  sageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // The problem entry
  problemEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry'
  },
  // The solution entry
  solutionEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entry'
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

// Indexes for finding user's connections (both directions)
connectionSchema.index({ user1Id: 1, status: 1 });
connectionSchema.index({ user2Id: 1, status: 1 });
connectionSchema.index({ seekerId: 1, status: 1 });
connectionSchema.index({ sageId: 1, status: 1 });
connectionSchema.index({ connectionType: 1, status: 1 });
// Sort index for paginated list queries
connectionSchema.index({ createdAt: -1 });

// Prevent duplicate connections for same entry pair (order-independent)
// Both indexes are sparse so null values never collide
connectionSchema.index({ entry1Id: 1, entry2Id: 1 }, { unique: true, sparse: true });
connectionSchema.index({ problemEntryId: 1, solutionEntryId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Connection', connectionSchema);
