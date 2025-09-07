/**
 * User Routes - UConnect
 * Handles user profiles, settings, and account management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const User = require('../models/User');
const Post = require('../models/Post');
const { requireAuth, sensitiveOperationLimit, logActivity } = require('../middleware/auth');

const router = express.Router();

// 🔒 APPLY AUTHENTICATION TO ALL USER ROUTES
router.use(requireAuth);

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/avatars');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation rules
const profileValidation = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .custom(async (username, { req }) => {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: req.user._id }
      });
      if (existingUser) {
        throw new Error('Username is already taken');
      }
      return true;
    }),
  body('bio')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Bio cannot exceed 200 characters')
];

const passwordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// GET /users/profile - Show user profile
router.get('/profile', async (req, res) => {
  try {
    console.log('🔍 PROFILE ROUTE: User ID:', req.user._id);
    console.log('🔍 PROFILE ROUTE: User object:', req.user);

    const user = await User.findById(req.user._id);
    if (!user) {
      console.error('❌ User not found in database:', req.user._id);
      req.flash('error', 'User not found');
      return res.redirect('/posts');
    }

    const userPosts = await Post.getByUser(req.user._id, 10, 0);

    res.render('users/profile', {
      title: 'My Profile',
      profileUser: user,
      posts: userPosts,
      isOwnProfile: true,
      user: req.user
    });

  } catch (error) {
    console.error('Profile error:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/posts');
  }
});

// GET /users/:id - Show other user's profile
router.get('/:id', async (req, res) => {
  try {
    const userIdentifier = req.params.id;
    console.log('🔍 USER PROFILE ROUTE: Identifier:', userIdentifier);

    // Check if this is the current user's own profile
    if (userIdentifier === req.user._id.toString() || userIdentifier === req.user.username) {
      return res.redirect('/users/profile');
    }

    let user;

    // Try to find user by ObjectId first, then by username
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(userIdentifier)) {
      console.log('🔍 Searching by ObjectId:', userIdentifier);
      user = await User.findById(userIdentifier);
    } else {
      console.log('🔍 Searching by username:', userIdentifier);
      user = await User.findOne({ username: userIdentifier });
    }

    if (!user || !user.isActive) {
      console.log('❌ User not found or inactive:', userIdentifier);
      req.flash('error', 'User not found');
      return res.redirect('/posts');
    }

    console.log('✅ Found user:', user.username, 'Campus:', user.campus);

    // Check if user is from same campus
    if (user.campus !== req.user.campus) {
      console.log('❌ Campus mismatch:', user.campus, 'vs', req.user.campus);
      req.flash('error', 'You can only view profiles from your campus');
      return res.redirect('/posts');
    }

    const userPosts = await Post.getByUser(user._id, 10, 0);

    console.log('✅ Rendering profile for user:', user.username);

    res.render('users/profile', {
      title: `${user.name || user.displayName || user.username}'s Profile`,
      profileUser: user,
      posts: userPosts,
      isOwnProfile: false,
      user: req.user
    });

  } catch (error) {
    console.error('User profile error:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/posts');
  }
});

// GET /users/settings/profile - Show profile settings
router.get('/settings/profile', (req, res) => {
  try {
    console.log('🔍 SETTINGS ROUTE: User object:', req.user);
    console.log('🔍 SETTINGS ROUTE: User name:', req.user.name);
    console.log('🔍 SETTINGS ROUTE: User displayName:', req.user.displayName);

    res.render('users/settings/profile', {
      title: 'Profile Settings',
      errors: [],
      formData: {
        displayName: req.user.name || req.user.displayName || req.user.username || ''
      },
      user: req.user
    });
  } catch (error) {
    console.error('Settings profile error:', error);
    req.flash('error', 'Failed to load profile settings');
    res.redirect('/posts');
  }
});

// POST /users/settings/profile - Update profile
router.post('/settings/profile',
  profileValidation,
  logActivity('update profile'),
  async (req, res) => {
    try {
      console.log('🔥 PROFILE UPDATE REQUEST RECEIVED (users.js):');
      console.log('Request body:', req.body);
      console.log('User ID:', req.user._id);
      console.log('Current session user before update:', {
        username: req.session.user.username,
        displayName: req.session.user.displayName,
        bio: req.session.user.bio,
        privacy: req.session.user.privacy
      });

      const errors = validationResult(req);
      const { username, bio, profilePublic, showEmail, allowMessages } = req.body;

      console.log('📝 Parsed form data:');
      console.log('Username:', username);
      console.log('Bio:', bio);
      console.log('Profile Public:', profilePublic);
      console.log('Show Email:', showEmail);
      console.log('Allow Messages:', allowMessages);

      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.render('users/settings/profile', {
          title: 'Profile Settings',
          errors: errors.array(),
          formData: req.body,
          user: req.user
        });
      }

      const updateData = {
        username: username.toLowerCase(),
        bio: bio || '',
        privacy: {
          profilePublic: profilePublic === 'on',
          showEmail: showEmail === 'on',
          allowMessages: allowMessages === 'on'
        },
        updatedAt: new Date()
      };

      console.log('🔥 GODLY POWERS: Updating profile with data:', updateData);

      // Update the user in database and get the updated user
      const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password');

      console.log('📊 Updated user data from MongoDB:');
      console.log('Display Name:', updatedUser.displayName);
      console.log('Username:', updatedUser.username);
      console.log('Bio:', updatedUser.bio);
      console.log('Privacy:', updatedUser.privacy);

      // Update session data with new user information
      console.log('🔄 Updating session data...');
      console.log('Old session user:', {
        username: req.session.user.username,
        displayName: req.session.user.displayName,
        bio: req.session.user.bio,
        privacy: req.session.user.privacy
      });

      req.session.user = {
        id: updatedUser._id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        username: updatedUser.username,
        avatar: updatedUser.avatar,
        avatarType: updatedUser.avatarType,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
        campus: updatedUser.campus,
        bio: updatedUser.bio,
        privacy: updatedUser.privacy
      };

      console.log('✅ GODLY SUCCESS: Profile updated and session synced!');
      console.log('New session user:', {
        username: req.session.user.username,
        displayName: req.session.user.displayName,
        bio: req.session.user.bio,
        privacy: req.session.user.privacy
      });

      // Save session to ensure persistence
      req.session.save((err) => {
        if (err) {
          console.error('❌ Session save error:', err);
        } else {
          console.log('✅ Session saved successfully!');
        }
        req.flash('success', 'Profile updated successfully! 🎉');
        res.redirect('/users/settings/profile');
      });

    } catch (error) {
      console.error('❌ Profile update error:', error);
      res.render('users/settings/profile', {
        title: 'Profile Settings',
        errors: [{ msg: 'Failed to update profile. Please try again.' }],
        formData: req.body,
        user: req.user
      });
    }
  }
);

// POST /users/settings/avatar - Update avatar
router.post('/settings/avatar',
  upload.single('avatar'),
  logActivity('update avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        req.flash('error', 'Please select an image file');
        return res.redirect('/users/settings/profile');
      }

      const user = await User.findById(req.user._id);

      // Delete old uploaded avatar if exists
      if (user.avatar && user.avatarType === 'upload') {
        try {
          const oldAvatarPath = path.join(__dirname, '../public/uploads/avatars', user.avatar);
          await fs.unlink(oldAvatarPath);
          console.log('🗑️ Deleted old avatar:', user.avatar);
        } catch (error) {
          console.log('Old avatar deletion failed:', error.message);
        }
      }

      // Create final avatar filename
      const fileExtension = path.extname(req.file.originalname);
      const avatarFilename = `avatar-${user._id}-${Date.now()}${fileExtension}`;
      const finalAvatarPath = path.join(__dirname, '../public/uploads/avatars', avatarFilename);

      // Ensure avatars directory exists
      const avatarsDir = path.join(__dirname, '../public/uploads/avatars');
      try {
        await fs.mkdir(avatarsDir, { recursive: true });
      } catch (error) {
        console.log('Avatars directory already exists');
      }

      // Move uploaded file to final location
      await fs.rename(req.file.path, finalAvatarPath);

      // Update user with avatar filename (NOT binary data!)
      user.avatar = avatarFilename;
      user.avatarType = 'upload';
      await user.save();

      console.log('✅ Avatar uploaded successfully:', avatarFilename);
      console.log('📂 Avatar URL will be:', user.avatarUrl);

      // Update session with new avatar info
      req.session.user.avatar = user.avatar;
      req.session.user.avatarType = user.avatarType;
      req.session.user.avatarUrl = user.avatarUrl;

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('📁 Avatar uploaded successfully');
      req.flash('success', 'Avatar updated successfully!');
      res.redirect('/users/settings/profile');

    } catch (error) {
      console.error('Avatar update error:', error);
      req.flash('error', 'Failed to update avatar');
      res.redirect('/users/settings/profile');
    }
  }
);

// POST /users/settings/avatar-api - Set random avatar from API
router.post('/settings/avatar-api',
  logActivity('set random avatar'),
  async (req, res) => {
    try {
      const { avatarSeed } = req.body;

      if (!avatarSeed) {
        req.flash('error', 'Invalid avatar seed');
        return res.redirect('/users/settings/profile');
      }

      // Generate API avatar URL
      const avatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${avatarSeed}`;

      // Update user avatar
      const user = await User.findById(req.user._id);

      // Clear any existing uploaded avatar file
      if (user.avatar && user.avatarType === 'upload') {
        try {
          const oldAvatarPath = path.join(__dirname, '../public/uploads/avatars', user.avatar);
          await fs.unlink(oldAvatarPath);
        } catch (error) {
          console.log('Old avatar deletion failed:', error.message);
        }
      }

      // Set API avatar
      user.avatarUrl = avatarUrl;
      user.avatarType = 'api';
      user.avatar = null; // Clear file reference
      await user.save();

      // Update session
      req.session.user.avatarUrl = avatarUrl;
      req.session.user.avatarType = 'api';
      req.session.user.avatar = null;

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('🎲 Random avatar set successfully:', avatarUrl);
      req.flash('success', 'Random avatar set successfully!');
      res.redirect('/users/settings/profile');

    } catch (error) {
      console.error('Random avatar error:', error);
      req.flash('error', 'Failed to set random avatar');
      res.redirect('/users/settings/profile');
    }
  }
);

// POST /users/settings/remove-avatar - Remove current avatar
router.post('/settings/remove-avatar',
  logActivity('remove avatar'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      // Delete uploaded avatar file if exists
      if (user.avatar && user.avatarType === 'upload') {
        try {
          const avatarPath = path.join(__dirname, '../public/uploads/avatars', user.avatar);
          await fs.unlink(avatarPath);
        } catch (error) {
          console.log('Avatar file deletion failed:', error.message);
        }
      }

      // Set default avatar
      const defaultAvatarUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=default`;
      user.avatarUrl = defaultAvatarUrl;
      user.avatarType = 'api';
      user.avatar = null;
      await user.save();

      // Update session
      req.session.user.avatarUrl = defaultAvatarUrl;
      req.session.user.avatarType = 'api';
      req.session.user.avatar = null;

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('🗑️ Avatar removed successfully');
      req.flash('success', 'Avatar removed successfully!');
      res.redirect('/users/settings/profile');

    } catch (error) {
      console.error('Remove avatar error:', error);
      req.flash('error', 'Failed to remove avatar');
      res.redirect('/users/settings/profile');
    }
  }
);

// GET /users/settings/password - Show password change form
router.get('/settings/password', (req, res) => {
  res.render('users/settings/password', {
    title: 'Change Password',
    errors: [],
    user: req.user
  });
});

// POST /users/settings/password - Change password
router.post('/settings/password',
  sensitiveOperationLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  passwordValidation,
  logActivity('change password'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('users/settings/password', {
          title: 'Change Password',
          errors: errors.array(),
          user: req.user
        });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id);

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.render('users/settings/password', {
          title: 'Change Password',
          errors: [{ msg: 'Current password is incorrect' }],
          user: req.user
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      req.flash('success', 'Password changed successfully!');
      res.redirect('/users/settings/password');

    } catch (error) {
      console.error('Password change error:', error);
      res.render('users/settings/password', {
        title: 'Change Password',
        errors: [{ msg: 'Failed to change password. Please try again.' }],
        user: req.user
      });
    }
  }
);

// GET /users/settings/account - Show account settings
router.get('/settings/account', (req, res) => {
  res.render('users/settings/account', {
    title: 'Account Settings',
    user: req.user
  });
});

// POST /users/settings/email - Update email
router.post('/settings/email',
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  logActivity('update email'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'Please enter a valid email address');
        return res.redirect('/users/settings/account');
      }

      const { email } = req.body;
      const user = await User.findById(req.user._id);

      // Check if email already exists
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existingUser) {
        req.flash('error', 'Email address is already in use');
        return res.redirect('/users/settings/account');
      }

      // Update email
      user.email = email;
      user.isEmailVerified = false; // Reset verification status
      await user.save();

      req.flash('success', 'Email updated! Please check your inbox for verification.');
      res.redirect('/users/settings/account');

    } catch (error) {
      console.error('Email update error:', error);
      req.flash('error', 'Failed to update email');
      res.redirect('/users/settings/account');
    }
  }
);

// POST /users/settings/notifications - Update notification preferences
router.post('/settings/notifications',
  logActivity('update notifications'),
  async (req, res) => {
    try {
      const { emailNotifications, followNotifications, likeNotifications, marketingEmails } = req.body;

      const user = await User.findById(req.user._id);
      user.notificationPreferences = {
        email: !!emailNotifications,
        follows: !!followNotifications,
        likes: !!likeNotifications,
        marketing: !!marketingEmails
      };
      await user.save();

      req.flash('success', 'Notification preferences updated!');
      res.redirect('/users/settings/account');

    } catch (error) {
      console.error('Notification update error:', error);
      req.flash('error', 'Failed to update notification preferences');
      res.redirect('/users/settings/account');
    }
  }
);

// POST /users/settings/download-data - Request data download
router.post('/settings/download-data',
  logActivity('request data download'),
  async (req, res) => {
    try {
      // In a real app, this would trigger a background job to generate the data
      // For now, we'll just send a success response
      res.json({ success: true, message: 'Data download request submitted' });
    } catch (error) {
      console.error('Data download error:', error);
      res.json({ success: false, message: 'Failed to request data download' });
    }
  }
);

// POST /users/settings/deactivate - Deactivate account
router.post('/settings/deactivate',
  logActivity('deactivate account'),
  async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      // Deactivate account
      user.isActive = false;
      await user.save();

      // Deactivate all user's posts
      await Post.updateMany(
        { author: req.user._id },
        { isActive: false }
      );

      res.json({ success: true });

    } catch (error) {
      console.error('Account deactivation error:', error);
      res.json({ success: false });
    }
  }
);

// POST /users/settings/delete-account - Delete account permanently
router.post('/settings/delete-account',
  sensitiveOperationLimit(1, 24 * 60 * 60 * 1000), // 1 attempt per day
  body('confirmEmail').isEmail().withMessage('Please enter a valid email'),
  body('confirmDelete').equals('on').withMessage('Please confirm deletion'),
  body('confirmDataLoss').equals('on').withMessage('Please confirm data loss'),
  logActivity('delete account'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'Please complete all confirmation steps');
        return res.redirect('/users/settings/account');
      }

      const { confirmEmail } = req.body;
      const user = await User.findById(req.user._id);

      // Verify email matches
      if (confirmEmail !== user.email) {
        req.flash('error', 'Email does not match your account email');
        return res.redirect('/users/settings/account');
      }

      // Delete user's posts
      await Post.deleteMany({ author: req.user._id });

      // Delete user's avatar if exists
      if (user.avatar) {
        try {
          const avatarPath = path.join(__dirname, '../public/uploads/avatars', user.avatar);
          await fs.unlink(avatarPath);
        } catch (error) {
          console.log('Avatar deletion failed:', error.message);
        }
      }

      // Delete user account
      await User.findByIdAndDelete(req.user._id);

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        res.clearCookie('connect.sid');
        req.flash('success', 'Your account has been permanently deleted');
        res.redirect('/');
      });

    } catch (error) {
      console.error('Account deletion error:', error);
      req.flash('error', 'Failed to delete account');
      res.redirect('/users/settings/account');
    }
  }
);

// GET /users/campus - Show campus users
router.get('/campus', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const users = await User.find({
      campus: req.user.campus,
      isVerified: true,
      isActive: true,
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('displayName avatar stats createdAt')
    .sort({ 'stats.postsCount': -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const totalUsers = await User.countDocuments({
      campus: req.user.campus,
      isVerified: true,
      isActive: true
    });

    res.render('users/campus', {
      title: `${req.user.campus} Campus Users`,
      users,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      hasNextPage: skip + users.length < totalUsers,
      totalUsers,
      user: req.user
    });

  } catch (error) {
    console.error('Campus users error:', error);
    req.flash('error', 'Failed to load campus users');
    res.redirect('/posts');
  }
});

// GET /users/:username - 🔥 INSTAGRAM-LIKE PROFILE BY USERNAME
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ username: username.toLowerCase() }).populate('avatar');

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/posts');
    }

    // Check if it's the user's own profile
    if (req.user && req.user._id.toString() === user._id.toString()) {
      return res.redirect('/users/profile');
    }

    // Get user's posts for their profile
    const userPosts = await Post.find({ author: user._id })
      .populate('author', 'username name avatar campus')
      .sort({ createdAt: -1 })
      .limit(20);

    // Get user stats
    const postCount = await Post.countDocuments({ author: user._id });

    res.render('users/profile', {
      title: `@${user.username} | UConnect`,
      profileUser: user,
      posts: userPosts,
      postCount: postCount,
      isOwnProfile: false,
      currentUser: req.user
    });

  } catch (error) {
    console.error('Username profile error:', error);
    req.flash('error', 'Failed to load user profile');
    res.redirect('/posts');
  }
});

module.exports = router;