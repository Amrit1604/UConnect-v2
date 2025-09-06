const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { redirectIfAuthenticated, validateEduEmail, sensitiveOperationLimit } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .custom(value => {
      if (!value.endsWith('.edu.in')) {
        throw new Error('Please use a valid .edu.in email address');
      }
      return true;
    }),
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Display name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

// GET /auth/register - Show registration form
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Join UConnect',
    errors: [],
    formData: {}
  });
});

// POST /auth/register - Handle registration
router.post('/register',
  redirectIfAuthenticated,
  sensitiveOperationLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  uploadAvatar.single('avatarFile'), // Handle file upload
  registerValidation,
  async (req, res) => {
    try {
      console.log('Request Body:', req.body);
      console.log('Request File:', req.file);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('auth/register', {
          title: 'Join UConnect',
          errors: errors.array(),
          formData: req.body
        });
      }

      const { email, displayName, username, password, avatarType } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });
      if (existingUser) {
        const message = existingUser.email === email ?
          'An account with this email already exists' :
          'This username is already taken';
        return res.render('auth/register', {
          title: 'Join UConnect',
          errors: [{ msg: message }],
          formData: req.body
        });
      }

      // Create new user
      const user = new User({
        email,
        displayName,
        username,
        password,
        isVerified: false
      });

      // Handle avatar
      if (avatarType === 'upload' && req.file) {
        // File was uploaded
        user.avatar = req.file.filename;
        user.avatarType = 'upload';
      } else if (avatarType === 'api' && req.body.avatarSeed) {
        // API avatar
        user.avatar = req.body.avatarSeed;
        user.avatarType = 'api';
      } else {
        // Default avatar
        user.avatar = 'default';
        user.avatarType = 'api';
      }

      // Generate JWT verification token
      const verificationToken = user.generateJWTVerificationToken();
      await user.save();

      // Log verification link to console (for development)
      const verificationUrl = `${req.protocol}://${req.get('host')}/auth/verify-email?token=${verificationToken}`;
      console.log('\n=== EMAIL VERIFICATION ===');
      console.log(`User: ${displayName} (${email})`);
      console.log(`Verification Link: ${verificationUrl}`);
      console.log(`Token expires in: 24 hours`);
      console.log('==========================\n');

      req.flash('success', 'Registration successful! Please check the console for your verification link (in production, this would be sent via email).');
      res.redirect('/auth/verify-email');

    } catch (error) {
      console.error('Registration error:', error);
      res.render('auth/register', {
        title: 'Join UConnect',
        errors: [{ msg: 'Registration failed. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// GET /auth/login - Show login form
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Login to UConnect',
    errors: [],
    formData: {}
  });
});

// POST /auth/login - Handle login
router.post('/login',
  redirectIfAuthenticated,
  sensitiveOperationLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  loginValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('auth/login', {
          title: 'Login to UConnect',
          errors: errors.array(),
          formData: req.body
        });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.render('auth/login', {
          title: 'Login to UConnect',
          errors: [{ msg: 'Invalid email or password' }],
          formData: req.body
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.render('auth/login', {
          title: 'Login to UConnect',
          errors: [{ msg: 'Your account has been deactivated. Please contact support.' }],
          formData: req.body
        });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.render('auth/login', {
          title: 'Login to UConnect',
          errors: [{ msg: 'Invalid email or password' }],
          formData: req.body
        });
      }

      // Check if email is verified (admin accounts bypass verification)
      if (!user.isVerified && user.role !== 'admin') {
        return res.render('auth/login', {
          title: 'Login to UConnect',
          errors: [{ msg: 'Please verify your email address before logging in.' }],
          formData: req.body,
          showResendVerification: true,
          userEmail: email
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Create session
      req.session.user = {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        avatar: user.avatar,
        avatarType: user.avatarType,
        avatarUrl: user.avatarUrl,
        role: user.role,
        campus: user.campus
      };

      req.flash('success', `Welcome back, @${user.username}!`);
      res.redirect('/posts');

    } catch (error) {
      console.error('Login error:', error);
      res.render('auth/login', {
        title: 'Login to UConnect',
        errors: [{ msg: 'Login failed. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// GET /auth/verify-email - Verify email with token
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      // Show verification page if no token provided
      return res.render('auth/verify-email', {
        title: 'Verify Your Email',
        message: 'Please check your email for the verification link, or check the console for the verification URL.'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      req.flash('error', 'Invalid or expired verification token');
      return res.redirect('/auth/verify-email');
    }

    // Find user and verify
    const user = await User.findById(decoded.userId);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/auth/register');
    }

    if (user.isVerified) {
      req.flash('info', 'Your email is already verified');
      return res.redirect('/auth/login');
    }

    // Check if token matches and hasn't expired
    if (user.verificationToken !== token ||
        user.verificationTokenExpires < Date.now()) {
      req.flash('error', 'Verification token has expired');
      return res.redirect('/auth/verify-email');
    }

    // Verify the user
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    req.flash('success', 'Email verified successfully! You can now log in.');
    res.redirect('/auth/login');

  } catch (error) {
    console.error('Email verification error:', error);
    req.flash('error', 'Email verification failed');
    res.redirect('/auth/verify-email');
  }
});

// POST /auth/resend-verification - Resend verification email
router.post('/resend-verification',
  sensitiveOperationLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash('error', 'Please provide a valid email address');
        return res.redirect('/auth/verify-email');
      }

      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        req.flash('error', 'No account found with this email address');
        return res.redirect('/auth/verify-email');
      }

      if (user.isVerified) {
        req.flash('info', 'Your email is already verified');
        return res.redirect('/auth/login');
      }

      // Generate new JWT verification token
      const verificationToken = user.generateJWTVerificationToken();
      await user.save();

      // Log verification link to console (for development)
      const verificationUrl = `${req.protocol}://${req.get('host')}/auth/verify-email?token=${verificationToken}`;
      console.log('\n=== RESEND EMAIL VERIFICATION ===');
      console.log(`User: ${user.displayName} (${email})`);
      console.log(`Verification Link: ${verificationUrl}`);
      console.log(`Token expires in: 24 hours`);
      console.log('=================================\n');

      req.flash('success', 'Verification link sent! Please check the console for your verification URL (in production, this would be sent via email).');
      res.redirect('/auth/verify-email');

    } catch (error) {
      console.error('Resend verification error:', error);
      req.flash('error', 'Failed to resend verification email');
      res.redirect('/auth/verify-email');
    }
  }
);

// GET /auth/logout - Logout user
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      req.flash('error', 'Logout failed');
      return res.redirect('/posts');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;