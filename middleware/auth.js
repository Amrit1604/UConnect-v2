/**
 * Authentication Middleware - UConnect
 * Handles user authentication and authorization
 */

const User = require('../models/User');

/**
 * Middleware to require authentication
 */
const requireAuth = async (req, res, next) => {
  try {
    // Debug logging
    console.log('🔍 AUTH MIDDLEWARE DEBUG:');
    console.log('Session exists:', !!req.session);
    console.log('Session user:', req.session?.user);
    console.log('Request path:', req.path);

    // Check if session is available
    if (!req.session) {
      console.error('Session not available in requireAuth middleware');
      return res.redirect('/auth/login');
    }

    // Check if user is logged in via session
    if (!req.session.user || !req.session.user.id) {
      console.log('❌ No user in session');
      if (req.flash) {
        req.flash('error', 'Please log in to access this page');
      }
      return res.redirect('/auth/login');
    }

    // Verify user still exists and is active
    const user = await User.findById(req.session.user.id);
    if (!user || !user.isActive) {
      req.session.destroy();
      if (req.flash) {
        req.flash('error', 'Your account is no longer active');
      }
      return res.redirect('/auth/login');
    }

    // Check if user is verified
    if (!user.isVerified) {
      if (req.flash) {
        req.flash('error', 'Please verify your email address to continue');
      }
      return res.redirect('/auth/verify-email');
    }

    console.log('✅ Auth successful for user:', user.username);
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (req.flash) {
      req.flash('error', 'Authentication error occurred');
    }
    res.redirect('/auth/login');
  }
};

/**
 * Middleware to require admin privileges
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      if (req.flash) {
        req.flash('error', 'Access denied. Admin privileges required.');
      }
      return res.redirect('/posts');
    }
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    if (req.flash) {
      req.flash('error', 'Authorization error occurred');
    }
    res.redirect('/posts');
  }
};

/**
 * Middleware to redirect authenticated users away from auth pages
 */
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session.user && req.session.user.id) {
    return res.redirect('/posts');
  }
  next();
};

/**
 * Middleware to check if user owns a resource
 */
const requireOwnership = (resourceModel) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        if (req.flash) {
          req.flash('error', 'Resource not found');
        }
        return res.redirect('/posts');
      }

      // Check if user owns the resource or is admin
      if (resource.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        if (req.flash) {
          req.flash('error', 'You do not have permission to perform this action');
        }
        return res.redirect('/posts');
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership middleware error:', error);
      if (req.flash) {
        req.flash('error', 'Error checking resource ownership');
      }
      res.redirect('/posts');
    }
  };
};

/**
 * Middleware to validate email domain for registration
 */
const validateEduEmail = (req, res, next) => {
  const { email } = req.body;

  // Allow both .edu.in and gmail.com for testing purposes
  if (!email || (!email.endsWith('.edu.in') && !email.endsWith('@gmail.com'))) {
    if (req.flash) {
      req.flash('error', 'Please use a valid .edu.in email address or Gmail for testing');
    }
    return res.redirect('/auth/register');
  }

  next();
};

/**
 * Middleware to check rate limiting for sensitive operations
 * COMMENTED OUT FOR TESTING - Remove comments in production
 */
const sensitiveOperationLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  // const attempts = new Map();

  return (req, res, next) => {
    // Skip rate limiting for testing
    next();

    /* ORIGINAL RATE LIMITING CODE - UNCOMMENT FOR PRODUCTION
    const key = req.ip + (req.user ? req.user._id : '');
    const now = Date.now();

    // Clean old entries
    for (const [k, v] of attempts.entries()) {
      if (now - v.firstAttempt > windowMs) {
        attempts.delete(k);
      }
    }

    const userAttempts = attempts.get(key);

    if (!userAttempts) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (userAttempts.count >= maxAttempts) {
      if (req.flash) {
        req.flash('error', 'Too many attempts. Please try again later.');
      }
      return res.redirect('back');
    }

    userAttempts.count++;
    next();
    */
  };
};

/**
 * Middleware to log user activity
 */
const logActivity = (action) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        console.log(`User ${req.user.displayName} (${req.user.email}) performed: ${action}`);

        // Update last activity timestamp
        await User.findByIdAndUpdate(req.user._id, {
          lastLogin: new Date()
        });
      }
      next();
    } catch (error) {
      console.error('Activity logging error:', error);
      next(); // Don't block the request if logging fails
    }
  };
};

module.exports = {
  requireAuth,
  requireAdmin,
  redirectIfAuthenticated,
  requireOwnership,
  validateEduEmail,
  sensitiveOperationLimit,
  logActivity
};