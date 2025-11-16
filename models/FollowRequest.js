/**
 * FollowRequest Model - UConnect
 * Handles follow requests for 1v1 chat access
 */

const mongoose = require('mongoose');

const followRequestSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'blocked'],
    default: 'pending',
    index: true
  },
  
  message: {
    type: String,
    maxlength: [200, 'Request message cannot exceed 200 characters'],
    default: 'Hi! Let\'s connect and chat!'
  },
  
  // Timestamps for tracking
  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  respondedAt: {
    type: Date,
    default: null
  },
  
  // Admin tracking for spam prevention
  isReported: {
    type: Boolean,
    default: false
  },
  
  reportReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
followRequestSchema.index({ sender: 1, receiver: 1 });
followRequestSchema.index({ receiver: 1, status: 1 });
followRequestSchema.index({ sender: 1, status: 1 });
followRequestSchema.index({ sentAt: -1 });

// Prevent duplicate pending requests
followRequestSchema.index(
  { sender: 1, receiver: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: 'pending' }
  }
);

// Static method to check if request exists
followRequestSchema.statics.checkExisting = async function(senderId, receiverId) {
  return await this.findOne({
    sender: senderId,
    receiver: receiverId,
    status: 'pending'
  });
};

// Static method to count rejected requests (for spam detection)
followRequestSchema.statics.countRejectedRequests = async function(senderId, receiverId, timeWindow = 30 * 24 * 60 * 60 * 1000) {
  const since = new Date(Date.now() - timeWindow);
  return await this.countDocuments({
    sender: senderId,
    receiver: receiverId,
    status: 'rejected',
    respondedAt: { $gte: since }
  });
};

// Static method to get spam statistics for a user
followRequestSchema.statics.getSpamStats = async function(userId, timeWindow = 7 * 24 * 60 * 60 * 1000) {
  const since = new Date(Date.now() - timeWindow);
  
  const stats = await this.aggregate([
    {
      $match: {
          sender: new mongoose.Types.ObjectId(userId),
          sentAt: { $gte: since }
        }
    },
    {
      $group: {
        _id: null,
        totalSent: { $sum: 1 },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        accepted: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || { totalSent: 0, rejected: 0, accepted: 0, pending: 0 };
};

// Instance method to accept request
followRequestSchema.methods.accept = async function() {
  this.status = 'accepted';
  this.respondedAt = new Date();
  return await this.save();
};

// Instance method to reject request
followRequestSchema.methods.reject = async function() {
  this.status = 'rejected';
  this.respondedAt = new Date();
  return await this.save();
};

// Instance method to block sender
followRequestSchema.methods.block = async function() {
  this.status = 'blocked';
  this.respondedAt = new Date();
  return await this.save();
};

module.exports = mongoose.model('FollowRequest', followRequestSchema);
