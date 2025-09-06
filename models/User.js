/**
 * User Model - UConnect
 * Handles user authentication and profile data
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        // Only allow .edu.in emails for students
        return /^[^\s@]+@[^\s@]+\.edu\.in$/.test(email);
      },
      message: 'Please use a valid .edu.in email address'
    }
  },

  displayName: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true,
    minlength: [2, 'Display name must be at least 2 characters'],
    maxlength: [50, 'Display name cannot exceed 50 characters'],
    validate: {
      validator: function(name) {
        // Allow letters, numbers, spaces, and basic punctuation
        return /^[a-zA-Z0-9\s\-_.]+$/.test(name);
      },
      message: 'Display name contains invalid characters'
    }
  },

  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    validate: {
      validator: function(username) {
        // Allow letters, numbers, and underscores only
        return /^[a-zA-Z0-9_]+$/.test(username);
      },
      message: 'Username can only contain letters, numbers, and underscores'
    }
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    validate: {
      validator: function(password) {
        // Require at least one uppercase, one lowercase, one number, and one special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },

  avatar: {
    type: String,
    default: null // Will store filename of uploaded avatar or API avatar URL
  },

  avatarType: {
    type: String,
    enum: ['upload', 'api', 'default'],
    default: 'default'
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  verificationToken: {
    type: String,
    default: null
  },

  verificationTokenExpires: {
    type: Date,
    default: null
  },

  resetPasswordToken: {
    type: String,
    default: null
  },

  resetPasswordExpires: {
    type: Date,
    default: null
  },

  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },

  isActive: {
    type: Boolean,
    default: true
  },

  lastLogin: {
    type: Date,
    default: null
  },

  // Campus information extracted from email
  campus: {
    type: String,
    default: function() {
      if (this.email) {
        // Extract campus from email (e.g., student@xyz.edu.in -> xyz)
        const match = this.email.match(/@([^.]+)\.edu\.in$/);
        return match ? match[1] : null;
      }
      return null;
    }
  },

  // User statistics
  stats: {
    postsCount: { type: Number, default: 0 },
    likesReceived: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 }
  },

  // Account creation and updates
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationToken;
      delete ret.resetPasswordToken;
      return ret;
    }
  }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ campus: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update timestamps
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to generate verification token
userSchema.methods.generateVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = token;
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return token;
};

// Instance method to generate JWT verification token
userSchema.methods.generateJWTVerificationToken = function() {
  const jwt = require('jsonwebtoken');
  const payload = {
    userId: this._id,
    email: this.email,
    type: 'email_verification'
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: '24h'
  });

  this.verificationToken = token;
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return token;
};

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = token;
  this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return token;
};

// Static method to find users by campus
userSchema.statics.findByCampus = function(campus) {
  return this.find({ campus: campus, isVerified: true, isActive: true });
};

// Static method to get user statistics
userSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } }
      }
    }
  ]);

  return stats[0] || { totalUsers: 0, verifiedUsers: 0, activeUsers: 0 };
};

// Virtual for avatar URL
userSchema.virtual('avatarUrl').get(function() {
  if (this.avatar) {
    if (this.avatarType === 'api') {
      // If avatar is already a full URL, return it; otherwise, generate URL
      if (this.avatar.startsWith('http')) {
        return this.avatar;
      } else {
        return `https://api.dicebear.com/9.x/adventurer/svg?seed=${this.avatar}`;
      }
    } else if (this.avatarType === 'upload') {
      // Return the uploaded file path
      return `/uploads/avatars/${this.avatar}`;
    }
  }
  // Generate a default API avatar based on username
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${this.username || this.email}`;
});

module.exports = mongoose.model('User', userSchema);