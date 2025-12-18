/**
 * Friendship Model - UConnect
 * Tracks accepted friendships for 1v1 chat access
 */

const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  users: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    required: true,
    validate: {
      validator: function(users) {
        return users.length === 2 && users[0].toString() !== users[1].toString();
      },
      message: 'Friendship must have exactly 2 different users'
    }
  },
  
  // Store sorted user IDs for easy querying
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Last interaction for sorting chat list
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Chat statistics
  messageCount: {
    type: Number,
    default: 0
  },
  
  // Unread message counts per user
  unreadCount: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  
  // Soft delete flag
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for queries
friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });
friendshipSchema.index({ users: 1 });
friendshipSchema.index({ lastMessageAt: -1 });

// Pre-save middleware to ensure user1 < user2 (for consistency)
friendshipSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('users')) {
    const [id1, id2] = this.users.map(u => u.toString()).sort();
    this.user1 = id1;
    this.user2 = id2;
  }
  next();
});

// Static method to create friendship
friendshipSchema.statics.createFriendship = async function(userId1, userId2) {
  const [user1, user2] = [userId1.toString(), userId2.toString()].sort();
  
  // Check if friendship already exists
  const existing = await this.findOne({ user1, user2 });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      return await existing.save();
    }
    return existing;
  }
  
  // Create new friendship
  const friendship = new this({
    users: [user1, user2],
    user1,
    user2,
    unreadCount: new Map([[user1, 0], [user2, 0]])
  });
  
  return await friendship.save();
};

// Static method to check if users are friends
friendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const [user1, user2] = [userId1.toString(), userId2.toString()].sort();
  
  const friendship = await this.findOne({
    user1,
    user2,
    isActive: true
  });
  
  return !!friendship;
};

// Static method to get user's friendships
friendshipSchema.statics.getUserFriendships = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const friendships = await this.find({
    users: userId,
    isActive: true
  })
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('users', 'username name avatarSeed avatarType avatarGridFSId');
  
  return friendships;
};

// Static method to get friendship between two users
friendshipSchema.statics.getFriendship = async function(userId1, userId2) {
  const [user1, user2] = [userId1.toString(), userId2.toString()].sort();
  
  return await this.findOne({
    user1,
    user2,
    isActive: true
  });
};

// Instance method to increment unread count
friendshipSchema.methods.incrementUnread = async function(userId) {
  const userIdStr = userId.toString();
  const currentCount = this.unreadCount.get(userIdStr) || 0;
  this.unreadCount.set(userIdStr, currentCount + 1);
  this.markModified('unreadCount');
  return await this.save();
};

// Instance method to reset unread count
friendshipSchema.methods.resetUnread = async function(userId) {
  const userIdStr = userId.toString();
  this.unreadCount.set(userIdStr, 0);
  this.markModified('unreadCount');
  return await this.save();
};

// Instance method to update last message time
friendshipSchema.methods.updateLastMessage = async function() {
  this.lastMessageAt = new Date();
  this.messageCount += 1;
  return await this.save();
};

// Instance method to get the other user's ID
friendshipSchema.methods.getOtherUserId = function(userId) {
  const userIdStr = userId.toString();
  return this.user1.toString() === userIdStr ? this.user2 : this.user1;
};

module.exports = mongoose.model('Friendship', friendshipSchema);
