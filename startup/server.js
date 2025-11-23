const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');
const { initializeChatHandlers } = require('../sockets/chatHandlers');

/**
 * Server and Socket.IO Configuration
 * Sets up HTTPS server and real-time features
 */
const configureServer = (app) => {
  // Paths to SSL cert and key - these can be customized as needed
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '..', 'certs', 'server.crt');
  const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '..', 'certs', 'server.key');

  // Read SSL certificate and private key
  const sslOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  };

  // Create HTTPS server
  const server = https.createServer(sslOptions, app);

  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Initialize chat handlers for real-time messaging
  initializeChatHandlers(io);

  // Socket.IO event handlers
  io.on('connection', (socket) => {
    console.log('🚀 User connected:', socket.id);

    // Join user to their campus room
    socket.on('join-campus', (campus) => {
      socket.join(campus);
      console.log(`👥 User joined campus: ${campus}`);
    });

    // Join gossip room for real-time updates
    socket.on('join', (room) => {
      if (room === 'gossip') {
        socket.join('gossip');
        console.log(`🗣️ User joined gossip room`);
      }
    });

    // Handle new post creation
    socket.on('new-post', (postData) => {
      console.log('📝 New post created:', postData.content?.substring(0, 30) + '...');
      socket.to(postData.campus).emit('post-created', postData);
    });

    // Handle real-time likes
    socket.on('like-post', (data) => {
      socket.to(data.campus).emit('post-liked', data);
    });

    // Handle real-time comments
    socket.on('new-comment', (data) => {
      socket.to(data.campus).emit('comment-added', data);
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(data.campus).emit('user-typing', data);
    });

    socket.on('setUserId', (userId) => {
      socket.userId = userId;
      console.log(`🔑 User ID set for socket: ${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('👋 User disconnected:', socket.id);
    });
  });

  // Make io accessible to routes
  app.set('io', io);

  return { server, io };
};

module.exports = { configureServer };
