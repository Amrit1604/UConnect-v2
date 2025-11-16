/**
 * Socket.IO Chat Handlers - UConnect
 * Real-time messaging, typing indicators, and online status
 */

const Message = require('../models/Message');
const Friendship = require('../models/Friendship');
const User = require('../models/User');

// Store online users
const onlineUsers = new Map(); // userId -> socketId

/**
 * Initialize chat socket handlers
 * @param {SocketIO.Server} io - Socket.IO server instance
 */
function initializeChatHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // User authentication and room joining
    socket.on('authenticate', async (userId) => {
      try {
        if (!userId) return;

        // Store user socket mapping
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;

        // Join user's personal room for notifications
        socket.join(`user:${userId}`);

        // Broadcast online status to user's friends
        const friendships = await Friendship.getUserFriendships(userId, 1, 100);
        friendships.forEach(friendship => {
          const friendId = friendship.getOtherUserId(userId);
          io.to(`user:${friendId}`).emit('user_online', { userId });
        });

        // Send list of online friends to the user
        const onlineFriends = [];
        friendships.forEach(friendship => {
          const friendId = friendship.getOtherUserId(userId);
          if (onlineUsers.has(friendId.toString())) {
            onlineFriends.push(friendId);
          }
        });

        socket.emit('friends_online', { onlineFriends });

        console.log(`✅ User authenticated: ${userId}`);
      } catch (error) {
        console.error('Socket authentication error:', error);
      }
    });

    // Join a conversation room
    socket.on('join_conversation', async ({ userId, otherUserId }) => {
      try {
        if (!userId || !otherUserId) return;

        // Verify friendship
        const areFriends = await Friendship.areFriends(userId, otherUserId);
        if (!areFriends) {
          socket.emit('error', { message: 'Not authorized to join this conversation' });
          return;
        }

        // Create room name (sorted user IDs for consistency)
        const roomName = [userId, otherUserId].sort().join('_');
        socket.join(roomName);

        console.log(`✅ User ${userId} joined conversation: ${roomName}`);

        // Mark messages as delivered
        await Message.markAsDelivered(userId, otherUserId);

        // Notify other user
        io.to(`user:${otherUserId}`).emit('messages_delivered', { 
          from: otherUserId,
          to: userId 
        });
      } catch (error) {
        console.error('Join conversation error:', error);
      }
    });

    // Leave a conversation room
    socket.on('leave_conversation', ({ userId, otherUserId }) => {
      if (!userId || !otherUserId) return;
      
      const roomName = [userId, otherUserId].sort().join('_');
      socket.leave(roomName);
      
      console.log(`👋 User ${userId} left conversation: ${roomName}`);
    });

    // Send typing indicator
    socket.on('typing_start', ({ userId, otherUserId }) => {
      if (!userId || !otherUserId) return;
      
      io.to(`user:${otherUserId}`).emit('user_typing', {
        userId,
        isTyping: true
      });
    });

    // Allow sending a message via socket for testing/demo purposes
    socket.on('send_message', async ({ senderId, otherUserId, content }) => {
      try {
        if (!senderId || !otherUserId || !content) return socket.emit('send_message_error', { message: 'Missing params' });

        // Verify friendship
        const areFriends = await Friendship.areFriends(senderId, otherUserId);
        if (!areFriends) return socket.emit('send_message_error', { message: 'Not friends' });

        const friendship = await Friendship.getFriendship(senderId, otherUserId);

        const message = await Message.create({
          sender: senderId,
          receiver: otherUserId,
          friendship: friendship._id,
          messageType: 'text',
          content
        });

        await friendship.updateLastMessage();
        await friendship.incrementUnread(otherUserId);

        await message.populate('sender', 'username name avatarSeed avatarType avatarGridFSId');

        // Emit to receiver
        io.to(`user:${otherUserId}`).emit('new_message', {
          message: message.toObject({ virtuals: true }),
          sender: {
            id: senderId
          }
        });

        // Acknowledge sender
        socket.emit('send_message_ok', { message: message.toObject({ virtuals: true }) });
      } catch (err) {
        console.error('socket send_message error', err);
        socket.emit('send_message_error', { message: 'Failed to create message' });
      }
    });

    socket.on('typing_stop', ({ userId, otherUserId }) => {
      if (!userId || !otherUserId) return;
      
      io.to(`user:${otherUserId}`).emit('user_typing', {
        userId,
        isTyping: false
      });
    });

    // Message read receipt
    socket.on('messages_read', async ({ userId, otherUserId }) => {
      try {
        if (!userId || !otherUserId) return;

        // Mark messages as read
        const count = await Message.markAsRead(userId, otherUserId);

        // Reset unread count in friendship
        const friendship = await Friendship.getFriendship(userId, otherUserId);
        if (friendship) {
          await friendship.resetUnread(userId);
        }

        // Notify sender that messages were read
        io.to(`user:${otherUserId}`).emit('messages_read_receipt', {
          from: otherUserId,
          to: userId,
          count
        });

        console.log(`✅ ${count} messages marked as read from ${otherUserId} to ${userId}`);
      } catch (error) {
        console.error('Messages read error:', error);
      }
    });

    // Voice call initiation (signaling only, actual WebRTC happens client-side)
    socket.on('call_initiate', async ({ callerId, receiverId, callType }) => {
      try {
        if (!callerId || !receiverId) return;

        // Verify friendship
        const areFriends = await Friendship.areFriends(callerId, receiverId);
        if (!areFriends) {
          socket.emit('call_error', { message: 'Cannot call this user' });
          return;
        }

        // Get caller info
        const caller = await User.findById(callerId)
          .select('username name avatarSeed avatarType avatarGridFSId');

        // Send call notification to receiver
        io.to(`user:${receiverId}`).emit('incoming_call', {
          caller: {
            id: caller._id,
            username: caller.username,
            name: caller.name,
            avatarUrl: caller.avatarUrl
          },
          callType, // 'voice' or 'video'
          callId: socket.id
        });

        console.log(`📞 Call initiated from ${callerId} to ${receiverId}`);
      } catch (error) {
        console.error('Call initiate error:', error);
      }
    });

    socket.on('call_accept', ({ callerId, receiverId }) => {
      io.to(`user:${callerId}`).emit('call_accepted', { receiverId });
    });

    socket.on('call_reject', ({ callerId, receiverId }) => {
      io.to(`user:${callerId}`).emit('call_rejected', { receiverId });
    });

    socket.on('call_end', ({ callerId, receiverId }) => {
      io.to(`user:${receiverId}`).emit('call_ended', { from: callerId });
      io.to(`user:${callerId}`).emit('call_ended', { from: receiverId });
    });

    // WebRTC signaling
    socket.on('webrtc_offer', ({ to, offer }) => {
      io.to(`user:${to}`).emit('webrtc_offer', {
        from: socket.userId,
        offer
      });
    });

    socket.on('webrtc_answer', ({ to, answer }) => {
      io.to(`user:${to}`).emit('webrtc_answer', {
        from: socket.userId,
        answer
      });
    });

    socket.on('webrtc_ice_candidate', ({ to, candidate }) => {
      io.to(`user:${to}`).emit('webrtc_ice_candidate', {
        from: socket.userId,
        candidate
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);

      if (socket.userId) {
        // Remove from online users
        onlineUsers.delete(socket.userId);

        // Broadcast offline status to user's friends
        try {
          const friendships = await Friendship.getUserFriendships(socket.userId, 1, 100);
          friendships.forEach(friendship => {
            const friendId = friendship.getOtherUserId(socket.userId);
            io.to(`user:${friendId}`).emit('user_offline', { 
              userId: socket.userId 
            });
          });
        } catch (error) {
          console.error('Disconnect broadcast error:', error);
        }
      }
    });
  });

  return onlineUsers;
}

/**
 * Get online users count
 */
function getOnlineUsersCount() {
  return onlineUsers.size;
}

/**
 * Check if user is online
 */
function isUserOnline(userId) {
  return onlineUsers.has(userId.toString());
}

module.exports = {
  initializeChatHandlers,
  getOnlineUsersCount,
  isUserOnline
};
