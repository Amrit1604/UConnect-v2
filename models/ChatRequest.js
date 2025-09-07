/**
 * 🔥 HULK-POWERED SECRET MESSAGE SYSTEM 🔥
 * Private Chat Request Model - For secret communications between students
 */

const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema({
  // Requester (who wants to chat)
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Target user (who will receive the request)
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The post where the request was made
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },

  // Request message from requester
  message: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },

  // Status of the request
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },

  // Private room ID (generated when accepted)
  roomId: {
    type: String,
    unique: true,
    sparse: true
  },

  // Room expiry time (24 hours after acceptance)
  roomExpiry: {
    type: Date
  },

  // Request expiry (48 hours from creation)
  requestExpiry: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    }
  },

  // Response from target user
  response: {
    type: String,
    maxlength: 200,
    trim: true
  },

  // Metadata
  campus: {
    type: String,
    required: true
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Compound index for efficient queries
chatRequestSchema.index({ target: 1, status: 1, createdAt: -1 });
chatRequestSchema.index({ requester: 1, createdAt: -1 });
chatRequestSchema.index({ post: 1, requester: 1, target: 1 });
chatRequestSchema.index({ roomId: 1 });

// Generate unique room ID
chatRequestSchema.methods.generateRoomId = function() {
  const crypto = require('crypto');
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `secret_${timestamp}_${random}`;
};

// Check if request is expired
chatRequestSchema.methods.isExpired = function() {
  return new Date() > this.requestExpiry;
};

// Check if room is expired
chatRequestSchema.methods.isRoomExpired = function() {
  return this.roomExpiry && new Date() > this.roomExpiry;
};

// Accept the chat request
chatRequestSchema.methods.acceptRequest = async function() {
  this.status = 'accepted';
  this.roomId = this.generateRoomId();
  this.roomExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return await this.save();
};

// Virtual for room URL
chatRequestSchema.virtual('roomUrl').get(function() {
  if (this.roomId && !this.isRoomExpired()) {
    return `/chat/private/${this.roomId}`;
  }
  return null;
});

// Static method to clean expired requests
chatRequestSchema.statics.cleanExpired = async function() {
  await this.updateMany(
    {
      $or: [
        { requestExpiry: { $lt: new Date() }, status: 'pending' },
        { roomExpiry: { $lt: new Date() }, status: 'accepted' }
      ]
    },
    {
      $set: {
        status: 'expired',
        isActive: false
      }
    }
  );
};

// Pre-save middleware to set campus
chatRequestSchema.pre('save', function(next) {
  if (this.isNew && this.populated('requester')) {
    this.campus = this.requester.campus;
  }
  next();
});

module.exports = mongoose.model('ChatRequest', chatRequestSchema);
