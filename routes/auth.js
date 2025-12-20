const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const { redirectIfAuthenticated, validateEduEmail, sensitiveOperationLimit } = require('../middleware/auth');
const { uploadAvatarTemp } = require('../middleware/upload');
const emailService = require('../services/emailService');
// const { getSmartBaseUrl } = require('../utils/smartUrl');



// Simple function to get base URL
const getSmartBaseUrl = (req) => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
};

const router = express.Router();

// Encryption helpers for temporarily storing password in session without plaintext
// Uses AES-256-GCM. Provide `PASSWORD_SESSION_KEY` as base64 in env for strong key.
const ENC_KEY = (process.env.PASSWORD_SESSION_KEY ? Buffer.from(process.env.PASSWORD_SESSION_KEY, 'base64') : null) || crypto.createHash('sha256').update(process.env.SESSION_SECRET || 'fallback-secret-change-in-production').digest();
function encryptForSession(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}
function decryptFromSession(payload) {
  if (!payload) return null;
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) return null;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

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
    .withMessage('Password must be at least 8 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const loginValidation = [
  body('email').notEmpty().withMessage('Email or username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// GET /auth/register - Show registration form (Neo Design)
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register-neo', {
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
      // Avoid logging full request body to prevent leaking sensitive fields (passwords)
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render('auth/register-neo', {
          title: 'Join UConnect',
          errors: errors.array(),
          formData: req.body
        });
      }

      const { email, name, username, password, avatarType } = req.body;
      console.log(`Register attempt for email=${email}, username=${username}, avatarFile=${req.file ? req.file.originalname : 'none'}`);

      // Check if user already exists in MongoDB (verified users only)
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });
      if (existingUser) {
        const message = existingUser.email === email ?
          'An account with this email already exists and is verified' :
          'This username is already taken';
        return res.render('auth/register-neo', {
          title: 'Join UConnect',
          errors: [{ msg: message }],
          formData: req.body
        });
      }

      // Prepare user data for temporary storage (DON'T save to MongoDB yet!)
      // Encrypt the password before storing in session so plaintext is never stored in Redis
      const encryptedPassword = encryptForSession(password);

      const tempUserData = {
        email,
        name,
        username,
        // Store encryptedPassword instead of plaintext password
        encryptedPassword,
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
        tempUserData.avatarSeed = req.body.avatarSeed;
        tempUserData.avatarType = 'api';
        console.log(`🎲 API avatar seed stored: ${req.body.avatarSeed}`);
      } else {
        // Generate random seed for default avatar
        tempUserData.avatarSeed = crypto.randomBytes(8).toString('hex');
        tempUserData.avatarType = 'api';
        console.log(`🔄 Using default avatar with generated seed: ${tempUserData.avatarSeed}`);
      }

      // Generate simple verification token (just random string, not JWT)
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Delete any existing pending registration for this email/username
      await PendingRegistration.deleteMany({
        $or: [{ email }, { username }]
      });

      // Store in MongoDB for device-independent verification
      await PendingRegistration.create({
        ...tempUserData,
        verificationToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours, auto-deleted by MongoDB TTL
        createdAt: new Date()
      });

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
      res.render('auth/register-neo', {
        title: 'Join UConnect',
        errors: [{ msg: 'Registration failed. Please try again.' }],
        formData: req.body
      });
    }
  }
);

// GET /auth/login - Show login form (Neo Design)
router.get('/login', redirectIfAuthenticated, (req, res) => {
  // Check for account deletion confirmation
  if (req.query.deleted === 'true') {
    req.flash('success', '👋 Account deleted successfully! Thank you for using UConnect. You\'re welcome back anytime!');
  }

  // Check for account deactivation (pause)
  if (req.query.deactivated === 'true') {
    req.flash('info', '🔒 Your account has been paused. Log in with your password to reactivate it.');
  }

  res.render('auth/login-neo', {
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
        return res.render('auth/login-neo', {
          title: 'Login to UConnect',
          errors: errors.array(),
          formData: req.body
        });
      }

      const { email, password } = req.body;

      // Find user by email OR username
      let user = null;

      // Check if input looks like an email
      if (email.includes('@')) {
        user = await User.findOne({ email: email.toLowerCase() });
      } else {
        // Otherwise treat it as username
        user = await User.findOne({ username: email.toLowerCase() });
      }

      if (!user) {
        return res.render('auth/login-neo', {
          title: 'Login to UConnect',
          errors: [{ msg: 'Invalid email/username or password' }],
          formData: req.body
        });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.render('auth/login-neo', {
          title: 'Login to UConnect',
          errors: [{ msg: 'Invalid email/username or password' }],
          formData: req.body
        });
      }

      // If user self-deactivated (paused), allow reactivation on successful login
      if (!user.isActive) {
        // Only auto-reactivate if it was a user-initiated pause
        if (user.deactivatedAt) {
          const Post = require('../models/Post');
          user.isActive = true;
          user.deactivatedAt = null;
          await user.save();

          // Restore only posts hidden due to user deactivation
          await Post.updateMany(
            { author: user._id, deactivatedByUser: true },
            { $set: { isActive: true, deactivatedByUser: false } }
          );

          req.flash('success', 'Welcome back — your account has been reactivated.');
        } else {
          return res.render('auth/login-neo', {
            title: 'Login to UConnect',
            errors: [{ msg: 'Your account is inactive. Please contact support.' }],
            formData: req.body
          });
        }
      }

      // Check if email is verified (admin accounts bypass verification)
      if (!user.isVerified && user.role !== 'admin') {
        return res.render('auth/login-neo', {
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
        avatarSeed: user.avatarSeed,
        avatarType: user.avatarType,
        avatarUrl: user.avatarUrl,
        role: user.role,
        campus: user.campus
      };

      console.log('💾 LOGIN DEBUG - Session data created:');
      console.log('Session user:', req.session.user);
      console.log('Avatar details:', {
        avatar: user.avatar,
        avatarSeed: user.avatarSeed,
        avatarType: user.avatarType,
        avatarUrl: user.avatarUrl
      });

      // Explicitly save session before redirect
      req.session.save((err) => {
        if (err) {
          console.error('❌ Session save error:', err);
          return res.render('auth/login-neo', {
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
      res.render('auth/login-neo', {
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
    const startTime = Date.now();
    const { token } = req.query;

    if (!token) {
      // Show verification page if no token provided
      return res.render('auth/verify-email', {
        title: 'Verify Your Email',
        message: 'Please check your email for the verification link.'
      });
    }

    console.log('\n⏱️ VERIFICATION REQUEST RECEIVED');

    // Atomically fetch and delete pending registration to prevent race conditions
    console.log(`🔍 Looking up and claiming pending registration... (${Date.now() - startTime}ms)`);
    const pendingReg = await PendingRegistration.findOneAndDelete({ verificationToken: token });

    if (!pendingReg) {
      console.log('❌ No pending registration found (already verified or expired)');

      // Check if user already exists (might have just been verified)
      const email = req.query.email; // We'll add this to the URL
      if (email) {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser && existingUser.isVerified) {
          req.flash('success', 'Your account is already verified! You can log in now.');
          return res.redirect('/auth/login');
        }
      }

      req.flash('error', 'Invalid or expired verification link. Please register again.');
      return res.redirect('/auth/register');
    }

    console.log(`✅ Pending registration claimed (${Date.now() - startTime}ms)`);
    console.log(`📧 Email: ${pendingReg.email}`);

    // Check if token has expired (backup check, TTL should handle this)
    if (new Date() > pendingReg.expiresAt) {
      req.flash('error', 'Verification token has expired. Please register again.');
      return res.redirect('/auth/register');
    }

    const tempUserData = pendingReg;
      console.log('\n🔍 PROCESSING EMAIL VERIFICATION...');
      console.log(`📧 Email: ${tempUserData.email}`);
      console.log(`👤 User: ${tempUserData.name}`);

      // Check if user already exists (someone might have registered with same data)
      console.log(`🔍 Checking for existing user... (${Date.now() - startTime}ms)`);
      const existingUser = await User.findOne({
        $or: [
          { email: tempUserData.email },
          { username: tempUserData.username }
        ]
      });
      console.log(`✅ DB check complete (${Date.now() - startTime}ms)`);

      if (existingUser) {
        console.log('⚠️  User already exists in database');
        // No need to delete pendingReg - already deleted with findOneAndDelete
        req.flash('warning', 'An account with this email or username already exists. Please try logging in.');
        return res.redirect('/auth/login');
      }

      // Handle avatar - save to GridFS properly
      let avatarGridFSId = null;
      let avatarSeed = null;
      let avatarType = tempUserData.avatarType || 'api';

      if (tempUserData.avatarType === 'upload' && tempUserData.tempAvatar) {
        try {
          console.log(`💾 Processing uploaded avatar: ${tempUserData.tempAvatar.originalname} (${Date.now() - startTime}ms)`);

          // Convert base64 back to Buffer
          const avatarBuffer = Buffer.from(tempUserData.tempAvatar.data, 'base64');

          // Save to GridFS
          const { saveBufferToGridFS } = require('../utils/gridfs');
          console.log(`📤 Saving to GridFS... (${Date.now() - startTime}ms)`);
          avatarGridFSId = await saveBufferToGridFS(
            avatarBuffer,
            tempUserData.tempAvatar.originalname,
            {
              originalName: tempUserData.tempAvatar.originalname,
              mimetype: tempUserData.tempAvatar.mimetype,
              uploadType: 'avatar'
            },
            'avatars'
          );

          avatarType = 'gridfs';
          console.log(`✅ Avatar saved to GridFS: ${avatarGridFSId} (${Date.now() - startTime}ms)`);
        } catch (avatarError) {
          console.error('❌ Error processing avatar:', avatarError);
          // Fallback to API avatar if upload fails
          avatarType = 'api';
          avatarSeed = crypto.randomBytes(8).toString('hex');
        }
      } else if (tempUserData.avatarType === 'api' && tempUserData.avatarSeed) {
        // Use the seed that was selected during registration
        avatarSeed = tempUserData.avatarSeed;
        console.log(`🎲 Using selected avatar seed: ${avatarSeed}`);
      } else {
        // Default fallback
        avatarType = 'api';
        avatarSeed = crypto.randomBytes(8).toString('hex');
        console.log(`🔄 Generated fallback avatar seed: ${avatarSeed}`);
      }

      // NOW CREATE THE USER IN MONGODB! 🚀
      // Decrypt password from session before creating user. Do not keep plaintext in session.
      const decryptedPassword = decryptFromSession(tempUserData.encryptedPassword);
      const userData = {
        email: tempUserData.email,
        name: tempUserData.name,
        username: tempUserData.username,
        password: decryptedPassword,
        avatarType: avatarType,
        isVerified: true, // Set as verified since they clicked the link!
        verificationToken: null,
        verificationTokenExpires: null
      };

      // Add avatar data based on type
      if (avatarType === 'gridfs' && avatarGridFSId) {
        userData.avatarGridFSId = avatarGridFSId;
        userData.avatar = null;
      } else {
        userData.avatarSeed = avatarSeed;
        userData.avatar = null; // Clear avatar field for API type
        userData.avatarGridFSId = null;
      }

      const newUser = new User(userData);

      console.log(`📊 Creating user with avatar type: ${avatarType} (${Date.now() - startTime}ms)`);
      console.log(`💾 Saving user to MongoDB...`);
      await newUser.save();
      console.log(`✅ User saved successfully! (${Date.now() - startTime}ms)`);
      console.log(`📊 User saved. Avatar URL: ${newUser.avatarUrl}`);

      // Pending registration already deleted with findOneAndDelete - no need to delete again
      console.log('✅ Pending registration was cleaned up atomically');

      console.log('✅ USER SUCCESSFULLY CREATED IN MONGODB!');
      console.log(`🆔 User ID: ${newUser._id}`);
      console.log(`📧 Email: ${newUser.email}`);
      console.log(`👤 Username: @${newUser.username}`);
      console.log(`⏱️ Total verification time: ${Date.now() - startTime}ms`);
      console.log('=====================================\n');

      req.flash('success', 'Email verified successfully! Your account has been created. You can now log in.');
      res.redirect('/auth/login');

  } catch (error) {
    console.error('Email verification error:', error);

    // Handle duplicate key error gracefully (link clicked multiple times)
    if (error.code === 11000) {
      console.log('⚠️ User already exists (duplicate click detected)');
      req.flash('success', 'Your account is already verified! You can log in now.');
      return res.redirect('/auth/login');
    }

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

      // Check if there's a pending registration in MongoDB
      const pendingReg = await PendingRegistration.findOne({ email });

      if (!pendingReg) {
        req.flash('error', 'No pending registration found for this email. Please register again.');
        return res.redirect('/auth/register');
      }

      // Check if pending registration has expired
      if (new Date() > pendingReg.expiresAt) {
        await PendingRegistration.deleteOne({ _id: pendingReg._id });
        req.flash('error', 'Registration session expired. Please register again.');
        return res.redirect('/auth/register');
      }

      const tempUserData = pendingReg;

      // Generate new simple verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Update MongoDB with new token
      pendingReg.verificationToken = verificationToken;
      pendingReg.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pendingReg.save();

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

// ========================================
// LEGACY ROUTES (Old Design)
// ========================================

// GET /auth/login-legacy - Show old login form
router.get('/login-legacy', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Login to UConnect',
    errors: [],
    formData: {}
  });
});

// GET /auth/register-legacy - Show old registration form
router.get('/register-legacy', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Join UConnect',
    errors: [],
    formData: {}
  });
});

// ========================================
// FORGOT PASSWORD + RESET PASSWORD ROUTES
// ========================================

let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  // Fallback to bcryptjs when native bcrypt is not available or not installed
  bcrypt = require('bcryptjs');
}

// Show forgot password page
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    errors: [],
    formData: {},
    serverError: null   // <-- IMPORTANT FIX
  });
});


// Handle forgot password request
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'No account found with that email.');
      return res.redirect('/auth/forgot-password');
    }

    // Create reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store hashed token in DB
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    // Build URL
    const resetUrl = `${getSmartBaseUrl(req)}/auth/reset-password/${resetToken}`;

    // Send email
    await emailService.sendResetPasswordEmail({
      to: email,
      name: user.name,
      resetUrl: resetUrl
    });

    req.flash("success", "Password reset link sent to your email!");
    res.redirect("/auth/forgot-password");

  } catch (err) {
    console.error("Forgot password error:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/auth/forgot-password");
  }
});

// Show reset password page
router.get('/reset-password/:token', async (req, res) => {
  try {
    const tokenHash = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Invalid or expired reset token.");
      return res.redirect("/auth/forgot-password");
    }

    res.render("auth/reset-password", {
  title: "Reset Password",
  errors: [],
  token: req.params.token,
  serverError: null
});


  } catch (err) {
    console.error("Reset password page error:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/auth/forgot-password");
  }
});

// Handle new password submission
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect("back");
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Invalid or expired reset token.");
      return res.redirect("/auth/forgot-password");
    }

    // Update password
    user.password = password; // your model will hash automatically
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash("success", "Password reset successful! You can now log in.");
    res.redirect("/auth/login");

  } catch (err) {
    console.error("Reset password error:", err);
    req.flash("error", "Something went wrong.");
    res.redirect("/auth/forgot-password");
  }
});


module.exports = router;