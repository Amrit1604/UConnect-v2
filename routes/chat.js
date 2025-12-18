/**
 * Chat Routes - UConnect
 * Handles follow requests, 1v1 messaging, and chat management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const FollowRequest = require('../models/FollowRequest');
const Friendship = require('../models/Friendship');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const AdminLog = require('../models/AdminLog');
const { requireAuth, logActivity } = require('../middleware/auth');
const { uploadChatMedia } = require('../utils/gridfs');

const router = express.Router();

// 🔒 APPLY AUTHENTICATION TO ALL CHAT ROUTES
router.use(requireAuth);

// ==========================================
// FOLLOW REQUEST ROUTES
// ==========================================

// GET /chat/requests - View all follow requests (sent & received)
router.get('/requests', async (req, res) => {
  try {
    const [receivedRequests, sentRequests] = await Promise.all([
      FollowRequest.find({ 
        receiver: req.user._id, 
        status: 'pending' 
      })
        .populate('sender', 'username name avatarSeed avatarType avatarGridFSId stats')
        .sort({ sentAt: -1 }),
      
      FollowRequest.find({ 
        sender: req.user._id, 
        status: 'pending' 
      })
        .populate('receiver', 'username name avatarSeed avatarType avatarGridFSId stats')
        .sort({ sentAt: -1 })
    ]);

    res.render('layout', {
      title: 'Follow Requests',
      bodyTemplate: 'chat/requests-body',
      additionalCSS: ['/css/chat.css'],
      receivedRequests,
      sentRequests,
      user: req.user
    });
  } catch (error) {
    console.error('Follow requests error:', error);
    req.flash('error', 'Failed to load follow requests');
    res.redirect('/chat');
  }
});

// POST /chat/request/:userId - Send follow request
router.post('/request/:userId',
  body('message')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Message cannot exceed 200 characters'),
  logActivity('send follow request'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: errors.array()[0].msg 
        });
      }

      const targetUserId = req.params.userId;
      
      // Validate user ID
      if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid user ID' 
        });
      }

      // Can't send request to yourself
      if (targetUserId === req.user._id.toString()) {
        return res.status(400).json({ 
          success: false, 
          message: "You can't send a request to yourself" 
        });
      }

      // Check if target user exists and is from same campus
      const targetUser = await User.findById(targetUserId);
      if (!targetUser || !targetUser.isActive) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }

      if (targetUser.campus !== req.user.campus) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only send requests to users from your campus' 
        });
      }

      // Check if already friends
      const areFriends = await Friendship.areFriends(req.user._id, targetUserId);
      if (areFriends) {
        return res.status(400).json({ 
          success: false, 
          message: 'You are already friends with this user' 
        });
      }

      // Check if pending request already exists
      const existingRequest = await FollowRequest.checkExisting(req.user._id, targetUserId);
      if (existingRequest) {
        return res.status(400).json({ 
          success: false, 
          message: 'You already have a pending request to this user' 
        });
      }

      // Check for reversed pending request (they sent you a request)
      const reversedRequest = await FollowRequest.checkExisting(targetUserId, req.user._id);
      if (reversedRequest) {
        return res.status(400).json({ 
          success: false, 
          message: 'This user has already sent you a request. Check your requests!' 
        });
      }

      // SPAM DETECTION: Check if user has been rejected too many times
      const rejectedCount = await FollowRequest.countRejectedRequests(
        req.user._id, 
        targetUserId, 
        30 * 24 * 60 * 60 * 1000 // 30 days
      );

      if (rejectedCount >= 3) {
        // Log spam attempt for admin
        await AdminLog.logAction(
          null, // system action
          'spam_detection',
          'User',
          req.user._id,
          { 
            targetUser: targetUserId, 
            rejectedCount,
            reason: 'Exceeded rejected follow request limit'
          }
        );

        return res.status(429).json({ 
          success: false, 
          message: 'You have been blocked from sending more requests to this user' 
        });
      }

      // Check user's overall spam statistics
      const spamStats = await FollowRequest.getSpamStats(req.user._id);
      if (spamStats.totalSent > 20 && spamStats.rejected / spamStats.totalSent > 0.7) {
        // High rejection rate - potential spammer
        await AdminLog.logAction(
          null,
          'spam_detection',
          'User',
          req.user._id,
          { 
            spamStats,
            reason: 'High rejection rate detected'
          }
        );

        // Send warning notification
        await Notification.createAdminWarningNotification(
          req.user._id,
          'Your follow request activity has been flagged. Please ensure you are connecting with people appropriately.'
        );
      }

      // Create follow request
      const followRequest = await FollowRequest.create({
        sender: req.user._id,
        receiver: targetUserId,
        message: req.body.message || 'Hi! Let\'s connect and chat!',
        status: 'pending'
      });

      // Create notification for receiver and emit realtime notification
      const notification = await Notification.createFollowRequestNotification(
        req.user,
        targetUserId,
        followRequest._id
      );

      // Emit Socket.IO events for real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${targetUserId}`).emit('follow_request', {
          requestId: followRequest._id,
          sender: {
            id: req.user._id,
            username: req.user.username,
            name: req.user.name,
            avatarUrl: req.user.avatarUrl
          },
          message: followRequest.message
        });
        // Generic notification event carries the notification payload
        io.to(`user:${targetUserId}`).emit('notification', { notification });
      }

      return res.json({ 
        success: true, 
        message: 'Follow request sent successfully!' 
      });

    } catch (error) {
      console.error('Send follow request error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send follow request' 
      });
    }
  }
);

// POST /chat/request/:requestId/accept - Accept follow request
router.post('/request/:requestId/accept',
  logActivity('accept follow request'),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;

      // Validate request ID
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid request ID' 
        });
      }

      // Find the follow request
      const followRequest = await FollowRequest.findById(requestId)
        .populate('sender', 'username name avatarSeed avatarType avatarGridFSId');

      if (!followRequest) {
        return res.status(404).json({ 
          success: false, 
          message: 'Follow request not found' 
        });
      }

      // Verify the current user is the receiver
      if (followRequest.receiver.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      // Check if already accepted
      if (followRequest.status === 'accepted') {
        return res.status(400).json({ 
          success: false, 
          message: 'Request already accepted' 
        });
      }

      // Accept the request
      await followRequest.accept();

      // Create friendship
      const friendship = await Friendship.createFriendship(
        followRequest.sender._id,
        followRequest.receiver
      );

      // Create notification for sender
      await Notification.createFollowAcceptedNotification(
        req.user,
        followRequest.sender._id
      );

      // Emit Socket.IO event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${followRequest.sender._id}`).emit('follow_accepted', {
          accepter: {
            id: req.user._id,
            username: req.user.username,
            name: req.user.name,
            avatarUrl: req.user.avatarUrl
          },
          friendshipId: friendship._id
        });
      }

      return res.json({ 
        success: true, 
        message: 'Follow request accepted! You can now chat.',
        friendshipId: friendship._id
      });

    } catch (error) {
      console.error('Accept follow request error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to accept follow request' 
      });
    }
  }
);

// POST /chat/request/:requestId/reject - Reject follow request
router.post('/request/:requestId/reject',
  logActivity('reject follow request'),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;

      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid request ID' 
        });
      }

      const followRequest = await FollowRequest.findById(requestId);

      if (!followRequest) {
        return res.status(404).json({ 
          success: false, 
          message: 'Follow request not found' 
        });
      }

      if (followRequest.receiver.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      // Reject the request
      await followRequest.reject();

      // Check if this sender has been rejected multiple times by same user
      const rejectedCount = await FollowRequest.countRejectedRequests(
        followRequest.sender,
        req.user._id
      );

      if (rejectedCount >= 3) {
        // Log this for admin monitoring
        await AdminLog.logAction(
          null,
          'spam_detection',
          'User',
          followRequest.sender,
          {
            targetUser: req.user._id,
            rejectedCount,
            reason: 'User rejected by same person 3+ times'
          }
        );
      }

      return res.json({ 
        success: true, 
        message: 'Follow request rejected' 
      });

    } catch (error) {
      console.error('Reject follow request error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to reject follow request' 
      });
    }
  }
);

// POST /chat/request/:requestId/block - Block sender and reject request
router.post('/request/:requestId/block',
  logActivity('block user from follow request'),
  async (req, res) => {
    try {
      const requestId = req.params.requestId;

      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid request ID' 
        });
      }

      const followRequest = await FollowRequest.findById(requestId);

      if (!followRequest) {
        return res.status(404).json({ 
          success: false, 
          message: 'Follow request not found' 
        });
      }

      if (followRequest.receiver.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      // Block the request
      await followRequest.block();

      // Log for admin review
      await AdminLog.logAction(
        null,
        'user_blocked',
        'User',
        followRequest.sender,
        {
          blockedBy: req.user._id,
          reason: 'Blocked from follow request'
        }
      );

      return res.json({ 
        success: true, 
        message: 'User blocked successfully' 
      });

    } catch (error) {
      console.error('Block user error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to block user' 
      });
    }
  }
);

// ==========================================
// CHAT/MESSAGING ROUTES
// ==========================================

// GET /chat - View all conversations
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const friendships = await Friendship.getUserFriendships(req.user._id, page, limit);

    // Get last message for each friendship
    const conversationsWithMessages = await Promise.all(
      friendships.map(async (friendship) => {
        const otherUserId = friendship.getOtherUserId(req.user._id);
        const otherUser = friendship.users.find(u => u._id.toString() === otherUserId.toString());
        const lastMessage = await Message.getLastMessage(req.user._id, otherUserId);
        const unreadCount = friendship.unreadCount.get(req.user._id.toString()) || 0;

        return {
          friendship,
          otherUser: otherUser.toObject({ virtuals: true }),
          lastMessage,
          unreadCount
        };
      })
    );

    // Sort by last message time
    conversationsWithMessages.sort((a, b) => {
      const timeA = a.lastMessage ? a.lastMessage.sentAt : a.friendship.createdAt;
      const timeB = b.lastMessage ? b.lastMessage.sentAt : b.friendship.createdAt;
      return timeB - timeA;
    });

    res.render('layout', {
      title: 'Messages',
      bodyTemplate: 'chat/inbox-body',
      additionalCSS: ['/css/chat.css'],
      additionalJS: ['/js/chat.js'],
      conversations: conversationsWithMessages,
      user: req.user
    });

  } catch (error) {
    console.error('Chat inbox error:', error);
    req.flash('error', 'Failed to load conversations');
    res.redirect('/posts');
  }
});

// GET /chat/:userId - View conversation with specific user
router.get('/:userId', async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      req.flash('error', 'Invalid user ID');
      return res.redirect('/chat');
    }

    // Check if users are friends
    const areFriends = await Friendship.areFriends(req.user._id, otherUserId);
    if (!areFriends) {
      req.flash('error', 'You must be friends to chat');
      return res.redirect('/chat');
    }

    // Get other user info
    const otherUser = await User.findById(otherUserId)
      .select('username name avatarSeed avatarType avatarGridFSId');

    if (!otherUser) {
      req.flash('error', 'User not found');
      return res.redirect('/chat');
    }

    // Get friendship
    const friendship = await Friendship.getFriendship(req.user._id, otherUserId);

    // Get messages
    const page = parseInt(req.query.page) || 1;
    const messages = await Message.getConversation(req.user._id, otherUserId, page);

    // Mark messages as read
    await Message.markAsRead(req.user._id, otherUserId);
    await friendship.resetUnread(req.user._id);

    res.render('layout', {
      title: `Chat with ${otherUser.username}`,
      bodyTemplate: 'chat/conversation-body',
      additionalCSS: ['/css/chat.css'],
      additionalJS: ['/js/chat.js'],
      otherUser: otherUser.toObject({ virtuals: true }),
      messages,
      friendship,
      user: req.user
    });

  } catch (error) {
    console.error('Conversation error:', error);
    req.flash('error', 'Failed to load conversation');
    res.redirect('/chat');
  }
});

// GET /chat/start/:userId - Entry point when clicking 'Message' from profile
router.get('/start/:userId', async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      req.flash('error', 'Invalid user ID');
      return res.redirect('/chat');
    }

    // If already friends, go to conversation
    const areFriends = await Friendship.areFriends(req.user._id, otherUserId);
    if (areFriends) {
      return res.redirect(`/chat/${otherUserId}`);
    }

    // Otherwise, show a small "start chat" view that allows sending a follow request
    const otherUser = await User.findById(otherUserId).select('username name avatarSeed avatarType avatarGridFSId');
    if (!otherUser) {
      req.flash('error', 'User not found');
      return res.redirect('/chat');
    }

    res.render('layout', {
      title: `Start chat with ${otherUser.username}`,
      bodyTemplate: 'chat/start-body',
      additionalCSS: ['/css/chat.css'],
      additionalJS: ['/js/chat.js'],
      otherUser: otherUser.toObject({ virtuals: true }),
      user: req.user
    });

  } catch (error) {
    console.error('Chat start error:', error);
    req.flash('error', 'Failed to open chat starter');
    res.redirect('/chat');
  }
});

// POST /chat/:userId/message - Send a message
router.post('/:userId/message',
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 5000 })
    .withMessage('Message cannot exceed 5000 characters'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid reply message ID'),
  logActivity('send message'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: errors.array()[0].msg 
        });
      }

      const receiverId = req.params.userId;

      if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid user ID' 
        });
      }

      // Check if users are friends
      const areFriends = await Friendship.areFriends(req.user._id, receiverId);
      if (!areFriends) {
        return res.status(403).json({ 
          success: false, 
          message: 'You must be friends to send messages' 
        });
      }

      // Get friendship
      const friendship = await Friendship.getFriendship(req.user._id, receiverId);

      // Create message
      const message = await Message.create({
        sender: req.user._id,
        receiver: receiverId,
        friendship: friendship._id,
        messageType: 'text',
        content: req.body.content,
        replyTo: req.body.replyTo || null
      });

      // Update friendship
      await friendship.updateLastMessage();
      await friendship.incrementUnread(receiverId);

      // Populate sender info for response
      await message.populate('sender', 'username name avatarSeed avatarType avatarGridFSId');
      if (message.replyTo) {
        await message.populate('replyTo', 'content messageType sender');
      }

      // Create notification (only if receiver is not currently in chat)
      await Notification.createMessageNotification(req.user, receiverId, message._id);

      // Emit Socket.IO event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${receiverId}`).emit('new_message', {
          message: message.toObject({ virtuals: true }),
          sender: {
            id: req.user._id,
            username: req.user.username,
            name: req.user.name,
            avatarUrl: req.user.avatarUrl
          }
        });
      }

      return res.json({ 
        success: true, 
        message: message.toObject({ virtuals: true })
      });

    } catch (error) {
      console.error('Send message error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send message' 
      });
    }
  }
);

// POST /chat/:userId/upload - Upload media (voice, image, video, file)
router.post('/:userId/upload',
  uploadChatMedia,
  logActivity('send media message'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      const receiverId = req.params.userId;

      if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid user ID' 
        });
      }

      // Check if users are friends
      const areFriends = await Friendship.areFriends(req.user._id, receiverId);
      if (!areFriends) {
        return res.status(403).json({ 
          success: false, 
          message: 'You must be friends to send messages' 
        });
      }

      // Get friendship
      const friendship = await Friendship.getFriendship(req.user._id, receiverId);

      // Determine message type based on MIME type
      let messageType = 'file';
      if (req.file.mimetype.startsWith('image/')) messageType = 'image';
      else if (req.file.mimetype.startsWith('video/')) messageType = 'video';
      else if (req.file.mimetype.startsWith('audio/')) messageType = 'voice';

      // Create message with file
      const message = await Message.create({
        sender: req.user._id,
        receiver: receiverId,
        friendship: friendship._id,
        messageType,
        content: req.body.caption || '',
        fileGridFSId: req.file.id,
        fileName: req.file.filename,
        fileSize: req.file.size,
        fileMimeType: req.file.mimetype,
        voiceDuration: req.body.voiceDuration || null
      });

      // Update friendship
      await friendship.updateLastMessage();
      await friendship.incrementUnread(receiverId);

      // Populate sender info
      await message.populate('sender', 'username name avatarSeed avatarType avatarGridFSId');

      // Create notification
      await Notification.createMessageNotification(req.user, receiverId, message._id);

      // Emit Socket.IO event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${receiverId}`).emit('new_message', {
          message: message.toObject({ virtuals: true }),
          sender: {
            id: req.user._id,
            username: req.user.username,
            name: req.user.name,
            avatarUrl: req.user.avatarUrl
          }
        });
      }

      return res.json({ 
        success: true, 
        message: message.toObject({ virtuals: true })
      });

    } catch (error) {
      console.error('Upload media error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to upload media' 
      });
    }
  }
);

// GET /chat/:userId/messages - Get messages (API endpoint for infinite scroll)
router.get('/:userId/messages', async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID' 
      });
    }

    // Check if users are friends
    const areFriends = await Friendship.areFriends(req.user._id, otherUserId);
    if (!areFriends) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const messages = await Message.getConversation(req.user._id, otherUserId, page, limit);

    return res.json({ 
      success: true, 
      messages: messages.map(m => m.toObject({ virtuals: true })),
      page,
      hasMore: messages.length === limit
    });

  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to load messages' 
    });
  }
});

// DELETE /chat/message/:messageId - Delete message
router.delete('/message/:messageId',
  logActivity('delete message'),
  async (req, res) => {
    try {
      const messageId = req.params.messageId;

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid message ID' 
        });
      }

      const message = await Message.findById(messageId);

      if (!message) {
        return res.status(404).json({ 
          success: false, 
          message: 'Message not found' 
        });
      }

      // Check if user is sender or receiver
      if (message.sender.toString() !== req.user._id.toString() && 
          message.receiver.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      // Soft delete for user
      await message.deleteForUser(req.user._id);

      return res.json({ 
        success: true, 
        message: 'Message deleted' 
      });

    } catch (error) {
      console.error('Delete message error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to delete message' 
      });
    }
  }
);

// POST /chat/search - Search messages
router.post('/search',
  body('query')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          message: errors.array()[0].msg 
        });
      }

      const { query } = req.body;
      const page = parseInt(req.query.page) || 1;

      const messages = await Message.searchMessages(req.user._id, query, page);

      return res.json({ 
        success: true, 
        messages: messages.map(m => m.toObject({ virtuals: true })),
        page
      });

    } catch (error) {
      console.error('Search messages error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Search failed' 
      });
    }
  }
);

module.exports = router;
