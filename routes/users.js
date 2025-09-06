/**
 * User Routes - UConnect
 * Handles user profiles, settings, and account management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const User = require('../models/User');
const Post = require('../models/Post');
const { sensitiveOperationLimit, logActivity } = require('../middleware/auth');

const router = express.Router();

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
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods')
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
    const user = await User.findById(req.user._id);
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
    const userId = req.params.id;

    if (userId === req.user._id.toString()) {
      return res.redirect('/users/profile');
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      req.flash('error', 'User not found');
      return res.redirect('/posts');
    }

    // Check if user is from same campus
    if (user.campus !== req.user.campus) {
      req.flash('error', 'You can only view profiles from your campus');
      return res.redirect('/posts');
    }

    const userPosts = await Post.getByUser(userId, 10, 0);

    res.render('users/profile', {
      title: `${user.displayName}'s Profile`,
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
  res.render('users/settings/profile', {
    title: 'Profile Settings',
    errors: [],
    formData: {
      displayName: req.user.displayName
    },
    user: req.user
  });
});

// POST /users/settings/profile - Update profile
router.post('/settings/profile',
  profileValidation,
  logActivity('update profile'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('users/settings/profile', {
          title: 'Profile Settings',
          errors: errors.array(),
          formData: req.body,
          user: req.user
        });
      }

      const { displayName } = req.body;

      await User.findByIdAndUpdate(req.user._id, {
        displayName: displayName
      });

      // Update session data
      req.session.user.displayName = displayName;

      req.flash('success', 'Profile updated successfully!');
      res.redirect('/users/settings/profile');

    } catch (error) {
      console.error('Profile update error:', error);
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

      // Delete old avatar if exists
      if (user.avatar) {
        try {
          const oldAvatarPath = path.join(__dirname, '../public/uploads/avatars', user.avatar);
          await fs.unlink(oldAvatarPath);
        } catch (error) {
          console.log('Old avatar deletion failed:', error.message);
        }
      }

      // Update user with new avatar
      user.avatar = req.file.filename;
      await user.save();

      req.flash('success', 'Avatar updated successfully!');
      res.redirect('/users/settings/profile');

    } catch (error) {
      console.error('Avatar update error:', error);
      req.flash('error', 'Failed to update avatar');
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

// POST /users/settings/deactivate - Deactivate account
router.post('/settings/deactivate',
  sensitiveOperationLimit(1, 24 * 60 * 60 * 1000), // 1 attempt per day
  body('password').notEmpty().withMessage('Password is required'),
  body('confirmation').equals('DELETE').withMessage('Please type DELETE to confirm'),
  logActivity('deactivate account'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', errors.array()[0].msg);
        return res.redirect('/users/settings/account');
      }

      const { password } = req.body;
      const user = await User.findById(req.user._id);

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        req.flash('error', 'Incorrect password');
        return res.redirect('/users/settings/account');
      }

      // Deactivate account
      user.isActive = false;
      await user.save();

      // Deactivate all user's posts
      await Post.updateMany(
        { author: req.user._id },
        { isActive: false }
      );

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        res.clearCookie('connect.sid');
        req.flash('success', 'Your account has been deactivated');
        res.redirect('/');
      });

    } catch (error) {
      console.error('Account deactivation error:', error);
      req.flash('error', 'Failed to deactivate account');
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

module.exports = router;