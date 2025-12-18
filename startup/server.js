const https = require('https');
const http = require('http');
const fs = require('fs');
const socketIo = require('socket.io');
const path = require('path');
const { initializeChatHandlers } = require('../sockets/chatHandlers');

/**
 * Server and Socket.IO Configuration
 * Sets up HTTPS server and real-time features
 */
const configureServer = (app) => {
  let server;

  // Try to get SSL certificates from environment variables first (for production)
  const sslCert = process.env.SSL_CERT;
  const sslKey = process.env.SSL_KEY;

  if (sslCert && sslKey) {
    // Use certificates from environment variables
    const sslOptions = {
      cert: sslCert,
      key: sslKey
    };

    server = https.createServer(sslOptions, app);
    console.log('🔒 HTTPS server configured with SSL certificates from environment variables');
  } else {
    // Check if SSL certificate files exist (for local development)
    const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '..', 'certs', 'server.crt');
    const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '..', 'certs', 'server.key');

    try {
      // Check if cert files exist and are readable
      fs.accessSync(certPath, fs.constants.R_OK);
      fs.accessSync(keyPath, fs.constants.R_OK);

      // Read SSL certificate and private key
      const sslOptions = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath)
      };

      // Create HTTPS server
      server = https.createServer(sslOptions, app);
      console.log('🔒 HTTPS server configured with SSL certificate files');
    } catch (error) {
      // No certificates available, use HTTP
      server = http.createServer(app);
      console.log('🌐 HTTP server configured (SSL termination handled by reverse proxy)');
    }
  }

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
