/**
 * Gossip Model - UConnect
 * Handles anonymous gossip messages with comments and likes
 */

const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

const gossipCommentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    maxlength: [300, 'Comment cannot exceed 300 characters'],
    set: function(content) {
      return sanitizeHtml(content, {
        allowedTags: [],
        allowedAttributes: {}
      });
    }
  },
  anonId: {
    type: String,
    required: true
  },
  likes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

const gossipSchema = new mongoose.Schema({
  // Anonymous ID for tracking user's own messages without identifying them
  anonId: {
    type: String,
    required: true,
    index: true
  },

  content: {
    type: String,
    required: [true, 'Gossip content is required'],
    maxlength: [1000, 'Gossip cannot exceed 1000 characters'],
    minlength: [5, 'Gossip must be at least 5 characters long'],
    set: function(content) {
      return sanitizeHtml(content, {
        allowedTags: [],
        allowedAttributes: {}
      });
    }
  },

  // Comments on the gossip
  comments: [gossipCommentSchema],

  // Like system
  likes: {
    type: Number,
    default: 0,
    min: 0
  },

  likedBy: [{
    anonId: String,
    _id: false
  }],

  // For anonymity, we don't store user ID
  // But we can use IP + User Agent hash for identification
  ipHash: {
    type: String,
    default: null
  },

  status: {
    type: String,
    enum: ['active', 'hidden', 'deleted'],
    default: 'active'
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for fetching recent gossips efficiently
gossipSchema.index({ createdAt: -1 });
gossipSchema.index({ status: 1, createdAt: -1 });

// Static method to fetch active gossips
gossipSchema.statics.getActiveGossips = function(limit = 50, skip = 0) {
  return this.find({ status: 'active' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .exec();
};

// Static method to add a comment
gossipSchema.statics.addComment = async function(gossipId, content, anonId) {
  const gossip = await this.findById(gossipId);
  if (!gossip) throw new Error('Gossip not found');

  gossip.comments.push({
    content,
    anonId,
    likes: 0
  });

  return await gossip.save();
};

// Static method to like a comment
gossipSchema.statics.likeComment = async function(gossipId, commentIndex, anonId) {
  const gossip = await this.findById(gossipId);
  if (!gossip) throw new Error('Gossip not found');

  if (commentIndex < 0 || commentIndex >= gossip.comments.length) {
    throw new Error('Comment not found');
  }

  gossip.comments[commentIndex].likes += 1;
  return await gossip.save();
};

// Static method to delete a comment (by anonId owner)
gossipSchema.statics.deleteComment = async function(gossipId, commentIndex, anonId) {
  const gossip = await this.findById(gossipId);
  if (!gossip) throw new Error('Gossip not found');

  if (commentIndex < 0 || commentIndex >= gossip.comments.length) {
    throw new Error('Comment not found');
  }

  // Check if user owns the comment
  if (gossip.comments[commentIndex].anonId !== anonId) {
    throw new Error('You can only delete your own comments');
  }

  gossip.comments.splice(commentIndex, 1);
  return await gossip.save();
};

// Instance method to toggle like
gossipSchema.methods.toggleLike = function(anonId) {
  const likedIndex = this.likedBy.findIndex(like => like.anonId === anonId);

  if (likedIndex > -1) {
    // Unlike
    this.likedBy.splice(likedIndex, 1);
    this.likes = Math.max(0, this.likes - 1);
  } else {
    // Like
    this.likedBy.push({ anonId });
    this.likes += 1;
  }

  return this.save();
};

// Instance method to check if liked by user
gossipSchema.methods.isLikedBy = function(anonId) {
  return this.likedBy.some(like => like.anonId === anonId);
};

// Instance method for soft delete
gossipSchema.methods.softDelete = function() {
  this.status = 'deleted';
  return this.save();
};

module.exports = mongoose.model('Gossip', gossipSchema);
