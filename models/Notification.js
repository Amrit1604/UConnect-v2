/**
 * Notification Model - UConnect
 * Handles in-app notifications for follow requests, messages, and admin actions
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  type: {
    type: String,
    enum: [
      'follow_request',
      'follow_accepted',
      'new_message',
      'admin_warning',
      'admin_block',
      'system'
    ],
    required: true,
    index: true
  },
  
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // Reference to related entity
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  relatedType: {
    type: String,
    enum: ['FollowRequest', 'Message', 'User', null],
    default: null
  },
  
  // Action URL for clicking notification
  actionUrl: {
    type: String,
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
  
  // Priority for sorting (admin notifications = high priority)
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });

// Static method to create follow request notification
notificationSchema.statics.createFollowRequestNotification = async function(sender, receiver, followRequestId) {
  return await this.create({
    recipient: receiver,
    sender: sender._id,
    type: 'follow_request',
    title: `${sender.username} wants to connect!`,
    message: `${sender.username} is reaching out. Let's have a chat!`,
    relatedId: followRequestId,
    relatedType: 'FollowRequest',
    actionUrl: '/chat/requests',
    priority: 'normal'
  });
};

// Static method to create follow accepted notification
notificationSchema.statics.createFollowAcceptedNotification = async function(accepter, requester) {
  return await this.create({
    recipient: requester,
    sender: accepter._id,
    type: 'follow_accepted',
    title: `${accepter.username} accepted your request!`,
    message: `You and ${accepter.username} are now friends. Start chatting!`,
    relatedId: accepter._id,
    relatedType: 'User',
    actionUrl: `/chat/${accepter._id}`,
    priority: 'normal'
  });
};

// Static method to create new message notification
notificationSchema.statics.createMessageNotification = async function(sender, receiver, messageId) {
  return await this.create({
    recipient: receiver,
    sender: sender._id,
    type: 'new_message',
    title: `New message from ${sender.username}`,
    message: `${sender.username} sent you a message`,
    relatedId: messageId,
    relatedType: 'Message',
    actionUrl: `/chat/${sender._id}`,
    priority: 'normal'
  });
};

// Static method to create admin warning notification
notificationSchema.statics.createAdminWarningNotification = async function(userId, reason) {
  return await this.create({
    recipient: userId,
    sender: null,
    type: 'admin_warning',
    title: 'Admin Warning',
    message: reason,
    priority: 'urgent',
    actionUrl: '/settings/account'
  });
};

// Static method to create admin block notification
notificationSchema.statics.createAdminBlockNotification = async function(userId, reason, duration) {
  const message = duration 
    ? `${reason} You have been temporarily blocked for ${duration}.`
    : `${reason} Your account has been restricted.`;
    
  return await this.create({
    recipient: userId,
    sender: null,
    type: 'admin_block',
    title: 'Account Restricted',
    message,
    priority: 'urgent',
    actionUrl: '/settings/account'
  });
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    recipient: userId,
    isRead: false
  });
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function(userId, page = 1, limit = 20, unreadOnly = false) {
  const skip = (page - 1) * limit;
  
  const query = { recipient: userId };
  if (unreadOnly) {
    query.isRead = false;
  }
  
  return await this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sender', 'username name avatarSeed avatarType avatarGridFSId');
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    {
      recipient: userId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

// Static method to mark specific notifications as read
notificationSchema.statics.markAsRead = async function(notificationIds, userId) {
  return await this.updateMany(
    {
      _id: { $in: notificationIds },
      recipient: userId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

// Instance method to mark as read
notificationSchema.methods.markRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return await this.save();
  }
  return this;
};

// Static method to delete old read notifications (cleanup)
notificationSchema.statics.deleteOldNotifications = async function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  return await this.deleteMany({
    isRead: true,
    readAt: { $lt: cutoffDate }
  });
};

module.exports = mongoose.model('Notification', notificationSchema);
