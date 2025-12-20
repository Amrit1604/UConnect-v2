/**
 * User Routes - UConnect
 * Handles user profiles, settings, and account management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const User = require('../models/User');
const Post = require('../models/Post');
const { requireAuth, sensitiveOperationLimit, logActivity } = require('../middleware/auth');
const { uploadAvatar, deleteFile } = require('../utils/gridfs');

const router = express.Router();

// 🔒 APPLY AUTHENTICATION TO ALL USER ROUTES
router.use(requireAuth);

// Use GridFS-based multer for avatar uploads
// uploadAvatar is a multer middleware from utils/gridfs that stores files in the 'avatars' bucket

// GET /users/search - Search users by username or name (same campus)
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, results: [] });

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const users = await User.find({
      campus: req.user.campus,
      isActive: true,
      isVerified: true,
      $or: [
        { username: regex },
        { name: regex }
      ]
    })
    .select('username name avatarSeed avatarType avatarGridFSId stats createdAt')
    .limit(10);

    const results = users.map(u => ({ id: u._id, username: u.username, name: u.name, avatarUrl: u.avatarUrl }));
    return res.json({ success: true, results });
  } catch (error) {
    console.error('User search error:', error);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// GET /users/explore - Explore users (recommendations)
router.get('/explore', async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('following');
    const excludeIds = new Set([req.user._id.toString(), ...(me?.following || []).map(id => id.toString())]);

    const sort = (req.query.sort || 'popular').toLowerCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 24;
    const skip = (page - 1) * limit;

    const baseQuery = {
      campus: req.user.campus,
      isActive: true,
      isVerified: true,
      _id: { $nin: Array.from(excludeIds) }
    };

    let sortSpec;
    if (sort === 'new') sortSpec = { createdAt: -1 };
    else if (sort === 'suggested') sortSpec = { 'stats.followersCount': -1, createdAt: -1 };
    else sortSpec = { 'stats.followersCount': -1, createdAt: -1 }; // popular default

    const [candidates, total] = await Promise.all([
      User.find(baseQuery)
        .select('username name avatarSeed avatarType avatarGridFSId stats createdAt updatedAt')
        .sort(sortSpec)
        .skip(skip)
        .limit(limit),
      User.countDocuments(baseQuery)
    ]);

    res.render('layout', {
      title: 'Explore Users',
      bodyTemplate: 'users/explore-body',
      additionalCSS: ['/css/feed-neo.css', '/css/profile-neo.css'],
      users: candidates.map(u => u.toObject({ virtuals: true })),
      user: req.user,
      exploreSort: sort,
      page,
      hasNextPage: (skip + candidates.length) < total
    });
  } catch (error) {
    console.error('Explore users error:', error);
    req.flash('error', 'Failed to load explore users');
    res.redirect('/posts');
  }
});

// GET /users/suggestions - Sidebar follow suggestions (JSON)
router.get('/suggestions', async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('following');
    const excludeIds = new Set([req.user._id.toString(), ...(me?.following || []).map(id => id.toString())]);

    const suggestions = await User.find({
      campus: req.user.campus,
      isActive: true,
      isVerified: true,
      _id: { $nin: Array.from(excludeIds) }
    })
      .select('username name avatarSeed avatarType avatarGridFSId stats createdAt')
      .sort({ createdAt: -1 })
      .limit(6);

    const results = suggestions.map(u => ({ id: u._id, username: u.username, name: u.name, avatarUrl: u.avatarUrl }));
    res.json({ success: true, results });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load suggestions' });
  }
});

// GET /users/:username/card - Mini user card data (JSON)
router.get('/:username/card', async (req, res) => {
  try {
    const u = await User.findOne({ username: req.params.username.toLowerCase(), isActive: true, isVerified: true })
      .select('username name stats avatarSeed avatarType avatarGridFSId createdAt');
    if (!u) return res.status(404).json({ success: false });
    res.json({ success: true, user: { username: u.username, name: u.name, avatarUrl: u.avatarUrl, stats: u.stats } });
  } catch (e) {
    res.status(500).json({ success: false });
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

    // Use shared layout with body template
    res.render('layout', {
      title: 'My Profile',
      bodyTemplate: 'users/profile-body',
      additionalCSS: ['/css/profile-neo.css'],
      additionalJS: ['/js/main.js'],
      profileUser: user,
      posts: userPosts,
      isOwnProfile: true,
      isFollowing: false,
      followersCount: user.followers ? user.followers.length : (user.stats?.followersCount || 0),
      followingCount: user.following ? user.following.length : (user.stats?.followingCount || 0),
      user: req.user
    });

  } catch (error) {
    console.error('Profile error:', error);
    req.flash('error', 'Failed to load profile');
    res.redirect('/posts');
  }
});

// POST /users/:id/follow - Follow a user
router.post('/:id/follow', logActivity('follow user'), async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You can't follow yourself" });
    }

    const [me, target] = await Promise.all([
      User.findById(req.user._id).select('following stats'),
      User.findById(targetId).select('followers stats')
    ]);

    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const alreadyFollowing = me.following.some(id => id.toString() === target._id.toString());
    if (alreadyFollowing) {
      return res.json({ success: true, message: 'Already following' });
    }

    me.following.push(target._id);
    target.followers.push(me._id);
    me.stats.followingCount = (me.stats.followingCount || 0) + 1;
    target.stats.followersCount = (target.stats.followersCount || 0) + 1;

    await Promise.all([me.save(), target.save()]);

    // Emit socket event for realtime updates
    try {
      const io = req.app.get && req.app.get('io');
      if (io) {
        io.emit('user:follow_update', {
          type: 'follow',
          followerId: me._id,
          targetId: target._id,
          followersCount: target.stats.followersCount,
          followingCount: me.stats.followingCount
        });
      }
    } catch (e) {}

    return res.json({ success: true, following: true, followersCount: target.stats.followersCount, followingCount: me.stats.followingCount });
  } catch (error) {
    console.error('Follow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to follow user' });
  }
});

// POST /users/:id/unfollow - Unfollow a user
router.post('/:id/unfollow', logActivity('unfollow user'), async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You can't unfollow yourself" });
    }

    const [me, target] = await Promise.all([
      User.findById(req.user._id).select('following stats'),
      User.findById(targetId).select('followers stats')
    ]);

    if (!target || !target.isActive) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const wasFollowingIndex = me.following.findIndex(id => id.toString() === target._id.toString());
    if (wasFollowingIndex === -1) {
      return res.json({ success: true, message: 'Not following' });
    }

    me.following.splice(wasFollowingIndex, 1);
    const followerIndex = target.followers.findIndex(id => id.toString() === me._id.toString());
    if (followerIndex !== -1) target.followers.splice(followerIndex, 1);
    me.stats.followingCount = Math.max(0, (me.stats.followingCount || 0) - 1);
    target.stats.followersCount = Math.max(0, (target.stats.followersCount || 0) - 1);

    await Promise.all([me.save(), target.save()]);

    // Emit socket event for realtime updates
    try {
      const io = req.app.get && req.app.get('io');
      if (io) {
        io.emit('user:follow_update', {
          type: 'unfollow',
          followerId: me._id,
          targetId: target._id,
          followersCount: target.stats.followersCount,
          followingCount: me.stats.followingCount
        });
      }
    } catch (e) {}

    return res.json({ success: true, following: false, followersCount: target.stats.followersCount, followingCount: me.stats.followingCount });
  } catch (error) {
    console.error('Unfollow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to unfollow user' });
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
      user = await User.findOne({ username: userIdentifier.toLowerCase() });
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

    // Determine follow status (query current user's following to be accurate)
    let isFollowing = false;
    try {
      const me = await User.findById(req.user._id).select('following');
      if (me && Array.isArray(me.following)) {
        isFollowing = me.following.some(id => id.toString() === user._id.toString());
      }
    } catch (e) {
      console.log('Follow status check failed:', e.message);
    }

    console.log('✅ Rendering profile for user:', user.username);

    res.render('layout', {
      title: `${user.name || user.displayName || user.username}'s Profile`,
      bodyTemplate: 'users/profile-body',
      additionalCSS: ['/css/profile-neo.css'],
      additionalJS: ['/js/main.js'],
      profileUser: user,
      posts: userPosts,
      isOwnProfile: false,
      isFollowing,
      followersCount: user.followers ? user.followers.length : (user.stats?.followersCount || 0),
      followingCount: user.following ? user.following.length : (user.stats?.followingCount || 0),
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

    res.render('layout', {
      title: 'Profile Settings',
      bodyTemplate: 'users/settings/profile-body',
      additionalCSS: ['/css/feed-neo.css', '/css/settings-neo.css'],
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

      req.session.user = updatedUser.toObject({ virtuals: true });

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
  uploadAvatar,
  logActivity('update avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        req.flash('error', 'Please select an image file');
        return res.redirect('/users/settings/profile');
      }

      const user = await User.findById(req.user._id);

      // If user had a previous GridFS avatar, delete it
      if (user.avatarGridFSId && user.avatarType === 'gridfs') {
        try {
          await deleteFile(user.avatarGridFSId);
          console.log('🗑️ Deleted old GridFS avatar:', user.avatarGridFSId);
        } catch (e) {
          console.log('Old GridFS avatar deletion failed:', e.message);
        }
      }

      // Set new GridFS avatar info from multer-gridfs-storage result
      user.avatarGridFSId = req.file.id;
      user.avatar = null; // clear any legacy filename
      user.avatarType = 'gridfs';
      await user.save();

      console.log('✅ Avatar uploaded to GridFS:', req.file.id);
      console.log('📂 Avatar URL will be:', user.avatarUrl);

      // Update session with new avatar info
      req.session.user = user.toObject({ virtuals: true });

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

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

      console.log('🎲 Setting random avatar with seed:', avatarSeed);

      // Update user avatar
      const user = await User.findById(req.user._id);

      // Clear any existing uploaded avatar file
      if (user.avatarGridFSId && user.avatarType === 'gridfs') {
        try {
          await deleteFile(user.avatarGridFSId);
          console.log('🗑️ Deleted old uploaded avatar');
        } catch (error) {
          console.log('Old avatar deletion failed:', error.message);
        }
      }

      // Set API avatar with PERSISTENT seed
      user.avatarSeed = avatarSeed; // CRITICAL: Save the seed to database
      user.avatarType = 'api';
      user.avatar = null; // Clear file reference
      await user.save();

      console.log('✅ Avatar seed saved to database:', user.avatarSeed);
      console.log('✅ Avatar type:', user.avatarType);
      console.log('✅ Avatar URL will be:', user.avatarUrl);

      // Update session with new user data
      req.session.user = user.toObject({ virtuals: true });

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('🎲 Random avatar set successfully with seed:', avatarSeed);
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

      // Delete GridFS avatar if exists
      if (user.avatarGridFSId && user.avatarType === 'gridfs') {
        try {
          await deleteFile(user.avatarGridFSId);
          console.log('🗑️ Deleted GridFS avatar file');
        } catch (error) {
          console.log('GridFS avatar deletion failed:', error.message);
        }
      }

      // Generate new random seed for default avatar
      const defaultSeed = crypto.randomBytes(8).toString('hex');
      console.log('🎲 Generating new default avatar with seed:', defaultSeed);

      // Set default avatar with new random seed
      user.avatarSeed = defaultSeed;
      user.avatarType = 'api';
      user.avatar = null;
      await user.save();

      console.log('✅ Default avatar seed saved:', user.avatarSeed);

      // Update session
      req.session.user = user.toObject({ virtuals: true });

      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log('🗑️ Avatar removed successfully, new random avatar generated');
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
  res.render('layout', {
    title: 'Change Password',
    bodyTemplate: 'users/settings/password-body',
    additionalCSS: ['/css/feed-neo.css', '/css/settings-neo.css'],
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
  res.render('layout', {
    title: 'Account Settings',
    bodyTemplate: 'users/settings/account-body',
    additionalCSS: ['/css/feed-neo.css', '/css/settings-neo.css'],
    additionalJS: ['/js/settings-account.js'],
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
      user.deactivatedAt = new Date();
      await user.save();

      // Deactivate all user's posts
      await Post.updateMany(
        { author: req.user._id },
        { $set: { isActive: false, deactivatedByUser: true } }
      );

      // Destroy session and return success
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error during deactivation:', err);
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, redirect: '/auth/login?deactivated=true' });
      });

    } catch (error) {
      console.error('Account deactivation error:', error);
      res.json({ success: false, error: error.message });
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

      // Delete user's GridFS avatar if exists
      if (user.avatarGridFSId && user.avatarType === 'gridfs') {
        try {
          await deleteFile(user.avatarGridFSId);
        } catch (error) {
          // Non-fatal cleanup: avatar may already be missing
          console.warn('GridFS avatar deletion skipped:', error.message);
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
        // Do NOT call req.flash here (session is gone). Redirect with a flag instead.
        res.redirect('/auth/login?deleted=true');
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

// (Legacy username route removed; unified handler is router.get('/:id') above)

module.exports = router;