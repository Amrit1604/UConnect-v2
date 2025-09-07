/**
 * 🔥 HULK-POWERED PRIVATE CHAT MESSAGES 🔥
 * Secret message storage for private rooms
 */

const mongoose = require('mongoose');

const privateChatSchema = new mongoose.Schema({
  // Chat room ID
  roomId: {
    type: String,
    required: true,
    index: true
  },

  // Message sender
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Message content
  message: {
    type: String,
    required: true,
    maxlength: 1000,
    trim: true
  },

  // Message type
  messageType: {
    type: String,
    enum: ['text', 'emoji', 'system'],
    default: 'text'
  },

  // Read status
  isRead: {
    type: Boolean,
    default: false
  },

  // Read timestamp
  readAt: {
    type: Date
  },

  // Message reactions
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      maxlength: 10
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // Edit history
  isEdited: {
    type: Boolean,
    default: false
  },

  editedAt: {
    type: Date
  },

  originalMessage: {
    type: String
  },

  // Deletion
  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedAt: {
    type: Date
  }

}, {
  timestamps: true
});

// Compound indexes for efficient queries
privateChatSchema.index({ roomId: 1, createdAt: -1 });
privateChatSchema.index({ sender: 1, roomId: 1 });

// Mark message as read
privateChatSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return await this.save();
  }
};

// Edit message
privateChatSchema.methods.editMessage = async function(newMessage) {
  this.originalMessage = this.message;
  this.message = newMessage;
  this.isEdited = true;
  this.editedAt = new Date();
  return await this.save();
};

// Soft delete message
privateChatSchema.methods.deleteMessage = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return await this.save();
};

// Add reaction
privateChatSchema.methods.addReaction = async function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => !r.user.equals(userId));

  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji,
    timestamp: new Date()
  });

  return await this.save();
};

// Virtual for formatted timestamp
privateChatSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

module.exports = mongoose.model('PrivateChat', privateChatSchema);
