const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { redirectIfAuthenticated, validateEduEmail, sensitiveOperationLimit } = require('../middleware/auth');
const { uploadAvatarTemp, saveTempAvatarToDisk } = require('../middleware/upload');
const emailService = require('../services/emailService');
const { getSmartBaseUrl } = require('../utils/smartUrl');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .custom(value => {
      // Allow both .edu.in and gmail.com for testing purposes
      if (!value.endsWith('.edu.in') && !value.endsWith('@gmail.com')) {
        throw new Error('Please use a valid .edu.in email address or Gmail for testing');
      }
      return true;
    }),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage('Name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
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
  uploadAvatarTemp.single('avatarFile'), // Handle file upload temporarily in memory
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

      const { email, name, username, password, avatarType } = req.body;

      // Check if user already exists in MongoDB (verified users only)
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });
      if (existingUser) {
        const message = existingUser.email === email ?
          'An account with this email already exists and is verified' :
          'This username is already taken';
        return res.render('auth/register', {
          title: 'Join UConnect',
          errors: [{ msg: message }],
          formData: req.body
        });
      }

      // Prepare user data for temporary storage (DON'T save to MongoDB yet!)
      const tempUserData = {
        email,
        name,
        username,
        password, // Will be hashed when actually saving
        isVerified: false,
        registrationTimestamp: new Date()
      };

      // Handle avatar data - store temporarily, don't save to disk yet
      if (avatarType === 'upload' && req.file) {
        // Store file as base64 string in session (Buffer doesn't store well in sessions)
        tempUserData.tempAvatar = {
          data: req.file.buffer.toString('base64'),
          originalname: req.file.originalname,
          mimetype: req.file.mimetype
        };
        tempUserData.avatarType = 'upload';
        console.log(`📁 Avatar file stored temporarily: ${req.file.originalname} (${req.file.size} bytes)`);
      } else if (avatarType === 'api' && req.body.avatarSeed) {
        tempUserData.avatar = req.body.avatarSeed;
        tempUserData.avatarType = 'api';
        console.log(`🎲 API avatar seed: ${req.body.avatarSeed}`);
      } else {
        tempUserData.avatar = 'default';
        tempUserData.avatarType = 'api';
        console.log(`🔄 Using default avatar`);
      }

      // Generate simple verification token (just random string, not JWT)
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Store in session for verification (this is the main storage)
      req.session.pendingRegistration = {
        ...tempUserData,
        verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      // Create environment-aware verification URL 🌍
      const baseUrl = getSmartBaseUrl(req);
      const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`;

      console.log('🌍 Using smart base URL:', baseUrl);
      console.log('🔗 Generated verification URL:', verificationUrl);

      try {
        // Send verification email with godly-level email service! 🚀⚡
        await emailService.sendVerificationEmail({
          to: email,
          username: username,
          name: name,
          verificationUrl: verificationUrl
        });

        console.log('\n🎉 EMAIL SENT SUCCESSFULLY! 🎉');
        console.log(`📧 Verification email sent to: ${email}`);
        console.log(`👤 User: ${name} (@${username})`);
        console.log(`🔗 Verification URL: ${verificationUrl}`);
        console.log('⚠️  USER DATA NOT SAVED TO MONGODB YET - AWAITING VERIFICATION');
        console.log('=====================================\n');

        req.flash('success', `🎉 Registration initiated! We've sent a verification email to ${email}. Please check your inbox and click the verification link to complete your registration and create your account.`);

      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message);

        // Log verification link to console as fallback
        console.log('\n=== EMAIL FALLBACK - VERIFICATION LINK ===');
        console.log(`User: ${name} (${email})`);
        console.log(`Verification Link: ${verificationUrl}`);
        console.log(`Token expires in: 24 hours`);
        console.log('⚠️  USER DATA NOT SAVED TO MONGODB YET - AWAITING VERIFICATION');
        console.log('=========================================\n');

        req.flash('warning', `Registration initiated! However, we couldn't send the verification email. Please check the console for your verification link, or try resending the verification email.`);
      }

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
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        avatarType: user.avatarType,
        avatarUrl: user.avatarUrl,
        role: user.role,
        campus: user.campus
      };

      console.log('💾 LOGIN DEBUG - Session data created:');
      console.log('Session user:', req.session.user);

      // Explicitly save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error('❌ Session save error:', err);
          return res.render('auth/login', {
            title: 'Login to UConnect',
            errors: [{ msg: 'Login failed. Please try again.' }],
            formData: req.body
          });
        }

        console.log('✅ Session saved successfully');
        req.flash('success', `Welcome back, @${user.username}!`);
        res.redirect('/posts');
      });

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
        message: 'Please check your email for the verification link.'
      });
    }

    // Check if there's a pending registration in session
    if (!req.session.pendingRegistration) {
      req.flash('error', 'No pending registration found. Please register again.');
      return res.redirect('/auth/register');
    }

    // Check if token matches
    if (req.session.pendingRegistration.verificationToken !== token) {
      req.flash('error', 'Invalid verification token.');
      return res.redirect('/auth/verify-email');
    }

    // Check if token has expired
    if (new Date() > req.session.pendingRegistration.expiresAt) {
      delete req.session.pendingRegistration;
      req.flash('error', 'Verification token has expired. Please register again.');
      return res.redirect('/auth/register');
    }

    const tempUserData = req.session.pendingRegistration;
      console.log('\n🔍 PROCESSING EMAIL VERIFICATION...');
      console.log(`📧 Email: ${tempUserData.email}`);
      console.log(`👤 User: ${tempUserData.name}`);

      // Check if user already exists (someone might have registered with same data)
      const existingUser = await User.findOne({
        $or: [
          { email: tempUserData.email },
          { username: tempUserData.username }
        ]
      });

      if (existingUser) {
        console.log('⚠️  User already exists in database');
        delete req.session.pendingRegistration;
        req.flash('warning', 'An account with this email or username already exists. Please try logging in.');
        return res.redirect('/auth/login');
      }

      // Handle avatar - save to filesystem properly
      let avatarFilename = null;
      let avatarSeed = null;
      let avatarType = tempUserData.avatarType || 'api';

      if (tempUserData.avatarType === 'upload' && tempUserData.tempAvatar) {
        try {
          console.log(`💾 Processing uploaded avatar: ${tempUserData.tempAvatar.originalname}`);

          // Convert base64 back to Buffer
          const avatarBuffer = Buffer.from(tempUserData.tempAvatar.data, 'base64');

          // Save to filesystem with proper filename
          const { saveTempAvatarToDisk } = require('../middleware/upload');
          avatarFilename = await saveTempAvatarToDisk(avatarBuffer, tempUserData.tempAvatar.originalname);

          console.log(`✅ Avatar file saved: ${avatarFilename}`);
        } catch (avatarError) {
          console.error('❌ Error processing avatar:', avatarError);
          // Fallback to API avatar if upload fails
          avatarType = 'api';
          avatarSeed = crypto.randomBytes(8).toString('hex');
        }
      } else if (tempUserData.avatarType === 'api') {
        avatarSeed = tempUserData.avatarSeed || crypto.randomBytes(8).toString('hex');
      } else {
        // Default fallback
        avatarType = 'api';
        avatarSeed = crypto.randomBytes(8).toString('hex');
      }

      // NOW CREATE THE USER IN MONGODB! 🚀
      const userData = {
        email: tempUserData.email,
        name: tempUserData.name,
        username: tempUserData.username,
        password: tempUserData.password,
        avatarType: avatarType,
        isVerified: true, // Set as verified since they clicked the link!
        verificationToken: null,
        verificationTokenExpires: null
      };

      // Add avatar data based on type
      if (avatarType === 'upload' && avatarFilename) {
        userData.avatar = avatarFilename; // Store just the filename
      } else {
        userData.avatarSeed = avatarSeed;
        userData.avatar = null; // Clear avatar field for API type
      }

      const newUser = new User(userData);

      console.log(`📊 Creating user with avatar type: ${avatarType}`);
      await newUser.save();
      console.log(`📊 User saved. Avatar URL: ${newUser.avatarUrl}`);

      // Clear pending registration from session
      delete req.session.pendingRegistration;

      console.log('✅ USER SUCCESSFULLY CREATED IN MONGODB!');
      console.log(`🆔 User ID: ${newUser._id}`);
      console.log(`📧 Email: ${newUser.email}`);
      console.log(`👤 Username: @${newUser.username}`);
      console.log('=====================================\n');

      req.flash('success', 'Email verified successfully! Your account has been created. You can now log in.');
      res.redirect('/auth/login');

  } catch (error) {
    console.error('Email verification error:', error);
    req.flash('error', 'An error occurred during verification. Please try again.');
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

      // First check if user already exists and is verified in MongoDB
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.isVerified) {
        req.flash('info', 'Your email is already verified');
        return res.redirect('/auth/login');
      }

      if (existingUser && !existingUser.isVerified) {
        req.flash('error', 'This account was created with the old system. Please register again with the new secure system.');
        return res.redirect('/auth/register');
      }

      // Check if there's a pending registration in session
      if (!req.session.pendingRegistration || req.session.pendingRegistration.email !== email) {
        req.flash('error', 'No pending registration found for this email. Please register again.');
        return res.redirect('/auth/register');
      }

      // Check if pending registration has expired
      if (new Date() > req.session.pendingRegistration.expiresAt) {
        delete req.session.pendingRegistration;
        req.flash('error', 'Registration session expired. Please register again.');
        return res.redirect('/auth/register');
      }

      const tempUserData = req.session.pendingRegistration;

      // Generate new simple verification token
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Update session with new token
      req.session.pendingRegistration.verificationToken = verificationToken;
      req.session.pendingRegistration.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create environment-aware verification URL 🌍
      const baseUrl = getSmartBaseUrl(req);
      const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}`;

      console.log('🌍 Resend - Using smart base URL:', baseUrl);
      console.log('🔗 Resend - Generated verification URL:', verificationUrl);

      try {
        // Send verification email
        await emailService.sendVerificationEmail({
          to: email,
          username: tempUserData.username,
          name: tempUserData.name,
          verificationUrl: verificationUrl
        });

        console.log('\n🔄 VERIFICATION EMAIL RESENT! 🔄');
        console.log(`📧 Verification email resent to: ${email}`);
        console.log(`👤 User: ${tempUserData.name} (@${tempUserData.username})`);
        console.log(`🔗 Verification URL: ${verificationUrl}`);
        console.log('⚠️  USER DATA STILL IN SESSION - AWAITING VERIFICATION');
        console.log('====================================\n');

        req.flash('success', `📧 Verification email resent to ${email}! Please check your inbox and click the verification link.`);

      } catch (emailError) {
        console.error('❌ Email resending failed:', emailError.message);

        // Log verification link to console as fallback
        console.log('\n=== RESEND EMAIL FALLBACK - VERIFICATION LINK ===');
        console.log(`User: ${tempUserData.name} (${email})`);
        console.log(`Verification Link: ${verificationUrl}`);
        console.log(`Token expires in: 24 hours`);
        console.log('⚠️  USER DATA STILL IN SESSION - AWAITING VERIFICATION');
        console.log('===============================================\n');

        req.flash('warning', `We couldn't resend the verification email. Please check the console for your verification link, or try again later.`);
      }

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