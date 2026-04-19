import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  password: {
    type: String,
    required: function() { return !this.firebaseUid; },
    minlength: [8, 'Password must be at least 8 characters']
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  photoURL: {
    type: String
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  onboardingComplete: {
    type: Boolean,
    default: false
  },
  // Onboarding interview answers
  onboardingProfile: {
    welcome: String,
    values: String,
    challenges: String,
    goals: String
  },
  values: [{
    type: String,
    trim: true
  }],
  interests: [{
    type: String,
    trim: true
  }],
  discoveryEnabled: {
    type: Boolean,
    default: true
  },
  // Waitlist, Validation & Tiered Rewards
  status: {
    type: String,
    enum: ['waitlist', 'active_founder', 'active'],
    default: 'waitlist'
  },
  waitlistPosition: {
    type: Number,
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  referralCount: {
    type: Number,
    default: 0
  },
  badges: [{
    type: String
  }],
  matchAccuracy: {
    type: Number,
    default: 0
  },
  resolvedSolutions: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

export default mongoose.model('User', userSchema);
