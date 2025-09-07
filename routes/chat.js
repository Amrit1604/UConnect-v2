/**
 * 🔥 HULK-POWERED SECRET CHAT ROUTES 🔥
 * Private messaging system for students
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const ChatRequest = require('../models/ChatRequest');
const PrivateChat = require('../models/PrivateChat');
const User = require('../models/User');
const Post = require('../models/Post');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// 🚀 POST /chat/request - Submit private chat request
router.post('/request',
  [
    body('recipientId').isMongoId().withMessage('Invalid recipient user'),
    body('postId').isMongoId().withMessage('Invalid post ID'),
    body('message').isLength({ min: 5, max: 200 }).withMessage('Message must be 5-200 characters').trim()
  ],
  async (req, res) => {
    try {
      console.log('🔥 HULK CHAT: New secret chat request received!');
      console.log('📝 Request body:', req.body);
      console.log('👤 Requester:', req.user.username);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array()
        });
      }

      const { recipientId, postId, message } = req.body;

      // Validate users are from same campus
      const targetUser = await User.findById(recipientId);
      if (!targetUser || targetUser.campus !== req.user.campus) {
        return res.status(400).json({
          success: false,
          message: 'Can only chat with users from your campus'
        });
      }

      // Check if post exists and is from same campus
      const post = await Post.findById(postId);
      if (!post || post.campus !== req.user.campus) {
        return res.status(400).json({
          success: false,
          message: 'Invalid post or campus mismatch'
        });
      }

      // Prevent self-requests
      if (recipientId === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot send chat request to yourself'
        });
      }

      // Check for existing pending request
      const existingRequest = await ChatRequest.findOne({
        requester: req.user._id,
        target: recipientId,
        post: postId,
        status: 'pending'
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: 'You already have a pending request to this user on this post'
        });
      }

      // Create chat request
      const chatRequest = new ChatRequest({
        requester: req.user._id,
        target: recipientId,
        post: postId,
        message: message,
        campus: req.user.campus
      });

      await chatRequest.save();

      console.log('✅ HULK CHAT: Request created successfully');

      // Emit real-time notification to target user
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${recipientId}`).emit('newChatRequest', {
          requestId: chatRequest._id,
          recipientId: recipientId,
          requesterName: req.user.name,
          requester: {
            id: req.user._id,
            name: req.user.name,
            username: req.user.username,
            avatarUrl: req.user.avatarUrl
          },
          message: message,
          postId: postId,
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        message: 'Chat request sent successfully! 🚀',
        requestId: chatRequest._id
      });

    } catch (error) {
      console.error('💥 HULK CHAT ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send chat request'
      });
    }
  }
);

// 🔍 GET /chat/requests - Get my chat requests (sent and received)
router.get('/requests', async (req, res) => {
  try {
    console.log('🔍 HULK CHAT: Fetching chat requests for:', req.user.username);

    const [sentRequests, receivedRequests] = await Promise.all([
      // Requests I sent
      ChatRequest.find({
        requester: req.user._id,
        isActive: true
      })
      .populate('target', 'name username avatar avatarType avatarSeed')
      .populate('post', 'content')
      .sort({ createdAt: -1 })
      .limit(20),

      // Requests I received
      ChatRequest.find({
        target: req.user._id,
        isActive: true
      })
      .populate('requester', 'name username avatar avatarType avatarSeed')
      .populate('post', 'content')
      .sort({ createdAt: -1 })
      .limit(20)
    ]);

    // Format data for EJS template
    const formattedSent = sentRequests.map(req => {
      const reqObj = req.toObject();
      // Ensure virtual fields for populated user
      if (reqObj.target) {
        reqObj.target = { ...reqObj.target, avatarUrl: req.target.avatarUrl };
        reqObj.recipient = reqObj.target;
        reqObj.otherUser = reqObj.target;
      }
      return {
        ...reqObj,
        formattedTime: formatTime(req.createdAt),
        postTitle: req.post ? req.post.content.substring(0, 50) + '...' : 'Unknown post',
        isRoomExpired: req.roomExpiry && new Date() > req.roomExpiry,
        roomExpiryFormatted: req.roomExpiry ? formatTime(req.roomExpiry) : null
      };
    });

    const formattedReceived = receivedRequests.map(req => {
      const reqObj = req.toObject();
      // Ensure virtual fields for populated user
      if (reqObj.requester) {
        reqObj.requester = { ...reqObj.requester, avatarUrl: req.requester.avatarUrl };
        reqObj.otherUser = reqObj.requester;
      }
      return {
        ...reqObj,
        formattedTime: formatTime(req.createdAt),
        postTitle: req.post ? req.post.content.substring(0, 50) + '...' : 'Unknown post',
        isRoomExpired: req.roomExpiry && new Date() > req.roomExpiry
      };
    });

    // Get active chats (accepted requests with valid rooms)
    const activeChats = await ChatRequest.find({
      $or: [
        { requester: req.user._id },
        { target: req.user._id }
      ],
      status: 'accepted',
      roomId: { $exists: true },
      roomExpiry: { $gt: new Date() },
      isActive: true
    })
    .populate('requester target', 'name username avatar avatarType avatarSeed')
    .sort({ roomExpiry: 1 })
    .limit(10);

    const formattedActiveChats = activeChats.map(chat => ({
      ...chat.toObject(),
      otherUser: chat.requester._id.toString() === req.user._id.toString() ? chat.target : chat.requester,
      roomExpiryFormatted: formatTime(chat.roomExpiry),
      lastActivityFormatted: formatTime(chat.updatedAt)
    }));

    console.log('📊 CHAT STATS:', {
      sent: formattedSent.length,
      received: formattedReceived.length,
      active: formattedActiveChats.length
    });

    res.render('chat/requests', {
      title: 'Secret Chat Requests',
      user: req.user,
      sentRequests: formattedSent,
      receivedRequests: formattedReceived,
      activeChats: formattedActiveChats
    });

  } catch (error) {
    console.error('💥 HULK CHAT ERROR:', error);
    req.flash('error', 'Failed to load chat requests');
    res.redirect('/posts');
  }
});

// Helper function to format time
function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// ✅ POST /chat/request/respond - Respond to chat request (Alternative route)
router.post('/request/respond',
  [
    body('requestId').isMongoId().withMessage('Invalid request ID'),
    body('response').isIn(['accept', 'reject']).withMessage('Invalid response')
  ],
  async (req, res) => {
    try {
      console.log('🎯 HULK CHAT: Responding to chat request via /request/respond');
      console.log('📝 Request body:', req.body);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array()
        });
      }

      const { requestId, response } = req.body;

      const chatRequest = await ChatRequest.findById(requestId)
        .populate('requester target', 'name username avatar avatarType avatarSeed');

      if (!chatRequest) {
        return res.status(404).json({
          success: false,
          message: 'Chat request not found'
        });
      }

      // Verify this user is the target
      if (chatRequest.target._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only respond to requests sent to you'
        });
      }

      // Check if already responded
      if (chatRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Request already responded to'
        });
      }

      // Update request status
      chatRequest.status = response;
      chatRequest.respondedAt = new Date();

      if (response === 'accept') {
        // Generate unique room ID and set expiry
        chatRequest.generateRoomId();
        chatRequest.setRoomExpiry();
        console.log('🚀 HULK CHAT: Room created:', chatRequest.roomId);
      }

      await chatRequest.save();

      // Emit real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${chatRequest.requester._id}`).emit('chatRequestResponse', {
          requestId: chatRequest._id,
          response: response,
          recipientName: req.user.name,
          requesterId: chatRequest.requester._id.toString(),
          roomId: response === 'accept' ? chatRequest.roomId : null
        });
      }

      res.json({
        success: true,
        message: response === 'accept' ?
          'Chat request accepted! Private room created.' :
          'Chat request rejected.',
        roomId: response === 'accept' ? chatRequest.roomId : null
      });

    } catch (error) {
      console.error('💥 HULK CHAT ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to respond to chat request'
      });
    }
  }
);

// ✅ POST /chat/respond/:requestId - Respond to chat request
router.post('/respond/:requestId',
  [
    body('action').isIn(['accept', 'reject']).withMessage('Invalid action'),
    body('response').optional().isLength({ max: 200 }).withMessage('Response too long').trim()
  ],
  async (req, res) => {
    try {
      console.log('🎯 HULK CHAT: Responding to chat request');

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { requestId } = req.params;
      const { action, response } = req.body;

      const chatRequest = await ChatRequest.findById(requestId)
        .populate('requester', 'name username avatarUrl');

      if (!chatRequest) {
        return res.status(404).json({
          success: false,
          message: 'Chat request not found'
        });
      }

      // Verify this request is for current user
      if (!chatRequest.target.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check if already responded
      if (chatRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Request already responded to'
        });
      }

      // Check if expired
      if (chatRequest.isExpired()) {
        chatRequest.status = 'expired';
        await chatRequest.save();
        return res.status(400).json({
          success: false,
          message: 'Request has expired'
        });
      }

      // Update request
      chatRequest.status = action === 'accept' ? 'accepted' : 'rejected';
      chatRequest.response = response || '';

      if (action === 'accept') {
        await chatRequest.acceptRequest();
        console.log('🚀 HULK CHAT: Request accepted, room created:', chatRequest.roomId);
      } else {
        await chatRequest.save();
      }

      // Real-time notification to requester
      const io = req.app.get('socketio');
      if (io) {
        io.to(`user_${chatRequest.requester._id}`).emit('chatResponse', {
          requestId: chatRequest._id,
          action: action,
          response: response,
          roomId: action === 'accept' ? chatRequest.roomId : null,
          roomUrl: action === 'accept' ? chatRequest.roomUrl : null,
          responder: {
            name: req.user.name,
            username: req.user.username
          }
        });
      }

      res.json({
        success: true,
        message: action === 'accept' ? 'Chat request accepted! 🎉' : 'Chat request rejected',
        data: {
          status: chatRequest.status,
          roomId: chatRequest.roomId,
          roomUrl: chatRequest.roomUrl
        }
      });

    } catch (error) {
      console.error('💥 HULK CHAT ERROR:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to respond to chat request'
      });
    }
  }
);

// 🏠 GET /chat/private/:roomId - Access private chat room
router.get('/private/:roomId', async (req, res) => {
  try {
    console.log('🏠 HULK CHAT: Accessing private room');

    const { roomId } = req.params;

    // Find chat request with this room ID
    const chatRequest = await ChatRequest.findOne({ roomId })
      .populate('requester', 'name username avatarUrl')
      .populate('target', 'name username avatarUrl');

    if (!chatRequest) {
      req.flash('error', 'Private chat room not found');
      return res.redirect('/posts');
    }

    // Verify user is part of this chat
    const userId = req.user._id.toString();
    const isParticipant = chatRequest.requester._id.toString() === userId ||
                         chatRequest.target._id.toString() === userId;

    if (!isParticipant) {
      req.flash('error', 'Access denied to this private room');
      return res.redirect('/posts');
    }

    // Check if room is expired
    if (chatRequest.isRoomExpired()) {
      req.flash('error', 'This private chat room has expired');
      return res.redirect('/posts');
    }

    // Get other participant
    const otherUser = userId === chatRequest.requester._id.toString() ?
                     chatRequest.target : chatRequest.requester;

    // Get chat messages
    const messages = await PrivateChat.find({
      roomId: roomId,
      isDeleted: false
    })
    .populate('sender', 'name username avatarUrl')
    .sort({ createdAt: 1 })
    .limit(100);

    res.render('chat/private-room', {
      title: `Private Chat with ${otherUser.name}`,
      roomId: roomId,
      otherUser: otherUser,
      messages: messages,
      chatRequest: chatRequest,
      user: req.user
    });

  } catch (error) {
    console.error('💥 HULK CHAT ERROR:', error);
    req.flash('error', 'Failed to access private room');
    res.redirect('/posts');
  }
});

// 📱 GET /chat/requests/page - Chat requests page
router.get('/requests/page', async (req, res) => {
  try {
    const [sentRequests, receivedRequests] = await Promise.all([
      ChatRequest.find({
        requester: req.user._id,
        isActive: true
      })
      .populate('target', 'name username avatarUrl')
      .populate('post', 'content')
      .sort({ createdAt: -1 })
      .limit(50),

      ChatRequest.find({
        target: req.user._id,
        isActive: true
      })
      .populate('requester', 'name username avatarUrl')
      .populate('post', 'content')
      .sort({ createdAt: -1 })
      .limit(50)
    ]);

    res.render('chat/requests', {
      title: 'Secret Chat Requests',
      sentRequests: sentRequests,
      receivedRequests: receivedRequests,
      user: req.user
    });

  } catch (error) {
    console.error('💥 HULK CHAT ERROR:', error);
    req.flash('error', 'Failed to load chat requests');
    res.redirect('/posts');
  }
});

// 🚪 GET /chat/room/:roomId - Access private chat room
router.get('/room/:roomId', async (req, res) => {
  try {
    console.log('🚪 HULK CHAT: Accessing private room:', req.params.roomId);

    const { roomId } = req.params;

    // Find the chat request with this room ID
    const chatRequest = await ChatRequest.findOne({
      roomId: roomId,
      status: 'accepted',
      isActive: true
    })
    .populate('requester target', 'name username avatar avatarType avatarSeed');

    if (!chatRequest) {
      req.flash('error', 'Chat room not found or expired');
      return res.redirect('/chat/requests');
    }

    // Check if user is part of this chat
    const isRequester = chatRequest.requester._id.toString() === req.user._id.toString();
    const isTarget = chatRequest.target._id.toString() === req.user._id.toString();

    if (!isRequester && !isTarget) {
      req.flash('error', 'You do not have access to this chat room');
      return res.redirect('/chat/requests');
    }

    // Check if room has expired
    if (chatRequest.roomExpiry && new Date() > chatRequest.roomExpiry) {
      req.flash('error', 'This chat room has expired');
      return res.redirect('/chat/requests');
    }

    // Get the other user
    const otherUser = isRequester ? chatRequest.target : chatRequest.requester;

    // Ensure virtual fields
    const otherUserObj = otherUser.toObject({ virtuals: true });

    // Get previous messages
    const messages = await PrivateChat.find({ roomId })
      .populate('sender', 'name username avatar avatarType avatarSeed')
      .sort({ timestamp: 1 })
      .limit(100);

    // Format messages with virtual fields
    const formattedMessages = messages.map(msg => {
      const msgObj = msg.toObject();
      msgObj.sender = { ...msgObj.sender, avatarUrl: msg.sender.avatarUrl };
      msgObj.formattedTime = formatTime(msg.timestamp);
      return msgObj;
    });

    console.log('✅ HULK CHAT: Room access granted. Messages:', formattedMessages.length);

    res.render('chat/private-room', {
      title: 'Private Chat',
      user: req.user,
      otherUser: otherUserObj,
      roomId: roomId,
      chatRequest: chatRequest,
      messages: formattedMessages
    });

  } catch (error) {
    console.error('💥 HULK CHAT ERROR:', error);
    req.flash('error', 'Failed to access chat room');
    res.redirect('/chat/requests');
  }
});

module.exports = router;
