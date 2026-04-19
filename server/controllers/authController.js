import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/index.js';

const handleWaitlistAndReferral = async (user, referredByCode) => {
  // 1. Generate referral code if it doesn't have one
  if (!user.referralCode) {
    user.referralCode = crypto.randomBytes(4).toString('hex');
  }

  // 2. Determine Waitlist Position
  const totalUsers = await User.countDocuments();
  // We count before this user is saved, if they are newly created, totalUsers doesn't include them unless they're already in db.
  // Actually, they ARE in the db because they are created in the controller.
  // Let's count *excluding* this user to determine limit.
  const usersBefore = await User.countDocuments({ _id: { $ne: user._id } });
  
  if (usersBefore < 1000) {
    user.status = 'active_founder';
    const badges = user.badges || [];
    if (!badges.includes('founder_circle')) badges.push('founder_circle');
    user.badges = badges;
    user.waitlistPosition = null;
  } else {
    user.status = 'waitlist';
    user.waitlistPosition = usersBefore - 1000 + 1;
  }

  // 3. Handle Referral Code
  if (referredByCode) {
    const referringUser = await User.findOne({ referralCode: referredByCode });
    if (referringUser) {
      user.referredBy = referringUser._id;
      
      referringUser.referralCount = (referringUser.referralCount || 0) + 1;
      
      // Update badges and tier access
      const refCount = referringUser.referralCount;
      const refBadges = referringUser.badges || [];
      if (refCount >= 3 && referringUser.status === 'waitlist') {
        referringUser.status = 'active_founder'; // early beta access
        if (!refBadges.includes('private_vault')) refBadges.push('private_vault');
      }
      if (refCount >= 10 && !refBadges.includes('lifetime_premium')) {
        refBadges.push('lifetime_premium');
      }
      if (refCount >= 25 && !refBadges.includes('sage')) {
        refBadges.push('sage');
      }
      referringUser.badges = refBadges;
      await referringUser.save();
    }
  }

  await user.save();
  return user;
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const { email, password, displayName, referredByCode } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    let user = await User.create({
      email,
      password,
      displayName
    });
    
    // Process waitlist and referrals
    user = await handleWaitlistAndReferral(user, referredByCode);

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        waitlistPosition: user.waitlistPosition,
        referralCode: user.referralCode,
        badges: user.badges,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        onboardingComplete: user.onboardingComplete,
        status: user.status,
        waitlistPosition: user.waitlistPosition,
        referralCode: user.referralCode,
        badges: user.badges,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
export const getProfile = async (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
export const updateProfile = async (req, res, next) => {
  try {
    const { displayName, values, interests, discoveryEnabled } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        displayName,
        values,
        interests,
        discoveryEnabled
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Google Auth (login or register)
// @route   POST /api/auth/google
export const googleAuth = async (req, res, next) => {
  try {
    const { uid, email, displayName, photoURL, referredByCode } = req.body;

    if (!uid || !email) {
      return res.status(400).json({
        success: false,
        message: 'Firebase UID and email are required'
      });
    }

    // Check if user exists by Firebase UID
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      // Check if user exists by email (might have registered with email/password)
      user = await User.findOne({ email });

      if (user) {
        // Link Firebase account to existing user
        user.firebaseUid = uid;
        user.authProvider = 'google';
        if (photoURL) user.photoURL = photoURL;
        await user.save();
      } else {
        // Create new user
        user = await User.create({
          email,
          displayName: displayName || email.split('@')[0],
          firebaseUid: uid,
          authProvider: 'google',
          photoURL
        });
        
        user = await handleWaitlistAndReferral(user, referredByCode);
      }
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        onboardingComplete: user.onboardingComplete,
        status: user.status,
        waitlistPosition: user.waitlistPosition,
        referralCode: user.referralCode,
        badges: user.badges,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete onboarding
// @route   POST /api/auth/onboarding
export const completeOnboarding = async (req, res, next) => {
  try {
    const { values, interests } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        values,
        interests,
        onboardingComplete: true
      },
      { new: true }
    );

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save onboarding profile from "The Guide" interview
// @route   POST /api/auth/profile
export const saveOnboardingProfile = async (req, res, next) => {
  try {
    const { onboarded, profile } = req.body;

    const updateData = {};
    
    if (onboarded !== undefined) {
      updateData.onboardingComplete = onboarded;
    }
    
    if (profile) {
      updateData.onboardingProfile = profile;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};
