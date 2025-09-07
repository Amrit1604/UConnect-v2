/**
 * Post Model - UConnect
 * Handles posts, likes, and comments functionality
 */

const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    maxlength: [500, 'Comment cannot exceed 500 characters'],
    set: function(content) {
      // Sanitize HTML content
      return sanitizeHtml(content, {
        allowedTags: [],
        allowedAttributes: {}
      });
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  category: {
    type: String,
    enum: [
      'lost-found',     // 🔍 Lost & Found Items
      'hostels',        // 🏠 Hostel Related
      'canteen',        // 🍕 Food & Canteen
      'pgs',            // 🏡 PG & Accommodation
      'general',        // 💬 General Discussion
      'study',          // 📚 Study Groups & Academic
      'staff',          // 👨‍🏫 Staff & Faculty
      'events',         // 🎉 Campus Events
      'sports',         // ⚽ Sports & Fitness
      'academics'       // 🎓 Academic Resources
    ],
    required: [true, 'Post category is required'],
    default: 'general'
  },

  // 🏷️ Advanced tagging system
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [20, 'Tag cannot exceed 20 characters']
  }],

  // 🚨 Priority level for important posts
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // 📍 Location for lost & found, events etc.
  location: {
    type: String,
    maxlength: [100, 'Location cannot exceed 100 characters'],
    trim: true
  },

  content: {
    type: String,
    required: [true, 'Post content is required'],
    maxlength: [2000, 'Post cannot exceed 2000 characters'],
    set: function(content) {
      // Sanitize HTML content while preserving line breaks
      return sanitizeHtml(content, {
        allowedTags: ['br', 'p'],
        allowedAttributes: {}
      });
    }
  },

  // 🖼️ Image support for posts
  images: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  }],

  // For future media/video support
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document'],
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    }
  }],

  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  comments: [commentSchema],

  // Post visibility and moderation
  isActive: {
    type: Boolean,
    default: true
  },

  isReported: {
    type: Boolean,
    default: false
  },

  reportCount: {
    type: Number,
    default: 0
  },

  reports: [{
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'harassment', 'fake', 'other'],
      required: true
    },
    description: {
      type: String,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Campus context
  campus: {
    type: String,
    required: true
  },

  // Engagement metrics
  engagementScore: {
    type: Number,
    default: 0
  },

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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ campus: 1, createdAt: -1 });
postSchema.index({ isActive: 1, createdAt: -1 });
postSchema.index({ engagementScore: -1, createdAt: -1 });
postSchema.index({ 'likes.user': 1 });
postSchema.index({ category: 1, campus: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ priority: 1, createdAt: -1 });
// Text index for search functionality
postSchema.index({
  content: 'text',
  tags: 'text',
  location: 'text'
});

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for comment count
postSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for time since creation
postSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
});

// Pre-save middleware to calculate engagement score
postSchema.pre('save', function(next) {
  // Simple engagement score calculation
  const likeWeight = 1;
  const commentWeight = 2;
  const ageWeight = 0.1;

  const likes = this.likes ? this.likes.length : 0;
  const comments = this.comments ? this.comments.length : 0;
  const ageInHours = (Date.now() - this.createdAt) / (1000 * 60 * 60);

  this.engagementScore = (likes * likeWeight + comments * commentWeight) / (1 + ageInHours * ageWeight);
  this.updatedAt = new Date();

  next();
});

// Instance method to check if user has liked the post
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Instance method to add a like
postSchema.methods.addLike = function(userId) {
  if (!this.isLikedBy(userId)) {
    this.likes.push({ user: userId });
    return true;
  }
  return false;
};

// Instance method to remove a like
postSchema.methods.removeLike = function(userId) {
  const likeIndex = this.likes.findIndex(like => like.user.toString() === userId.toString());
  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1);
    return true;
  }
  return false;
};

// Instance method to add a comment
postSchema.methods.addComment = function(userId, content) {
  this.comments.push({
    author: userId,
    content: content
  });
};

// Instance method to add a report
postSchema.methods.addReport = function(reporterId, reason, description = '') {
  // Check if user has already reported this post
  const existingReport = this.reports.find(report =>
    report.reporter.toString() === reporterId.toString()
  );

  if (!existingReport) {
    this.reports.push({
      reporter: reporterId,
      reason: reason,
      description: description
    });
    this.reportCount = this.reports.length;

    // Mark as reported if it has 3 or more reports
    if (this.reportCount >= 3) {
      this.isReported = true;
    }

    return true;
  }
  return false;
};

// Static method to get trending posts
postSchema.statics.getTrending = function(campus, limit = 10) {
  return this.find({
    campus: campus,
    isActive: true,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
  })
  .populate('author', 'username avatar avatarType avatarSeed')
  .sort({ engagementScore: -1 })
  .limit(limit);
};

// Static method to get recent posts
postSchema.statics.getRecent = function(campus, limit = 20, skip = 0) {
  return this.find({
    campus: campus,
    isActive: true
  })
  .populate('author', 'username avatar avatarType avatarSeed')
  .populate('comments.author', 'username avatar avatarType avatarSeed')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Static method to get posts by user
postSchema.statics.getByUser = function(userId, limit = 20, skip = 0) {
  return this.find({
    author: userId,
    isActive: true
  })
  .populate('author', 'username avatar avatarType avatarSeed')
  .populate('comments.author', 'username avatar avatarType avatarSeed')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// 🚀 ADVANCED: Get posts by category
postSchema.statics.getByCategory = function(campus, category, limit = 20, skip = 0) {
  return this.find({
    campus: campus,
    category: category,
    isActive: true
  })
  .populate('author', 'username avatar avatarType avatarSeed')
  .populate('comments.author', 'username avatar avatarType avatarSeed')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// 🎯 ADVANCED: Search posts with filters
postSchema.statics.searchPosts = function(campus, searchQuery, category = null, tags = [], limit = 20) {
  let query = {
    campus: campus,
    isActive: true
  };

  // Add text search
  if (searchQuery) {
    query.$text = { $search: searchQuery };
  }

  // Add category filter
  if (category && category !== 'all') {
    query.category = category;
  }

  // Add tags filter
  if (tags.length > 0) {
    query.tags = { $in: tags };
  }

  return this.find(query)
    .populate('author', 'username avatar avatarType avatarSeed')
    .populate('comments.author', 'username avatar avatarType avatarSeed')
    .sort(searchQuery ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
    .limit(limit);
};

// 📊 ADVANCED: Get category statistics
postSchema.statics.getCategoryStats = function(campus) {
  return this.aggregate([
    {
      $match: {
        campus: campus,
        isActive: true,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalLikes: { $sum: { $size: '$likes' } },
        totalComments: { $sum: { $size: '$comments' } },
        avgEngagement: { $avg: '$engagementScore' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Static method to get reported posts for admin
postSchema.statics.getReported = function() {
  return this.find({
    isReported: true
  })
  .populate('author', 'name email')
  .populate('reports.reporter', 'name email')
  .sort({ reportCount: -1, createdAt: -1 });
};

module.exports = mongoose.model('Post', postSchema);