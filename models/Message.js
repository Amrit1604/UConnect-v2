/**
 * Message Model - UConnect
 * Handles 1v1 chat messages with support for text, voice, images, and files
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
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

  friendship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Friendship',
    required: true,
    index: true
  },

  messageType: {
    type: String,
    enum: ['text', 'voice', 'image', 'video', 'file'],
    default: 'text',
    required: true
  },

  content: {
    type: String,
    maxlength: [5000, 'Message cannot exceed 5000 characters'],
    default: ''
  },

  // GridFS file reference for media
  fileGridFSId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  fileName: {
    type: String,
    default: null
  },

  fileSize: {
    type: Number,
    default: null
  },

  fileMimeType: {
    type: String,
    default: null
  },

  // Voice message metadata
  voiceDuration: {
    type: Number, // in seconds
    default: null
  },

  // Message status
  isDelivered: {
    type: Boolean,
    default: false,
    index: true
  },

  deliveredAt: {
    type: Date,
    default: null
  },

  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  readAt: {
    type: Date,
    default: null
  },

  isDelivered: {
    type: Boolean,
    default: false
  },

  deliveredAt: {
    type: Date,
    default: null
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Edit tracking
  isEdited: {
    type: Boolean,
    default: false
  },

  editedAt: {
    type: Date,
    default: null
  },

  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },

  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
messageSchema.index({ sender: 1, receiver: 1, sentAt: -1 });
messageSchema.index({ friendship: 1, sentAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ sentAt: -1 });

// Virtual for file URL
messageSchema.virtual('fileUrl').get(function() {
  if (this.fileGridFSId) {
    return `/gridfs/file/${this.fileGridFSId}`;
  }
  return null;
});

// Static method to get conversation messages
messageSchema.statics.getConversation = async function(userId1, userId2, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  const messages = await this.find({
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 }
    ],
    isDeleted: false
  })
    .sort({ sentAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'username name avatarSeed avatarType avatarGridFSId')
    .populate('receiver', 'username name avatarSeed avatarType avatarGridFSId')
    .populate('replyTo', 'content messageType sender');

  return messages.reverse(); // Return in chronological order
};

// Static method to count unread messages
messageSchema.statics.countUnread = async function(userId) {
  return await this.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false
  });
};

// Static method to count unread messages from specific sender
messageSchema.statics.countUnreadFrom = async function(receiverId, senderId) {
  return await this.countDocuments({
    receiver: receiverId,
    sender: senderId,
    isRead: false,
    isDeleted: false
  });
};

// Static method to mark messages as read
messageSchema.statics.markAsRead = async function(receiverId, senderId) {
  const result = await this.updateMany(
    {
      receiver: receiverId,
      sender: senderId,
      isRead: false,
      isDeleted: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );

  return result.modifiedCount;
};

// Static method to mark messages as delivered
messageSchema.statics.markAsDelivered = async function(receiverId, senderId) {
  return await this.updateMany(
    {
      receiver: receiverId,
      sender: senderId,
      isDelivered: false,
      isDeleted: false
    },
    {
      $set: {
        isDelivered: true,
        deliveredAt: new Date()
      }
    }
  );
};

// Instance method to mark as read
messageSchema.methods.markRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return await this.save();
  }
  return this;
};

// Instance method to soft delete for a user
messageSchema.methods.deleteForUser = async function(userId) {
  if (!this.deletedBy.includes(userId)) {
    this.deletedBy.push(userId);

    // If both users deleted, mark as fully deleted
    if (this.deletedBy.length >= 2) {
      this.isDeleted = true;
    }

    return await this.save();
  }
  return this;
};

// Static method to get last message between users
messageSchema.statics.getLastMessage = async function(userId1, userId2) {
  return await this.findOne({
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 }
    ],
    isDeleted: false
  })
    .sort({ sentAt: -1 })
    .populate('sender', 'username name');
};

// Static method to search messages
messageSchema.statics.searchMessages = async function(userId, query, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  return await this.find({
    $or: [
      { sender: userId },
      { receiver: userId }
    ],
    messageType: 'text',
    content: regex,
    isDeleted: false
  })
    .sort({ sentAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender receiver', 'username name avatarSeed avatarType avatarGridFSId');
};

module.exports = mongoose.model('Message', messageSchema);
